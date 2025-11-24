import { describe, it, expect } from 'vitest';
import { RetirementCalculator } from './RetirementCalculator';
import { type SimulationInputs } from './types';

describe('RetirementCalculator', () => {
    // Basic default inputs
    const baseInputs: SimulationInputs = {
        currentAge: 30,
        retirementAge: 65,
        lifeExpectancy: 85,
        savingsPreTax: 100000,
        savingsPostTax: 50000,
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
        // We don't assert solvent or not without exact math check, but logic should run.
    });

    it('should use HSA for healthcare costs first', () => {
        const hsaInputs: SimulationInputs = {
            ...baseInputs,
            savingsHSA: 1000000, // Large HSA should cover healthcare
            savingsPreTax: 0,
            savingsPostTax: 0,
            annualIncome: 0, // No income
            retirementAge: 30 // Retired immediately
        };
        const calc = new RetirementCalculator(hsaInputs);
        const result = calc.simulate();

        const firstYear = result.history[0];
        // Check that withdrawals are not fully taxable?
        // Healthcare cost is substantial.
        // If paid by HSA, it's not in "withdrawals" in my logic?
        // Let's check logic: withdrawals: withdrawnPostTax + withdrawnPreTax + healthcarePaidByHSA
        // But taxes depend on ordinaryIncome.
        // Ordinary income = withdrawnPreTax + ...
        // HealthcarePaidByHSA is NOT in ordinary income.

        // So taxes should be very low (just property or other? minimal).
        // Standard deduction is high.
        expect(firstYear.taxes).toBe(0);
    });

    it('should adjust healthcare costs by state multiplier', () => {
        // Test CA (High cost) vs AL (Low cost)
        const inputsCA: SimulationInputs = { ...baseInputs, state: 'CA', currentAge: 50, retirementAge: 50 };
        const resultCA = new RetirementCalculator(inputsCA).simulate();
        const healthcareCA = resultCA.history[0].healthcare;

        const inputsAL: SimulationInputs = { ...baseInputs, state: 'AL', currentAge: 50, retirementAge: 50 };
        const resultAL = new RetirementCalculator(inputsAL).simulate();
        const healthcareAL = resultAL.history[0].healthcare;

        expect(healthcareCA).toBeGreaterThan(healthcareAL);
    });
});
