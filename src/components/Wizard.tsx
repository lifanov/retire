import React from 'react';
import { Input, Select } from './UI';
import stateTaxDataRaw from '../data/state_tax_config.json';
import type { FilingStatus } from '../logic/types';

const STATE_OPTIONS = Object.keys(stateTaxDataRaw).map(k => ({ value: k, label: (stateTaxDataRaw as any)[k].name }));

const FILING_STATUS_OPTIONS: { value: FilingStatus, label: string }[] = [
    { value: 'single', label: 'Single' },
    { value: 'married_jointly', label: 'Married Filing Jointly' },
    { value: 'married_separately', label: 'Married Filing Separately' },
    { value: 'head_of_household', label: 'Head of Household' }
];

export interface WizardData {
    targetDate: string;
    currentAge: number;
    state: string;
    filingStatus: FilingStatus;
    annualIncome: number;
    annualExpenses: number;
    savingsPreTax: number;
    savingsPostTax: number;
    savingsRoth: number;
    savingsHSA: number;
    ssEstimate: number;
    step: number;
}

export const DEFAULT_WIZARD_DATA: WizardData = {
    targetDate: '',
    currentAge: 30,
    state: 'CA',
    filingStatus: 'single',
    annualIncome: 60000,
    annualExpenses: 40000,
    savingsPreTax: 0,
    savingsPostTax: 0,
    savingsRoth: 0,
    savingsHSA: 0,
    ssEstimate: 20000,
    step: 0
};

interface Props {
    data: WizardData;
    setData: (d: WizardData) => void;
    onComplete: () => void;
}

const StartOverLink: React.FC<{ setData: (d: WizardData) => void }> = ({ setData }) => (
    <button
        onClick={() => setData(DEFAULT_WIZARD_DATA)}
        className="absolute top-4 right-6 text-xs text-gray-400 hover:text-gray-600 underline"
    >
        Start Over
    </button>
);

const Wrapper: React.FC<{ children: React.ReactNode; setData: (d: WizardData) => void }> = ({ children, setData }) => (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded relative">
        <StartOverLink setData={setData} />
        {children}
    </div>
);

