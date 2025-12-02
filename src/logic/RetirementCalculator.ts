import { type SimulationInputs, type SimulationResult, type YearLog, CONSTANTS, type TaxData, type StateTaxData, type FilingStatus } from './types';
import federalTaxDataRaw from '../data/federal_tax_data.json';
import stateTaxDataRaw from '../data/state_tax_config.json';
import healthcareDataRaw from '../data/healthcare_data.json';
import taxRulesRaw from '../data/tax_rules.json';
import { RMD_TABLE } from './rmd';

const federalTaxData = federalTaxDataRaw as TaxData;
const stateTaxData = stateTaxDataRaw as Record<string, StateTaxData>;
const taxRules = taxRulesRaw;

export class RetirementCalculator {
    private inputs: SimulationInputs;
    private inflationRate: number;
    private returnRate: number;
    private healthcareInflationRate: number;
    private taxBracketInflationRate: number;

    constructor(inputs: SimulationInputs) {
        this.inputs = inputs;
        this.inflationRate = inputs.inflationRate ?? CONSTANTS.INFLATION;
        this.returnRate = inputs.returnRate ?? CONSTANTS.RETURN_RATE;
        this.healthcareInflationRate = inputs.healthcareInflationRate ?? CONSTANTS.HEALTHCARE_INFLATION;
        this.taxBracketInflationRate = inputs.taxBracketInflationRate ?? taxRules.constants.TAX_BRACKET_INFLATION;
    }

    private inflate(amount: number, yearsPassed: number): number {
        return amount * Math.pow(1 + this.inflationRate, yearsPassed);
    }

    private inflateTaxBracket(amount: number, yearsPassed: number): number {
        return amount * Math.pow(1 + this.taxBracketInflationRate, yearsPassed);
    }

    // Helper to inflate tax brackets
    private getInflatedBrackets(brackets: { rate: number; min: number; max: number | null }[], yearsPassed: number) {
        return brackets.map(b => ({
            ...b,
            min: this.inflateTaxBracket(b.min, yearsPassed),
            max: b.max === null ? null : this.inflateTaxBracket(b.max, yearsPassed)
        }));
    }

    // Helper to inflate state progressive brackets
    private getInflatedStateBrackets(brackets: { rate: number; min: number }[], yearsPassed: number) {
        return brackets.map(b => ({
            ...b,
            min: this.inflateTaxBracket(b.min, yearsPassed)
        }));
    }

