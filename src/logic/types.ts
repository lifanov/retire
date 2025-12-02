// Types for our calculation logic

export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household';

export interface TaxData {
    year?: number; // Made optional as it's not strictly used in logic, but good for metadata
    standard_deduction: {
        single: number;
        married_filing_jointly: number;
        married_filing_separately: number;
        head_of_household: number;
    };
    brackets: {
        single: { rate: number; min: number; max: number | null }[];
        married_filing_jointly: { rate: number; min: number; max: number | null }[];
        married_filing_separately: { rate: number; min: number; max: number | null }[];
        head_of_household: { rate: number; min: number; max: number | null }[];
    };
    capital_gains: {
        single: { rate: number; min: number; max: number | null }[];
        married_filing_jointly: { rate: number; min: number; max: number | null }[];
        married_filing_separately: { rate: number; min: number; max: number | null }[];
        head_of_household: { rate: number; min: number; max: number | null }[];
    };
}

export interface StateTaxData {
    name: string;
    standard_deduction: {
        single: number;
        married_filing_jointly: number;
        married_filing_separately: number;
        head_of_household: number;
    };
    income_tax: {
        type: 'none' | 'flat' | 'progressive';
        rate?: number;
        brackets?: { rate: number; min: number }[];
        note?: string;
    };
    capital_gains_tax?: {
        type: 'none' | 'flat' | 'progressive' | 'same_as_income';
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
    savingsCash: number; // Cash / HYSA
    savingsPreTax: number;
    investmentsPostTax: number; // Taxable brokerage (Renamed from savingsPostTax)
    savingsRoth: number; // Tax Free
    savingsHSA: number; // Health Savings Account (Tax Free for Healthcare)

    annualIncome: number;
    annualExpenses: number;

    // Social Security
    socialSecurityAt67: number;
    socialSecurityStartAge: number; // User can tweak this

    // Location & Tax
    state: string; // "CA", "TX", etc.
    filingStatus: FilingStatus;

    // Assumptions
    inflationRate?: number;
    returnRate?: number;
    healthcareInflationRate?: number;
    taxBracketInflationRate?: number; // User tweakable now, defaults to tax_rules constant
    capitalGainsBasisStart?: number; // 0.0 to 1.0 (default 0.9)
    capitalGainsBasisEnd?: number; // 0.0 to 1.0 (default 0.1)
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
    cashBalance: number; // Added for debugging/validation
}

// Defaults
export const CONSTANTS = {
    INFLATION: 0.03,
    RETURN_RATE: 0.07,
    HEALTHCARE_INFLATION: 0.05,
    MEDICARE_AGE: 65,
    SS_FULL_AGE: 67
};