export const Wizard: React.FC<Props> = ({ data, setData, onComplete }) => {
    const update = (field: keyof WizardData, value: any) => {
        setData({ ...data, [field]: value });
    };

    const next = () => update('step', data.step + 1);

    // Step 0: Target Date
    if (data.step === 0) {
        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">When do you want to retire?</h2>
                <Input
                    label="Target Retirement Date"
                    type="date"
                    value={data.targetDate}
                    onChange={e => update('targetDate', e.target.value)}
                />
                <button
                    disabled={!data.targetDate}
                    onClick={next}
                    className="w-full bg-blue-600 text-white p-3 rounded disabled:opacity-50"
                >
                    Next
                </button>
            </Wrapper>
        );
    }

    // Step 1: Personal Info
    if (data.step === 1) {
        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">Tell us about yourself</h2>
                <Input
                    label="Current Age"
                    type="number"
                    value={data.currentAge}
                    onChange={e => update('currentAge', parseInt(e.target.value))}
                />
                <Select
                    label="State of Residence (for taxes)"
                    options={STATE_OPTIONS}
                    value={data.state}
                    onChange={e => update('state', e.target.value)}
                />
                <button onClick={next} className="w-full bg-blue-600 text-white p-3 rounded">Next</button>
            </Wrapper>
        );
    }

    // Step 2: Tax Filing Status (New Step)
    if (data.step === 2) {
        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">Tax Filing Status</h2>
                <Select
                    label="Filing Status"
                    options={FILING_STATUS_OPTIONS}
                    value={data.filingStatus}
                    onChange={e => update('filingStatus', e.target.value)}
                />
                <button onClick={next} className="w-full bg-blue-600 text-white p-3 rounded mt-4">Next</button>
            </Wrapper>
        );
    }

    // Step 3: Financials
    if (data.step === 3) {
        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">Financial Situation</h2>
                <Input
                    label="Annual Household Income ($)"
                    type="number"
                    value={data.annualIncome}
                    onChange={e => update('annualIncome', parseFloat(e.target.value))}
                />
                <Input
                    label="Annual Spending / Expenses ($)"
                    type="number"
                    value={data.annualExpenses}
                    onChange={e => update('annualExpenses', parseFloat(e.target.value))}
                />
                <button onClick={next} className="w-full bg-blue-600 text-white p-3 rounded">Next</button>
            </Wrapper>
        );
    }

    // Step 4: Assets Breakdown
    if (data.step === 4) {
        // Local state for total savings fallback
        const [totalSavings, setTotalSavings] = React.useState<number | ''>(
            (data.savingsPreTax + data.savingsPostTax + (data.savingsRoth || 0)) || ''
        );
        const [showBreakdown, setShowBreakdown] = React.useState(true);
        const [hsaInput, setHsaInput] = React.useState<number | ''>(data.savingsHSA || '');
        const [skipHSA, setSkipHSA] = React.useState(data.savingsHSA === 0);
        const [error, setError] = React.useState<string | null>(null);

        const handleTotalChange = (val: number | '') => {
            setTotalSavings(val);
            setError(null);
            if (typeof val === 'number') {
                // Default Split: 30% Pre, 30% Roth, 40% Post
                const pre = val * 0.30;
                const roth = val * 0.30;
                const post = val * 0.40;

                // Batch update
                setData({
                    ...data,
                    savingsPreTax: pre,
                    savingsPostTax: post,
                    savingsRoth: roth
                });
            }
        };

        const resetSplit = () => {
             if (typeof totalSavings === 'number') {
                 const pre = totalSavings * 0.30;
                 const roth = totalSavings * 0.30;
                 const post = totalSavings * 0.40;
                 // Batch update
                 setData({
                    ...data,
                    savingsPreTax: pre,
                    savingsPostTax: post,
                    savingsRoth: roth
                 });
                 setError(null);
             }
        };

        const handleNext = () => {
             // Validation: Pre + Roth + Post must match Total (if Total is used)
             if (typeof totalSavings === 'number' && totalSavings > 0) {
                 const sum = data.savingsPreTax + data.savingsPostTax + (data.savingsRoth || 0);
                 if (Math.abs(sum - totalSavings) > 1) { // Epsilon for float math
                     setError(`Your breakdown ($${Math.round(sum)}) does not match your total ($${totalSavings}).`);
                     return;
                 }
             }

             // Fix: Combined update to avoid stale closure issues with multiple setState calls
             let newHSA = 0;
             if (!skipHSA && hsaInput !== '') {
                 newHSA = typeof hsaInput === 'number' ? hsaInput : parseFloat(hsaInput);
             }

             setError(null);
             setData({
                 ...data,
                 savingsHSA: newHSA,
                 step: data.step + 1
             });
        };

        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">Current Savings</h2>

                <div className="mb-6">
                     <p className="mb-2 text-sm text-gray-600">Total Savings Estimate (Optional)</p>
                     <input
                        type="number"
                        className="w-full border border-gray-300 rounded p-2"
                        placeholder="Total Amount"
                        value={totalSavings}
                        onChange={e => handleTotalChange(parseFloat(e.target.value) || '')}
                     />
                </div>

                <div className="mb-4 border-t pt-4">
                    <button
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        className="text-blue-600 text-sm underline mb-4"
                    >
                        {showBreakdown ? "Hide Breakdown" : "Show Breakdown"}
                    </button>

                    {showBreakdown && (
                        <div>
                            <Input
                                label="Pre-Tax Savings (401k, Traditional IRA)"
                                type="number"
                                value={data.savingsPreTax}
                                onChange={e => { update('savingsPreTax', parseFloat(e.target.value) || 0); setError(null); }}
                            />
                            <Input
                                label="Roth Savings (Roth IRA, Roth 401k)"
                                type="number"
                                value={data.savingsRoth}
                                onChange={e => { update('savingsRoth', parseFloat(e.target.value) || 0); setError(null); }}
                            />
                            <Input
                                label="Post-Tax / Taxable (Brokerage, Bank)"
                                type="number"
                                value={data.savingsPostTax}
                                onChange={e => { update('savingsPostTax', parseFloat(e.target.value) || 0); setError(null); }}
                            />

                            <div className="mt-4 pt-4 border-t">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">HSA Balance</h3>
                                {!skipHSA ? (
                                    <>
                                        <Input
                                            label="Health Savings Account ($)"
                                            type="number"
                                            value={hsaInput}
                                            onChange={e => setHsaInput(parseFloat(e.target.value) || '')}
                                        />
                                        <button onClick={() => setSkipHSA(true)} className="text-sm text-gray-500 underline">Skip / I don't have one</button>
                                    </>
                                ) : (
                                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                        <span className="text-sm text-gray-500">Skipped (Assumed $0)</span>
                                        <button onClick={() => setSkipHSA(false)} className="text-sm text-blue-600 underline">Edit</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-200">
                        <p className="text-sm font-bold mb-2">{error}</p>
                        <button
                            onClick={resetSplit}
                            className="text-xs bg-white border border-red-300 px-2 py-1 rounded hover:bg-red-50"
                        >
                            Reset to Default Split (30% Pre / 30% Roth / 40% Post)
                        </button>
                    </div>
                )}

                <div className="flex gap-2 mt-6">
                    <button onClick={handleNext} className="flex-1 bg-blue-600 text-white p-3 rounded">
                        Next
                    </button>
                </div>
            </Wrapper>
        );
    }

    // Step 5: Social Security
    if (data.step === 5) {
        return (
            <Wrapper setData={setData}>
                <h2 className="text-2xl font-bold mb-4">Social Security</h2>
                <p className="mb-4 text-sm text-gray-500">Estimate your annual benefit at age 67. You can find this on ssa.gov.</p>
                <Input
                    label="Estimated Annual Benefit ($)"
                    type="number"
                    value={data.ssEstimate}
                    onChange={e => update('ssEstimate', parseFloat(e.target.value))}
                />
                <div className="flex gap-2">
                    <button onClick={onComplete} className="flex-1 bg-green-600 text-white p-3 rounded font-bold">Calculate</button>
                    <button onClick={onComplete} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded">Skip (Use Estimate)</button>
                </div>
            </Wrapper>
        );
    }

    return null;
};
