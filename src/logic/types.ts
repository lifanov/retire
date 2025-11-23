// Types for our calculation logic

export interface TaxData {
    year: number;
    standard_deduction: {
        single: number;
        married_jointly: number;
        head_of_household: number;
    };
    brackets: {
        single: { rate: number; min: number; max: number }[];
        married_jointly: { rate: number; min: number; max: number }[];
    };
    capital_gains: {
        single: { rate: number; min: number; max: number }[];
    };
}

export interface StateTaxData {
    name: string;
    income_tax: {
        type: 'none' | 'flat' | 'progressive';
        rate?: number;
        brackets?: { rate: number; min: number }[];
        note?: string;
    };
}

export interface SimulationInputs {
    currentAge: number;
    retirementAge: number; // Age at target date
    lifeExpectancy: number;

    // Financials
    savingsPreTax: number;
    savingsPostTax: number; // Taxable brokerage
    savingsHSA: number; // Health Savings Account (Tax Free for Healthcare)

    annualIncome: number;
    annualExpenses: number;

    // Social Security
    socialSecurityAt67: number;
    socialSecurityStartAge: number; // User can tweak this

    // Location
    state: string; // "CA", "TX", etc.
}

export interface SimulationResult {
    isSolvent: boolean;
    solventDate: Date | null; // If NO, this is the date money runs out.
    feasibleRetirementDate?: Date; // If NO, when COULD they retire? (Not implemented in pass 1)
    finalNetWorth: number;
    history: YearLog[];
}

export interface YearLog {
    year: number;
    age: number;
    isRetired: boolean;
    assetsStart: number;
    investmentGrowth: number;
    income: number; // Work or SS
    withdrawals: number;
    taxes: number;
    healthcare: number;
    expenses: number;
    assetsEnd: number;
}

// Defaults
export const CONSTANTS = {
    INFLATION: 0.03,
    RETURN_RATE: 0.07,
    HEALTHCARE_INFLATION: 0.05,
    MEDICARE_AGE: 65,
    SS_FULL_AGE: 67
};
