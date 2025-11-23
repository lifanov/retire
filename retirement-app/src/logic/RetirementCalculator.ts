import { type SimulationInputs, type SimulationResult, type YearLog, CONSTANTS, type TaxData, type StateTaxData } from './types';
import federalTaxDataRaw from '../data/federal_tax_data.json';
import stateTaxDataRaw from '../data/state_tax_config.json';
import healthcareDataRaw from '../data/healthcare_data.json';

const federalTaxData = federalTaxDataRaw as TaxData;
const stateTaxData = stateTaxDataRaw as Record<string, StateTaxData>;

export class RetirementCalculator {
    private inputs: SimulationInputs;

    constructor(inputs: SimulationInputs) {
        this.inputs = inputs;
    }

    private calculateFederalTax(taxableIncome: number, filingStatus: 'single' = 'single'): number {
        if (taxableIncome <= 0) return 0;

        const brackets = federalTaxData.brackets[filingStatus];
        let tax = 0;

        // Simplified bracket calculation
        // This is a rough marginal tax calc.
        for (const bracket of brackets) {
            if (taxableIncome > bracket.min) {
                const taxableAmountInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
                tax += taxableAmountInBracket * bracket.rate;
            }
        }
        return tax;
    }

    private calculateStateTax(taxableIncome: number, stateCode: string): number {
        const stateData = stateTaxData[stateCode];
        if (!stateData || stateData.income_tax.type === 'none') return 0;

        if (stateData.income_tax.type === 'flat') {
            return taxableIncome * (stateData.income_tax.rate || 0);
        }

        if (stateData.income_tax.type === 'progressive' && stateData.income_tax.brackets) {
            let tax = 0;
            // Iterate brackets. Note: State JSON format has {rate, min}, assuming sorted asc.
            // Logic: standard marginal calculation
            const brackets = stateData.income_tax.brackets;
            for (let i = 0; i < brackets.length; i++) {
                const current = brackets[i];
                const next = brackets[i+1];
                const max = next ? next.min : Infinity; // The next bracket's min is this bracket's max

                if (taxableIncome > current.min) {
                    const taxableInBracket = Math.min(taxableIncome, max) - current.min;
                    tax += taxableInBracket * current.rate;
                }
            }
            return tax;
        }

        return 0;
    }

    private calculateHealthcareCost(age: number, currentYear: number): number {
        // Base costs in 2024 dollars
        let baseCost = 0;
        if (age >= CONSTANTS.MEDICARE_AGE) {
            baseCost = healthcareDataRaw.medicare_annual_cost.total;
        } else {
            // Private insurance estimate
            baseCost = healthcareDataRaw.pre_medicare_annual_cost.base * (1 + (age * healthcareDataRaw.pre_medicare_annual_cost.age_multiplier));
        }

        // Adjust for healthcare inflation from start year (assume 2024 start)
        const yearsPassed = currentYear - new Date().getFullYear();
        return baseCost * Math.pow(1 + CONSTANTS.HEALTHCARE_INFLATION, yearsPassed);
    }

