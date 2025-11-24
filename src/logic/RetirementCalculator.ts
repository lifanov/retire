import { type SimulationInputs, type SimulationResult, type YearLog, CONSTANTS, type TaxData, type StateTaxData, type FilingStatus } from './types';
import federalTaxDataRaw from '../data/federal_tax_data.json';
import stateTaxDataRaw from '../data/state_tax_config.json';
import healthcareDataRaw from '../data/healthcare_data.json';

const federalTaxData = federalTaxDataRaw as TaxData;
const stateTaxData = stateTaxDataRaw as Record<string, StateTaxData>;

export class RetirementCalculator {
    private inputs: SimulationInputs;
    private inflationRate: number;
    private returnRate: number;
    private healthcareInflationRate: number;

    constructor(inputs: SimulationInputs) {
        this.inputs = inputs;
        this.inflationRate = inputs.inflationRate ?? CONSTANTS.INFLATION;
        this.returnRate = inputs.returnRate ?? CONSTANTS.RETURN_RATE;
        this.healthcareInflationRate = inputs.healthcareInflationRate ?? CONSTANTS.HEALTHCARE_INFLATION;
    }

    private calculateFederalTax(taxableIncome: number, filingStatus: FilingStatus): number {
        if (taxableIncome <= 0) return 0;

        const brackets = federalTaxData.brackets[filingStatus];
        if (!brackets) {
             console.error(`Invalid filing status: ${filingStatus}`);
             return 0;
        }

        let tax = 0;

        for (const bracket of brackets) {
            const bracketMax = bracket.max === null ? Infinity : bracket.max;
            if (taxableIncome > bracket.min) {
                const taxableAmountInBracket = Math.min(taxableIncome, bracketMax) - bracket.min;
                tax += taxableAmountInBracket * bracket.rate;
            }
        }
        return tax;
    }

    private calculateCapitalGainsTax(taxableIncomeIncludingGains: number, realizedGains: number, filingStatus: FilingStatus): number {
        if (realizedGains <= 0) return 0;

        const brackets = federalTaxData.capital_gains[filingStatus];
        const safeBrackets = brackets || federalTaxData.capital_gains['single'];

        let rate = 0;
        for (const bracket of safeBrackets) {
             if (taxableIncomeIncludingGains > bracket.min) {
                 rate = bracket.rate;
             }
        }
        return realizedGains * rate;
    }

    private calculateStateTax(taxableIncome: number, stateCode: string): number {
        const stateData = stateTaxData[stateCode];
        if (!stateData || stateData.income_tax.type === 'none') return 0;

        if (stateData.income_tax.type === 'flat') {
            return taxableIncome * (stateData.income_tax.rate || 0);
        }

        if (stateData.income_tax.type === 'progressive' && stateData.income_tax.brackets) {
            let tax = 0;
            const brackets = stateData.income_tax.brackets;
            for (let i = 0; i < brackets.length; i++) {
                const current = brackets[i];
                const next = brackets[i+1];
                const max = next ? next.min : Infinity;

                if (taxableIncome > current.min) {
                    const taxableInBracket = Math.min(taxableIncome, max) - current.min;
                    tax += taxableInBracket * current.rate;
                }
            }
            return tax;
        }

        return 0;
    }

    private calculateHealthcareCost(age: number, currentYear: number, stateCode: string): number {
        let baseCost = 0;
        if (age >= CONSTANTS.MEDICARE_AGE) {
            baseCost = healthcareDataRaw.medicare_annual_cost.total;
        } else {
            const stateMultiplier = (healthcareDataRaw.state_multipliers as Record<string, number>)[stateCode] || 1.0;

            baseCost = healthcareDataRaw.pre_medicare_annual_cost.base
                * (1 + (age * healthcareDataRaw.pre_medicare_annual_cost.age_multiplier))
                * stateMultiplier;
        }

        const yearsPassed = currentYear - new Date().getFullYear();
        return baseCost * Math.pow(1 + this.healthcareInflationRate, yearsPassed);
    }

