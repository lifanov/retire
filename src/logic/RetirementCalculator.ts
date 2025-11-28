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

    private calculateTaxForStructure(amount: number, taxConfig: any): number {
        if (!taxConfig || taxConfig.type === 'none') return 0;
        if (amount <= 0) return 0;

        if (taxConfig.type === 'flat') {
            return amount * (taxConfig.rate || 0);
        }

        if (taxConfig.type === 'progressive' && taxConfig.brackets) {
            let tax = 0;
            const brackets = taxConfig.brackets;
            for (let i = 0; i < brackets.length; i++) {
                const current = brackets[i];
                const next = brackets[i+1];
                const max = next ? next.min : Infinity;

                if (amount > current.min) {
                    const taxableInBracket = Math.min(amount, max) - current.min;
                    tax += taxableInBracket * current.rate;
                }
            }
            return tax;
        }

        return 0;
    }

    private calculateStateTax(ordinaryIncome: number, capitalGains: number, stateCode: string): number {
        const stateData = stateTaxData[stateCode];
        if (!stateData) return 0;

        const capGainsConfig = stateData.capital_gains_tax;

        // If no specific cap gains config, or set to same_as_income, combine them
        if (!capGainsConfig || capGainsConfig.type === 'same_as_income') {
            const totalTaxable = ordinaryIncome + capitalGains;
            return this.calculateTaxForStructure(totalTaxable, stateData.income_tax);
        }

        // Otherwise calculate separately
        const incomeTax = this.calculateTaxForStructure(ordinaryIncome, stateData.income_tax);
        const capGainsTax = this.calculateTaxForStructure(capitalGains, capGainsConfig);

        return incomeTax + capGainsTax;
    }

    private calculateHealthcareCost(age: number, currentYear: number, stateCode: string): number {
        let annualCost = 0;
        const yearsPassed = currentYear - new Date().getFullYear();
        const inflationFactor = Math.pow(1 + this.healthcareInflationRate, yearsPassed);

        if (age >= CONSTANTS.MEDICARE_AGE) {
            annualCost = healthcareDataRaw.medicare_annual_cost.total * inflationFactor;
        } else {
            const stateMultiplier = (healthcareDataRaw.state_multipliers as Record<string, number>)[stateCode] || 1.0;

            // Base Premium
            const basePremium = healthcareDataRaw.pre_medicare_annual_cost.base
                * (1 + (age * healthcareDataRaw.pre_medicare_annual_cost.age_multiplier))
                * stateMultiplier
                * inflationFactor;

            // Deductible (also inflated)
            const deductible = ((healthcareDataRaw.pre_medicare_annual_cost as any).deductible || 0) * inflationFactor;

            annualCost = basePremium + deductible;
        }

        return annualCost;
    }

    public simulate(): SimulationResult {
        const history: YearLog[] = [];
        let currentYear = new Date().getFullYear();
        let currentAge = this.inputs.currentAge;

        let assetsCash = this.inputs.savingsCash;
        let assetsPreTax = this.inputs.savingsPreTax;
        let assetsPostTax = this.inputs.investmentsPostTax;
        let assetsRoth = this.inputs.savingsRoth;
        let assetsHSA = this.inputs.savingsHSA;

        while (currentAge <= this.inputs.lifeExpectancy) {
            const isRetired = currentAge >= this.inputs.retirementAge;
            const assetsStart = assetsCash + assetsPreTax + assetsPostTax + assetsRoth + assetsHSA;

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

            // Cash Interest (Yield) is treated as Ordinary Income
            // Assuming Cash yields Inflation Rate
            const cashYield = assetsCash * this.inflationRate;
            // Note: We add this to ordinaryIncome for tax purposes.
            // We also add it to the asset balance in step 6 (Growth).

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
            const totalFixedIncome = laborIncome + socialSecurity; // We exclude cashYield here as it's retained in the asset until withdrawal?
            // Actually, interest is income available to spend.
            // If we don't spend it, it compounds.
            // Let's assume we use the cashYield to pay expenses first?
            // Or simpler: We calculate `withdrawalNeeded`.
            // The `cashYield` is "Growth".
            // Taxes are calculated on `cashYield` regardless.

            let withdrawalNeeded = Math.max(0, grossNeeds - totalFixedIncome);
            let savingsContribution = Math.max(0, totalFixedIncome - grossNeeds);

            let taxes = 0;

            let withdrawnCash = 0;
            let withdrawnPreTax = 0;
            let withdrawnPostTax = 0;
            let withdrawnRoth = 0;
            let realizedGains = 0;

            // Withdrawal Order: Cash -> Investments (Post-Tax) -> Pre-Tax -> Roth
            if (withdrawalNeeded > 0) {
                // Take from Cash
                if (assetsCash > withdrawalNeeded) {
                    withdrawnCash = withdrawalNeeded;
                    assetsCash -= withdrawalNeeded;
                } else {
                    withdrawnCash = assetsCash;
                    withdrawalNeeded -= assetsCash;
                    assetsCash = 0;

                    // Take from Investments (Post-Tax)
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
            }

            if (savingsContribution > 0) {
                // Add to Investments Post Tax (Taxable)
                assetsPostTax += savingsContribution;
            }

            // Calculate Tax Bill
            // Ordinary Income includes Cash Yield (Interest)
            const ordinaryIncome = laborIncome + withdrawnPreTax + (socialSecurity * 0.85) + cashYield;
            const standardDeduction = federalTaxData.standard_deduction[this.inputs.filingStatus];

            const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

            const fedTax = this.calculateFederalTax(taxableOrdinaryIncome, this.inputs.filingStatus);

            // State Tax now includes Capital Gains explicitly
            const stateTax = this.calculateStateTax(taxableOrdinaryIncome, realizedGains, this.inputs.state);

            const totalIncomeForCapGains = taxableOrdinaryIncome + realizedGains;
            const capGainsTax = this.calculateCapitalGainsTax(totalIncomeForCapGains, realizedGains, this.inputs.filingStatus);

            taxes = fedTax + stateTax + capGainsTax;

            // Pay Taxes (prefer Cash, then Post-Tax, then Pre-Tax, then Roth)
            if (assetsCash >= taxes) {
                assetsCash -= taxes;
            } else {
                let remainingTax = taxes - assetsCash;
                assetsCash = 0;

                if (assetsPostTax >= remainingTax) {
                    assetsPostTax -= remainingTax;
                } else {
                    remainingTax -= assetsPostTax;
                    assetsPostTax = 0;

                    if (assetsPreTax >= remainingTax) {
                        assetsPreTax -= remainingTax;
                    } else {
                        remainingTax -= assetsPreTax;
                        assetsPreTax = 0;
                        assetsRoth -= remainingTax;
                    }
                }
            }

            // 6. Growth
            const growthCash = cashYield; // Already calculated: assetsCash * inflationRate
            const growthPre = assetsPreTax * this.returnRate;
            const growthPost = assetsPostTax * this.returnRate;
            const growthRoth = assetsRoth * this.returnRate;
            const growthHSA = assetsHSA * this.returnRate;

            assetsCash += growthCash;
            assetsPreTax += growthPre;
            assetsPostTax += growthPost;
            assetsRoth += growthRoth;
            assetsHSA += growthHSA;

            history.push({
                year: currentYear,
                age: currentAge,
                isRetired,
                assetsStart,
                investmentGrowth: growthCash + growthPre + growthPost + growthRoth + growthHSA,
                income: laborIncome + socialSecurity + cashYield,
                withdrawals: withdrawnCash + withdrawnPostTax + withdrawnPreTax + withdrawnRoth + healthcarePaidByHSA,
                taxes,
                healthcare,
                expenses,
                assetsEnd: assetsCash + assetsPreTax + assetsPostTax + assetsRoth + assetsHSA
            });

            if (assetsCash + assetsPreTax + assetsPostTax + assetsRoth + assetsHSA < 0) {
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