    public simulate(): SimulationResult {
        const history: YearLog[] = [];
        let currentYear = new Date().getFullYear();
        let currentAge = this.inputs.currentAge;

        let assetsPreTax = this.inputs.savingsPreTax;
        let assetsPostTax = this.inputs.savingsPostTax;

        // Loop until Life Expectancy
        while (currentAge <= this.inputs.lifeExpectancy) {
            const isRetired = currentAge >= this.inputs.retirementAge;
            const assetsStart = assetsPreTax + assetsPostTax;

            // 1. Determine Income (Inflows)
            let laborIncome = 0;
            let socialSecurity = 0;

            if (!isRetired) {
                // Adjust salary for inflation? Let's assume salary matches inflation (real 0% growth) or user inputs nominal?
                // Standard: Salary grows with inflation.
                laborIncome = this.inputs.annualIncome * Math.pow(1 + CONSTANTS.INFLATION, currentYear - new Date().getFullYear());
            } else {
                // Social Security
                // Start whenever the user defined start age is reached (default 67)
                if (currentAge >= this.inputs.socialSecurityStartAge) {
                    // Adjust benefit based on start age vs 67?
                    // For simplicity, we use the input amount as the amount at start age,
                    // OR we assume the input is "Amount at 67" and we adjust it?
                    // The prompt asked "ask for estimated SS benefits at retirement age (67)... model should let user tweak this age".
                    // Usually, taking it early reduces it. Taking it late increases it.
                    // Let's implement a simple actuarial adjustment: +/- 8% per year from 67.

                    let benefit = this.inputs.socialSecurityAt67;
                    const variance = this.inputs.socialSecurityStartAge - 67;
                    // Approx 6.7% reduction per year early, 8% increase per year late.
                    // Let's use a standard 7% estimate for simplicity or just apply the logic.
                    // Early: -0.06 per year?
                    // Let's stick to a simplified multiplier:

                    if (variance !== 0) {
                        // If variance is -5 (age 62), benefit is ~70% of 67. (-30%) -> 6% per year approx.
                        // If variance is +3 (age 70), benefit is ~124% of 67. (+24%) -> 8% per year.
                        const adjustmentRate = variance < 0 ? 0.06 : 0.08;
                        benefit = benefit * (1 + (variance * adjustmentRate));
                    }

                    socialSecurity = benefit * Math.pow(1 + CONSTANTS.INFLATION, currentYear - new Date().getFullYear());
                }
            }

            // 2. Determine Expenses (Outflows)
            // Adjust for inflation
            let expenses = this.inputs.annualExpenses * Math.pow(1 + CONSTANTS.INFLATION, currentYear - new Date().getFullYear());

            // 3. Healthcare
            const healthcare = this.calculateHealthcareCost(currentAge, currentYear);

            // 4. Gross Needs
            const grossNeeds = expenses + healthcare;

            // 5. Withdrawal Strategy & Taxes
            // Strategy:
            // If Working: Income covers expenses?
            //    If Income > Needs -> Save difference.
            //    If Income < Needs -> Withdraw difference.
            // If Retired: Withdraw Needs - SS.

            let withdrawalNeeded = Math.max(0, grossNeeds - (laborIncome + socialSecurity));
            let savingsContribution = Math.max(0, (laborIncome + socialSecurity) - grossNeeds);

            let taxes = 0;

            // Calculate Taxes on Income
            // Taxable Income = Labor + Withdrawals (PreTax) + Gains (PostTax partial).
            // This is complex. Simplified Model:
            // - Labor is fully taxable.
            // - Savings Contribution goes to Pre-Tax? Or Post-Tax? Let's assume split 50/50 or all Post-Tax for simplicity of "Skip".
            // Let's assume new savings go to Post-Tax (Taxable) to be safe/conservative (worst tax case usually, except 401k match).
            // - Withdrawals:
            //   - Pull from Pre-Tax first? Or Post-Tax?
            //   - Standard advice: Taxable first, then Tax-deferred (Pre-tax).
            //   Let's drain Post-Tax first.

            let withdrawnPreTax = 0;
            let withdrawnPostTax = 0;
            let realizedGains = 0; // Part of PostTax withdrawal

            if (withdrawalNeeded > 0) {
                // Take from Post Tax
                if (assetsPostTax > withdrawalNeeded) {
                    withdrawnPostTax = withdrawalNeeded;
                    assetsPostTax -= withdrawalNeeded;
                    // Estimate Gains portion (very rough): Assume 30% of taxable withdrawal is gains?
                    // Better: Track basis? Too hard.
                    // Approximation: The older the account, the more is gains.
                    // Let's just tax 50% of withdrawals from brokerage as gains.
                    realizedGains = withdrawnPostTax * 0.5;
                } else {
                    withdrawnPostTax = assetsPostTax;
                    realizedGains = withdrawnPostTax * 0.5;
                    withdrawalNeeded -= assetsPostTax;
                    assetsPostTax = 0;

                    // Take remainder from Pre Tax
                    if (assetsPreTax > withdrawalNeeded) {
                        withdrawnPreTax = withdrawalNeeded;
                        assetsPreTax -= withdrawalNeeded;
                    } else {
                        withdrawnPreTax = assetsPreTax;
                        assetsPreTax = 0;
                        // BANKRUPT THIS YEAR (but continue to see how bad it gets?)
                        // actually, we stop later.
                    }
                }
            }

            if (savingsContribution > 0) {
                // Add to Post Tax (Simplification)
                assetsPostTax += savingsContribution;
            }

            // Calculate Tax Bill
            // Ordinary Income: Labor + WithdrawnPreTax + SocialSecurity (85% taxable approx? let's say 100% for conservatism)
            const ordinaryIncome = laborIncome + withdrawnPreTax + (socialSecurity * 0.85);
            const standardDeduction = federalTaxData.standard_deduction.single; // Assume single for now or add toggle? User didn't specify.

            const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

            const fedTax = this.calculateFederalTax(taxableOrdinaryIncome);
            const stateTax = this.calculateStateTax(taxableOrdinaryIncome, this.inputs.state);

            // Cap Gains Tax (Federal)
            // Long term cap gains bracket depends on total income.
            // Simplified: 15% if total income > 47k.
            const totalIncomeForCapGains = taxableOrdinaryIncome + realizedGains;
            let capGainsRate = 0;
            if (totalIncomeForCapGains > 47000) capGainsRate = 0.15; // 2024 approx
            if (totalIncomeForCapGains > 518900) capGainsRate = 0.20;

            const capGainsTax = realizedGains * capGainsRate;

            taxes = fedTax + stateTax + capGainsTax;

            // Deduct Taxes from Assets
            // If we are working and saving, we paid taxes from income?
            // Wait, the flow above: `savingsContribution = Income - GrossNeeds`.
            // Taxes were not in GrossNeeds.
            // So we need to subtract Taxes from Savings or increase Withdrawals.

            // Correct flow:
            // NetCash = Income - Expenses - Healthcare - Taxes.
            // But Taxes depend on NetCash (withdrawals). Circular.
            // Heuristic: Estimate tax based on Income + anticipated withdrawal, then subtract.

            // Let's adjust:
            // We already did the withdrawal logic. Now we have a tax bill.
            // We must pay this tax bill from assets.

            if (assetsPostTax >= taxes) {
                assetsPostTax -= taxes;
            } else {
                let remainingTax = taxes - assetsPostTax;
                assetsPostTax = 0;
                assetsPreTax -= remainingTax;
            }

            // 6. Growth
            // Apply return to remaining assets
            const growthPre = assetsPreTax * CONSTANTS.RETURN_RATE;
            const growthPost = assetsPostTax * CONSTANTS.RETURN_RATE;

            assetsPreTax += growthPre;
            assetsPostTax += growthPost;

            history.push({
                year: currentYear,
                age: currentAge,
                isRetired,
                assetsStart,
                investmentGrowth: growthPre + growthPost,
                income: laborIncome + socialSecurity,
                withdrawals: withdrawnPostTax + withdrawnPreTax,
                taxes,
                healthcare,
                expenses,
                assetsEnd: assetsPreTax + assetsPostTax
            });

            if (assetsPreTax + assetsPostTax < 0) {
                // Ran out of money
                break;
            }

            currentYear++;
            currentAge++;
        }

        const isSolvent = history[history.length - 1].assetsEnd >= 0 && history[history.length - 1].age >= this.inputs.lifeExpectancy;

        let solventDate = null;
        if (!isSolvent) {
            // Find the year it went negative
            const failYear = history.find(h => h.assetsEnd < 0);
            if (failYear) {
                solventDate = new Date(failYear.year, 0, 1);
            } else {
                 // Even if loop finished, if negative
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