    public simulate(): SimulationResult {
        const history: YearLog[] = [];
        let currentYear = new Date().getFullYear();
        let currentAge = this.inputs.currentAge;

        let assetsPreTax = this.inputs.savingsPreTax;
        let assetsPostTax = this.inputs.savingsPostTax;
        let assetsRoth = this.inputs.savingsRoth;
        let assetsHSA = this.inputs.savingsHSA;

        while (currentAge <= this.inputs.lifeExpectancy) {
            const isRetired = currentAge >= this.inputs.retirementAge;
            const assetsStart = assetsPreTax + assetsPostTax + assetsRoth + assetsHSA;

            // 1. Determine Income (Inflows)
            let laborIncome = 0;
            let socialSecurity = 0;

            if (!isRetired) {
                laborIncome = this.inputs.annualIncome * Math.pow(1 + this.inflationRate, currentYear - new Date().getFullYear());
            } else {
                if (currentAge >= this.inputs.socialSecurityStartAge) {
                    let benefit = this.inputs.socialSecurityAt67;
                    const variance = this.inputs.socialSecurityStartAge - 67;
                    if (variance !== 0) {
                        const adjustmentRate = variance < 0 ? 0.06 : 0.08;
                        benefit = benefit * (1 + (variance * adjustmentRate));
                    }
                    socialSecurity = benefit * Math.pow(1 + this.inflationRate, currentYear - new Date().getFullYear());
                }
            }

            // 2. Determine Expenses (Outflows)
            let expenses = this.inputs.annualExpenses * Math.pow(1 + this.inflationRate, currentYear - new Date().getFullYear());

            // 3. Healthcare
            const healthcare = this.calculateHealthcareCost(currentAge, currentYear, this.inputs.state);

            // SPECIAL LOGIC: Pay healthcare from HSA first (Tax Free)
            let healthcarePaidByHSA = 0;
            if (assetsHSA > 0) {
                if (assetsHSA >= healthcare) {
                    healthcarePaidByHSA = healthcare;
                    assetsHSA -= healthcare;
                } else {
                    healthcarePaidByHSA = assetsHSA;
                    assetsHSA = 0;
                }
            }

            const remainingHealthcare = healthcare - healthcarePaidByHSA;

            // 4. Gross Needs (Expenses + Remaining Healthcare not covered by HSA)
            const grossNeeds = expenses + remainingHealthcare;

            // 5. Withdrawal Strategy & Taxes
            let withdrawalNeeded = Math.max(0, grossNeeds - (laborIncome + socialSecurity));
            let savingsContribution = Math.max(0, (laborIncome + socialSecurity) - grossNeeds);

            let taxes = 0;

            let withdrawnPreTax = 0;
            let withdrawnPostTax = 0;
            let withdrawnRoth = 0;
            let realizedGains = 0;

            // Withdrawal Order: Post-Tax -> Pre-Tax -> Roth
            if (withdrawalNeeded > 0) {
                // Take from Post Tax
                if (assetsPostTax > withdrawalNeeded) {
                    withdrawnPostTax = withdrawalNeeded;
                    assetsPostTax -= withdrawalNeeded;
                    realizedGains = withdrawnPostTax * 0.5;
                } else {
                    withdrawnPostTax = assetsPostTax;
                    realizedGains = withdrawnPostTax * 0.5;
                    withdrawalNeeded -= assetsPostTax;
                    assetsPostTax = 0;

                    // Take from Pre Tax
                    if (assetsPreTax > withdrawalNeeded) {
                        withdrawnPreTax = withdrawalNeeded;
                        assetsPreTax -= withdrawalNeeded;
                    } else {
                        withdrawnPreTax = assetsPreTax;
                        withdrawalNeeded -= assetsPreTax;
                        assetsPreTax = 0;

                        // Take from Roth
                        if (assetsRoth > withdrawalNeeded) {
                            withdrawnRoth = withdrawalNeeded;
                            assetsRoth -= withdrawalNeeded;
                        } else {
                            withdrawnRoth = assetsRoth;
                            assetsRoth = 0;
                        }
                    }
                }
            }

            if (savingsContribution > 0) {
                assetsPostTax += savingsContribution;
            }

            // Calculate Tax Bill
            const ordinaryIncome = laborIncome + withdrawnPreTax + (socialSecurity * 0.85);
            const standardDeduction = federalTaxData.standard_deduction[this.inputs.filingStatus];

            const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

            const fedTax = this.calculateFederalTax(taxableOrdinaryIncome, this.inputs.filingStatus);
            const stateTax = this.calculateStateTax(taxableOrdinaryIncome, this.inputs.state);

            const totalIncomeForCapGains = taxableOrdinaryIncome + realizedGains;
            const capGainsTax = this.calculateCapitalGainsTax(totalIncomeForCapGains, realizedGains, this.inputs.filingStatus);

            taxes = fedTax + stateTax + capGainsTax;

            // Pay Taxes (prefer Post-Tax, then Pre-Tax, then Roth)
            if (assetsPostTax >= taxes) {
                assetsPostTax -= taxes;
            } else {
                let remainingTax = taxes - assetsPostTax;
                assetsPostTax = 0;

                if (assetsPreTax >= remainingTax) {
                     assetsPreTax -= remainingTax;
                } else {
                     remainingTax -= assetsPreTax;
                     assetsPreTax = 0;
                     assetsRoth -= remainingTax;
                }
            }

            // 6. Growth
            const growthPre = assetsPreTax * this.returnRate;
            const growthPost = assetsPostTax * this.returnRate;
            const growthRoth = assetsRoth * this.returnRate;
            const growthHSA = assetsHSA * this.returnRate;

            assetsPreTax += growthPre;
            assetsPostTax += growthPost;
            assetsRoth += growthRoth;
            assetsHSA += growthHSA;

            history.push({
                year: currentYear,
                age: currentAge,
                isRetired,
                assetsStart,
                investmentGrowth: growthPre + growthPost + growthRoth + growthHSA,
                income: laborIncome + socialSecurity,
                withdrawals: withdrawnPostTax + withdrawnPreTax + withdrawnRoth + healthcarePaidByHSA,
                taxes,
                healthcare,
                expenses,
                assetsEnd: assetsPreTax + assetsPostTax + assetsRoth + assetsHSA
            });

            if (assetsPreTax + assetsPostTax + assetsRoth + assetsHSA < 0) {
                break;
            }

            currentYear++;
            currentAge++;
        }

        const isSolvent = history[history.length - 1].assetsEnd >= 0 && history[history.length - 1].age >= this.inputs.lifeExpectancy;

        let solventDate = null;
        if (!isSolvent) {
            const failYear = history.find(h => h.assetsEnd < 0);
            if (failYear) {
                solventDate = new Date(failYear.year, 0, 1);
            } else {
                 solventDate = new Date(currentYear, 0, 1);
            }
        }

        return {
            isSolvent,
            solventDate,
            finalNetWorth: history[history.length-1].assetsEnd,
            history
        };
    }
}
