import { describe, it, expect } from 'vitest';
import { RetirementCalculator } from './RetirementCalculator';
import { type SimulationInputs } from './types';
import healthcareDataRaw from '../data/healthcare_data.json';

describe('RetirementCalculator', () => {
    // Basic default inputs
    const baseInputs: SimulationInputs = {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 85,
        savingsCash: 10000,
        savingsPreTax: 100000,
        investmentsPostTax: 50000,
        savingsRoth: 0,
        savingsHSA: 0,
        annualIncome: 80000,
        annualExpenses: 50000,
        socialSecurityAt67: 25000,
        socialSecurityStartAge: 67,
        state: 'CA',
        filingStatus: 'single'
    };

    it('should calculate solvent simulation correctly', () => {
        const calc = new RetirementCalculator(baseInputs);
        const result = calc.simulate();

        expect(result.history.length).toBeGreaterThan(0);
        expect(result.isSolvent).toBeDefined();
    });

    it('should grow Cash at inflation rate', () => {
        // Scenario: Only Cash. No Withdrawals (expenses covered by income).
        // Set returnRate to 0 so any surplus invested in PostTax doesn't grow.
        const inputs: SimulationInputs = {
            ...baseInputs,
            savingsCash: 100000,
            savingsPreTax: 0,
            investmentsPostTax: 0,
            annualIncome: 200000, // Cover expenses
            annualExpenses: 50000,
            inflationRate: 0.03,
            returnRate: 0
        };
        const calc = new RetirementCalculator(inputs);
        const result = calc.simulate();

        const firstYear = result.history[0];
        // Expected Cash Growth = Start * Inflation = 3000.
        // PostTax Growth = Surplus * 0 = 0.

        const expectedGrowth = 100000 * 0.03;
        expect(firstYear.investmentGrowth).toBeCloseTo(expectedGrowth, 0);
    });

    it('should include deductible in healthcare costs pre-medicare', () => {
        const inputs: SimulationInputs = {
            ...baseInputs,
            currentAge: 50,
            retirementAge: 50,
            state: 'TX' // Multiplier 1.0 (usually)
        };
        const calc = new RetirementCalculator(inputs);
        // Access private method? No, check history healthcare cost.
        const result = calc.simulate();
        const year1 = result.history[0];

        // Base Cost Calculation:
        // Base: ~6000 * (1 + 50*0.03) = 6000 * 2.5 = 15000?
        // Wait, age multiplier formula: base * (1 + (age * multiplier))
        // 6000 * (1 + (50 * 0.03)) = 6000 * (1 + 1.5) = 15000.
        // Deductible: ~5241.
        // Total ~ 20241.

        // Let's verify it's roughly in that range, definitely > 15000.
        expect(year1.healthcare).toBeGreaterThan(15000);

        // Exact check might be flaky if JSON changes, but checking "Base + Deductible" logic
        const base = healthcareDataRaw.pre_medicare_annual_cost.base;
        const ded = (healthcareDataRaw.pre_medicare_annual_cost as any).deductible;

        // We expect `healthcare` to include `ded`.
        // If we remove `ded` from expectation, it should fail.
        expect(year1.healthcare).toBeGreaterThan(base + ded);
    });

    it('should apply specific state capital gains tax', () => {
        // MA has 5% flat capital gains tax.
        // CA has same as income (progressive).

        // Scenario: High Realized Gains.
        // Retire immediately. High Expenses. Low Income.
        // Force withdrawal from Investments Post Tax.

        const inputs: SimulationInputs = {
            ...baseInputs,
            state: 'MA',
            currentAge: 60,
            retirementAge: 60,
            annualIncome: 0,
            savingsCash: 0,
            savingsPreTax: 0,
            investmentsPostTax: 1000000, // Plenty of post-tax
            annualExpenses: 100000, // Will withdraw ~100k + taxes
            filingStatus: 'single'
        };

        const calcMA = new RetirementCalculator(inputs);
        const resMA = calcMA.simulate().history[0];

        // MA Tax:
        // Ordinary Income: 0.
        // Withdraw ~100k. Realized Gains = 50k.
        // MA Cap Gains Tax = 50k * 0.05 = 2500.
        // MA Income Tax = 0.
        // Federal Tax on 50k gains (0% or 15% bracket).
        // 50k - 14600 (std ded) = 35400 taxable.
        // Cap Gains 0% up to ~44k. So Fed Tax ~ 0?

        // Let's check State Tax specifically?
        // We can't isolate State Tax in the output `taxes` field (it's summed).

        // Let's compare with a state with NO Capital Gains tax (e.g. NH or TX? TX has no income tax at all).
        // Let's use TX.
        const inputsTX = { ...inputs, state: 'TX' };
        const calcTX = new RetirementCalculator(inputsTX);
        const resTX = calcTX.simulate().history[0];

        // TX Tax should be just Federal.
        // MA Tax should be Federal + MA Cap Gains.

        expect(resMA.taxes).toBeGreaterThan(resTX.taxes);

        const taxDiff = resMA.taxes - resTX.taxes;
        // Should be roughly 5% of realized gains (50k) = 2500.
        // Depending on withdrawal amount iteration (taxes increase withdrawal needed).
        expect(taxDiff).toBeGreaterThan(2000);
        expect(taxDiff).toBeLessThan(4000);
    });
});