    private calculateFederalTax(taxableIncome: number, filingStatus: FilingStatus, yearsPassed: number): number {
        if (taxableIncome <= 0) return 0;

        const rawBrackets = federalTaxData.brackets[filingStatus];
        if (!rawBrackets) {
             console.error(`Invalid filing status: ${filingStatus}`);
             return 0;
        }

        const brackets = this.getInflatedBrackets(rawBrackets, yearsPassed);
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

    private calculateCapitalGainsTax(taxableIncomeIncludingGains: number, realizedGains: number, filingStatus: FilingStatus, yearsPassed: number): number {
        if (realizedGains <= 0) return 0;

        const rawBrackets = federalTaxData.capital_gains[filingStatus] || federalTaxData.capital_gains['single'];
        const brackets = this.getInflatedBrackets(rawBrackets, yearsPassed);

        // Cap gains stack on top of ordinary income
        // However, the rate is determined by the total taxable income level
        // Simplified Logic: Apply the rate corresponding to the bracket the income falls in
        // A more accurate logic splits the gains across brackets if it straddles them.

        let tax = 0;
        // Remaining gains to tax
        let gainsRemaining = realizedGains;
        // The "floor" where gains start stacking
        let currentStackLevel = taxableIncomeIncludingGains - realizedGains;

        for (const bracket of brackets) {
            const bracketMax = bracket.max === null ? Infinity : bracket.max;

            // Does our stack level fall below this bracket's top?
            if (currentStackLevel < bracketMax) {
                // How much room in this bracket?
                const roomInBracket = bracketMax - Math.max(currentStackLevel, bracket.min);

                if (roomInBracket > 0) {
                    const gainsInThisBracket = Math.min(gainsRemaining, roomInBracket);
                    tax += gainsInThisBracket * bracket.rate;
                    gainsRemaining -= gainsInThisBracket;
                    currentStackLevel += gainsInThisBracket;
                }
            }

            if (gainsRemaining <= 0) break;
        }

        return tax;
    }

    private calculateTaxForStructure(amount: number, taxConfig: any, yearsPassed: number): number {
        if (!taxConfig || taxConfig.type === 'none') return 0;
        if (amount <= 0) return 0;

        if (taxConfig.type === 'flat') {
            return amount * (taxConfig.rate || 0);
        }

        if (taxConfig.type === 'progressive' && taxConfig.brackets) {
            let tax = 0;
            const brackets = this.getInflatedStateBrackets(taxConfig.brackets, yearsPassed);

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

    private calculateStateTax(ordinaryIncome: number, capitalGains: number, stateCode: string, filingStatus: FilingStatus, yearsPassed: number): number {
        const stateData = stateTaxData[stateCode];
        if (!stateData) return 0;

        // Apply State Standard Deduction (Inflated)
        const rawStateStdDed = stateData.standard_deduction ? stateData.standard_deduction[filingStatus] : 0;
        const stateStdDed = this.inflate(rawStateStdDed, yearsPassed);

        // Taxable Ordinary Income for State
        const taxableOrdinaryState = Math.max(0, ordinaryIncome - stateStdDed);

        const capGainsConfig = stateData.capital_gains_tax;

        // If no specific cap gains config, or set to same_as_income, combine them
        if (!capGainsConfig || capGainsConfig.type === 'same_as_income') {
             // Actually, if it's "same as income", we just sum them and subtract deduction once.
             const totalIncome = ordinaryIncome + capitalGains;
             const totalTaxableCombined = Math.max(0, totalIncome - stateStdDed);

            return this.calculateTaxForStructure(totalTaxableCombined, stateData.income_tax, yearsPassed);
        }

        // WA Capital Gains Special Case (Excise Tax on Capital Gains only)
        // Deduction usually applies to ordinary income, unless specified.
        // For WA, the "standard deduction" in our data is 0 because they have no income tax.
        // They have a specific exemption for Cap Gains ($262k for 2024), but that's handled in the "bracket" logic
        // or we need to subtract it.
        // The data for WA cap gains in `state_tax_config.json` has brackets starting at 0 rate up to 250k.
        // So the "exemption" is baked into the progressive bracket structure (0% up to 250k).
        // So we can just pass capitalGains to calculateTaxForStructure.

        const incomeTax = this.calculateTaxForStructure(taxableOrdinaryState, stateData.income_tax, yearsPassed);
        const capGainsTax = this.calculateTaxForStructure(capitalGains, capGainsConfig, yearsPassed);

        return incomeTax + capGainsTax;
    }

    private calculateHealthcareCost(age: number, currentYear: number, stateCode: string): { total: number, deductible: number, premium: number } {
        const yearsPassed = currentYear - new Date().getFullYear();
        const inflationFactor = Math.pow(1 + this.healthcareInflationRate, yearsPassed);

        if (age >= CONSTANTS.MEDICARE_AGE) {
            const total = healthcareDataRaw.medicare_annual_cost.total * inflationFactor;
            // For Medicare, we treat the whole thing as "Premium-like" or "Medical Expense"
            // The user rule says: "Only allow HSA withdrawals for healthcare if age >= 65".
            // Actually, the rule is: "For age < 65, subtract premium from eligible HSA".
            // Meaning if >= 65, ALL cost is eligible.
            return { total, premium: 0, deductible: total }; // Treat all as eligible for HSA at 65+
        } else {
            const stateMultiplier = (healthcareDataRaw.state_multipliers as Record<string, number>)[stateCode] || 1.0;
            const preMedData = healthcareDataRaw.pre_medicare_annual_cost;

            // Base Premium
            const basePremium = preMedData.base
                * (1 + (age * preMedData.age_multiplier))
                * stateMultiplier
                * inflationFactor;

            // Deductible (also inflated)
            const deductible = (preMedData.deductible || 0) * inflationFactor;

            return {
                total: basePremium + deductible,
                premium: basePremium,
                deductible: deductible
            };
        }
    }

    private getRMD(age: number, preTaxBalance: number): number {
        // RMD starts at 73 (SECURE 2.0)
        if (age < 73 || preTaxBalance <= 0) return 0;

        const divisor = RMD_TABLE[age] || RMD_TABLE[120]; // Cap at 120
        return preTaxBalance / divisor;
    }

    private calculateTaxableSocialSecurity(socialSecurity: number, otherIncome: number, filingStatus: FilingStatus): number {
        if (socialSecurity <= 0) return 0;

        // Provisional Income = Other Income + 0.5 * Social Security
        const provisionalIncome = otherIncome + (socialSecurity * 0.5);

        const thresholds = taxRules.social_security_thresholds[filingStatus] || taxRules.social_security_thresholds.single;
        const threshold1 = thresholds.threshold1;
        const threshold2 = thresholds.threshold2;

        // Logic from IRS Worksheet
        // Tier 1: 50% taxable above Threshold 1
        // Tier 2: 85% taxable above Threshold 2

        // But it's not just stacking rates. It's:
        // Taxable = Min(
        //    0.85 * SS,
        //    Min(0.5 * SS, 0.5 * (PI - T1)) + 0.85 * (PI - T2)
        // )
        // Wait, the formula is slightly more complex.
        // Let's use the standard "bump" logic:

        let taxableAmount = 0;

        if (provisionalIncome > threshold2) {
             const amountAboveT2 = provisionalIncome - threshold2;
             const amountBetweenT1AndT2 = threshold2 - threshold1;

             // 85% of excess over T2
             // PLUS 50% of amount between T1 and T2 (or 50% of SS, whichever is less?)
             // Actually, usually it is:
             // 85% * (PI - T2) + Min(0.5 * SS, 0.5 * (T2 - T1))
             // But limited to 0.85 * SS Max.

             const tier1Taxable = Math.min(socialSecurity * 0.5, amountBetweenT1AndT2 * 0.5);
             const tier2Taxable = amountAboveT2 * 0.85;

             taxableAmount = tier1Taxable + tier2Taxable;
        } else if (provisionalIncome > threshold1) {
             taxableAmount = (provisionalIncome - threshold1) * 0.5;
        } else {
             taxableAmount = 0;
        }

        // Cap at 85% of total benefits
        return Math.min(taxableAmount, socialSecurity * 0.85);
    }

    public simulate(): SimulationResult {
        const history: YearLog[] = [];
        let currentYear = new Date().getFullYear();
        let currentAge = this.inputs.currentAge;
        // const yearsTotal = this.inputs.lifeExpectancy - this.inputs.currentAge;

        let assetsCash = this.inputs.savingsCash;
        let assetsPreTax = this.inputs.savingsPreTax;
        let assetsPostTax = this.inputs.investmentsPostTax;
        let assetsRoth = this.inputs.savingsRoth;
        let assetsHSA = this.inputs.savingsHSA;

        const capitalGainsBasisStart = this.inputs.capitalGainsBasisStart ?? 0.9;
        const capitalGainsBasisEnd = this.inputs.capitalGainsBasisEnd ?? 0.1;
        // Basis decays linearly over 30 years (or until death if shorter? Default 30 is good).
        const basisDecayDuration = 30;

        while (currentAge <= this.inputs.lifeExpectancy) {
            const yearsPassed = currentYear - new Date().getFullYear();
            const isRetired = currentAge >= this.inputs.retirementAge;
            const assetsStart = assetsCash + assetsPreTax + assetsPostTax + assetsRoth + assetsHSA;

            // --- 1. Income (Inflows) ---
            let laborIncome = 0;
            let socialSecurity = 0;

            if (!isRetired) {
                laborIncome = this.inflate(this.inputs.annualIncome, yearsPassed);
            } else {
                if (currentAge >= this.inputs.socialSecurityStartAge) {
                    let benefit = this.inputs.socialSecurityAt67;
                    const variance = this.inputs.socialSecurityStartAge - 67;
                    if (variance !== 0) {
                        const adjustmentRate = variance < 0 ? 0.0666 : 0.08; // Improved estimate for reduction
                         // Note: Simplification 6.66% per year early, 8% delayed
                        benefit = benefit * (1 + (variance * adjustmentRate));
                    }
                    socialSecurity = this.inflate(benefit, yearsPassed);
                }
            }

            // --- 2. RMDs (Forced Withdrawals) ---
            // RMD is taxable ordinary income. It forces money out of PreTax.
            // If we don't need it for expenses, it gets reinvested (later in logic).
            const rmdAmount = this.getRMD(currentAge, assetsPreTax);
            let withdrawnPreTax = rmdAmount;
            assetsPreTax -= rmdAmount;


            // --- 3. Expenses & Healthcare ---
            const baseExpenses = this.inflate(this.inputs.annualExpenses, yearsPassed);
            const hcCost = this.calculateHealthcareCost(currentAge, currentYear, this.inputs.state);
            const totalHealthcareCost = hcCost.total;

            // HSA Logic
            // If < 65, can only use HSA for 'deductible' portion (not premium).
            // If >= 65, can use for everything (we flagged 'premium' as 0 and 'deductible' as total for 65+ in helper).

            let allowedHSAWithdrawal = assetsHSA;
            if (currentAge < 65) {
                allowedHSAWithdrawal = Math.min(assetsHSA, hcCost.deductible);
            } else {
                allowedHSAWithdrawal = Math.min(assetsHSA, totalHealthcareCost);
            }

            let healthcarePaidByHSA = 0;
            // Actually pay it
            if (allowedHSAWithdrawal > 0) {
                 // We only withdraw what is needed for healthcare
                 // const needed = currentAge < 65 ? hcCost.deductible : totalHealthcareCost;
                 // But wait, the cost is the cost.
                 // If age < 65: Cost = Premium + Deductible.
                 // We can pay Deductible from HSA. Premium must come from other sources.

                 const amountToPayFromHSA = Math.min(allowedHSAWithdrawal, currentAge < 65 ? hcCost.deductible : totalHealthcareCost);
                 healthcarePaidByHSA = amountToPayFromHSA;
                 assetsHSA -= amountToPayFromHSA;
            }

            const healthcareRemaining = totalHealthcareCost - healthcarePaidByHSA;
            const grossNeeds = baseExpenses + healthcareRemaining;


            // --- 4. Withdrawal Strategy ---
            const mandatoryIncome = laborIncome + socialSecurity + withdrawnPreTax; // RMD is already out

            let withdrawalNeeded = Math.max(0, grossNeeds - mandatoryIncome);
            let surplusToReinvest = Math.max(0, mandatoryIncome - grossNeeds);

            let withdrawnCash = 0;
            let withdrawnPostTax = 0;
            let withdrawnRoth = 0;
            let realizedGains = 0;

            // Order: Cash -> PostTax -> PreTax (Voluntary) -> Roth
            if (withdrawalNeeded > 0) {
                 if (assetsCash >= withdrawalNeeded) {
                     withdrawnCash = withdrawalNeeded;
                     assetsCash -= withdrawalNeeded;
                     withdrawalNeeded = 0;
                 } else {
                     withdrawnCash = assetsCash;
                     withdrawalNeeded -= assetsCash;
                     assetsCash = 0;
                 }
            }

            if (withdrawalNeeded > 0) {
                if (assetsPostTax >= withdrawalNeeded) {
                    withdrawnPostTax = withdrawalNeeded;
                    assetsPostTax -= withdrawalNeeded;
                    withdrawalNeeded = 0;
                } else {
                    withdrawnPostTax = assetsPostTax;
                    withdrawalNeeded -= assetsPostTax;
                    assetsPostTax = 0;
                }
            }

            if (withdrawalNeeded > 0) {
                // Voluntary Pre-Tax Withdrawal
                if (assetsPreTax >= withdrawalNeeded) {
                    const extraPre = withdrawalNeeded;
                    withdrawnPreTax += extraPre; // Add to existing RMD amount
                    assetsPreTax -= extraPre;
                    withdrawalNeeded = 0;
                } else {
                    const extraPre = assetsPreTax;
                    withdrawnPreTax += extraPre;
                    assetsPreTax = 0;
                    withdrawalNeeded -= extraPre;
                }
            }

            if (withdrawalNeeded > 0) {
                 if (assetsRoth >= withdrawalNeeded) {
                     withdrawnRoth = withdrawalNeeded;
                     assetsRoth -= withdrawalNeeded;
                     withdrawalNeeded = 0;
                 } else {
                     withdrawnRoth = assetsRoth;
                     assetsRoth = 0;
                     withdrawalNeeded -= assetsRoth; // Unfunded :(
                 }
            }

            // Calculate Realized Gains on Post-Tax Withdrawals
            if (withdrawnPostTax > 0) {
                // Linear interpolation of basis
                // Year 0: Start Basis (e.g. 0.9 -> 10% gains)
                // Year 30: End Basis (e.g. 0.1 -> 90% gains)
                const progress = Math.min(1, yearsPassed / basisDecayDuration);
                const currentBasis = capitalGainsBasisStart - ((capitalGainsBasisStart - capitalGainsBasisEnd) * progress);

                realizedGains = withdrawnPostTax * (1 - currentBasis);
            }

            // Reinvest Surplus (if RMD or Income > Expenses)
            if (surplusToReinvest > 0) {
                assetsPostTax += surplusToReinvest;
                // Note: This increases the cost basis of the pool, technically.
                // But simplified model ignores basis tracking of new lots.
            }


            // --- 5. Growth ---
            // "Withdraw First, Then Grow"
            // We calculate growth on the *remaining* balances.
            // Cash Yield
            const cashYield = assetsCash * this.inflationRate;
            assetsCash += cashYield;

            // This variable is needed for logging
            const growthCash = cashYield;

            const growthPre = assetsPreTax * this.returnRate;
            assetsPreTax += growthPre;

            const growthPost = assetsPostTax * this.returnRate;
            assetsPostTax += growthPost;

            const growthRoth = assetsRoth * this.returnRate;
            assetsRoth += growthRoth;

            const growthHSA = assetsHSA * this.returnRate;
            assetsHSA += growthHSA;


            // --- 6. Taxes ---
            // Calculated on Income generated this year + Withdrawals
            // Taxable Income:
            // 1. Labor
            // 2. SS (85% taxable)
            // 3. PreTax Withdrawals (RMD + Voluntary)
            // 4. Cash Yield (Interest)
            // 5. Realized Capital Gains (Separate bucket usually, but affects brackets)

            const standardDeductionRaw = federalTaxData.standard_deduction[this.inputs.filingStatus];
            const standardDeduction = this.inflateTaxBracket(standardDeductionRaw, yearsPassed);

            const otherIncomeForSS = laborIncome + withdrawnPreTax + cashYield + realizedGains;
            const taxableSS = this.calculateTaxableSocialSecurity(socialSecurity, otherIncomeForSS, this.inputs.filingStatus);

            const ordinaryIncome = laborIncome + taxableSS + withdrawnPreTax + cashYield;
            const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);

            const fedTax = this.calculateFederalTax(taxableOrdinaryIncome, this.inputs.filingStatus, yearsPassed);
            const stateTax = this.calculateStateTax(ordinaryIncome, realizedGains, this.inputs.state, this.inputs.filingStatus, yearsPassed);

            const totalIncomeForCapGains = taxableOrdinaryIncome + realizedGains;
            const capGainsTax = this.calculateCapitalGainsTax(totalIncomeForCapGains, realizedGains, this.inputs.filingStatus, yearsPassed);

            // FICA Taxes (Labor Income only)
            // Social Security & Medicare
            // Wage Base 2025 (Inflated by general inflation rate to track wage growth)
            const ssWageBase = this.inflate(taxRules.fica_tax.ss_wage_base_2025, yearsPassed);
            const ssTax = Math.min(laborIncome, ssWageBase) * taxRules.fica_tax.social_security_rate;
            const medicareTax = laborIncome * taxRules.fica_tax.medicare_rate;
            const ficaTax = ssTax + medicareTax;

            // Early Withdrawal Penalty
            // 10% penalty on Pre-Tax withdrawals if age < 60 (approximation for 59.5)
            let earlyWithdrawalPenalty = 0;
            if (currentAge < 60 && withdrawnPreTax > 0) {
                 // Note: RMDs don't happen before 73, so withdrawnPreTax here is purely voluntary withdrawals
                 // However, we added RMD to withdrawnPreTax earlier. But since RMD age > 60, it's safe.
                 earlyWithdrawalPenalty = withdrawnPreTax * 0.10;
            }

            const totalTaxes = fedTax + stateTax + capGainsTax + ficaTax + earlyWithdrawalPenalty;


            // --- 7. Pay Taxes ---
            // We need to pay taxes from assets.
            // Order: Cash -> PostTax -> PreTax -> Roth

            let taxToPay = totalTaxes;

            if (assetsCash >= taxToPay) {
                assetsCash -= taxToPay;
                taxToPay = 0;
            } else {
                taxToPay -= assetsCash;
                assetsCash = 0;
            }

            if (taxToPay > 0) {
                if (assetsPostTax >= taxToPay) {
                    assetsPostTax -= taxToPay;
                    // Technically selling more PostTax triggers more CapGains tax?
                    // We ignore the recursive tax spiral for simplicity.
                    taxToPay = 0;
                } else {
                    taxToPay -= assetsPostTax;
                    assetsPostTax = 0;
                }
            }

            if (taxToPay > 0) {
                 // Simplified Gross Up: When paying taxes from Pre-Tax accounts,
                 // we must withdraw MORE than the tax bill to cover the tax on the withdrawal itself.
                 // We use a 1.25x factor (approx 20% effective tax rate).
                 const grossUpFactor = 1.25;
                 const grossAmount = taxToPay * grossUpFactor;

                 if (assetsPreTax >= grossAmount) {
                     assetsPreTax -= grossAmount;
                     // The difference (grossAmount - taxToPay) is effectively "withheld" for next year's tax?
                     // In this simplified model, we just burn the assets to represent the cost.
                     // The tax on this withdrawal will technically appear in next year's RMD/Income calculation
                     // if we tracked it as 'income' for next year.
                     // However, since we are in the "Pay Taxes" phase for the CURRENT year, and we already calculated taxes,
                     // this extra withdrawal is technically income for the *current* year that wasn't taxed yet.
                     // This creates the recursive loop. By burning 1.25x, we simulate the cost of that recursion
                     // without re-running the tax engine.
                     taxToPay = 0;
                 } else {
                     // If we don't have enough to pay the full grossed-up amount,
                     // we drain the account.
                     const available = assetsPreTax;
                     assetsPreTax = 0;
                     // How much tax did we actually pay?
                     // available = taxPaid * 1.25 -> taxPaid = available / 1.25
                     const taxPaid = available / grossUpFactor;
                     taxToPay -= taxPaid;
                 }
            }

            if (taxToPay > 0) {
                if (assetsRoth >= taxToPay) {
                    assetsRoth -= taxToPay;
                    taxToPay = 0;
                } else {
                     assetsRoth = 0;
                }
            }

            // Track Unpaid Expenses as Debt (Negative Cash)
            // If withdrawalNeeded > 0, it means we exhausted Cash, PostTax, PreTax, and Roth.
            if (withdrawalNeeded > 0) {
                assetsCash -= withdrawalNeeded;
                withdrawnCash += withdrawalNeeded; // Log it as withdrawn (even if debt)
                withdrawalNeeded = 0;
            }

            // --- Log History ---
            const totalAssets = assetsCash + assetsPreTax + assetsPostTax + assetsRoth + assetsHSA;
            const totalWithdrawals = withdrawnCash + withdrawnPostTax + withdrawnPreTax + withdrawnRoth + healthcarePaidByHSA;

            history.push({
                year: currentYear,
                age: currentAge,
                isRetired,
                assetsStart,
                investmentGrowth: growthCash + growthPre + growthPost + growthRoth + growthHSA,
                income: laborIncome + socialSecurity + cashYield,
                withdrawals: totalWithdrawals,
                taxes: totalTaxes,
                healthcare: totalHealthcareCost,
                expenses: baseExpenses,
                assetsEnd: totalAssets,
                cashBalance: assetsCash
            });

            if (totalAssets < 0) {
                break;
            }

            currentYear++;
            currentAge++;
        }

        const isSolvent = history.length > 0 && history[history.length - 1].assetsEnd >= 0 && history[history.length - 1].age >= this.inputs.lifeExpectancy;

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
            finalNetWorth: history.length > 0 ? history[history.length-1].assetsEnd : 0,
            history
        };
    }
}
