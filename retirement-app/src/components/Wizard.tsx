import React from 'react';
import { Input, Select } from './UI';
import stateTaxDataRaw from '../data/state_tax_config.json';

const STATE_OPTIONS = Object.keys(stateTaxDataRaw).map(k => ({ value: k, label: (stateTaxDataRaw as any)[k].name }));

export interface WizardData {
    targetDate: string;
    currentAge: number;
    state: string;
    annualIncome: number;
    annualExpenses: number;
    savingsPreTax: number;
    savingsPostTax: number;
    ssEstimate: number;
    step: number;
}

export const DEFAULT_WIZARD_DATA: WizardData = {
    targetDate: '',
    currentAge: 30,
    state: 'CA',
    annualIncome: 60000,
    annualExpenses: 40000,
    savingsPreTax: 0,
    savingsPostTax: 0,
    ssEstimate: 20000,
    step: 0
};

interface Props {
    data: WizardData;
    setData: (d: WizardData) => void;
    onComplete: () => void;
}

export const Wizard: React.FC<Props> = ({ data, setData, onComplete }) => {
    const update = (field: keyof WizardData, value: any) => {
        setData({ ...data, [field]: value });
    };

    const next = () => update('step', data.step + 1);

    // Step 0: Target Date
    if (data.step === 0) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
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
            </div>
        );
    }

    // Step 1: Personal Info
    if (data.step === 1) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
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
            </div>
        );
    }

    // Step 2: Financials
    if (data.step === 2) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
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
            </div>
        );
    }

    // Step 3: Assets Breakdown
    if (data.step === 3) {
        // Local state for total savings fallback
        const [totalSavings, setTotalSavings] = React.useState<number | ''>('');
        const [showBreakdown, setShowBreakdown] = React.useState(true);

        const handleSkipBreakdown = () => {
            if (typeof totalSavings === 'number' && totalSavings > 0) {
                // Apply default 50/50 split
                const split = totalSavings / 2;
                setData({
                    ...data,
                    savingsPreTax: split,
                    savingsPostTax: split,
                    step: data.step + 1
                });
            } else {
                next();
            }
        };

        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
                <h2 className="text-2xl font-bold mb-4">Current Savings</h2>

                <div className="mb-6">
                     <p className="mb-2 text-sm text-gray-600">Total Savings Estimate (Optional)</p>
                     <input
                        type="number"
                        className="w-full border border-gray-300 rounded p-2"
                        placeholder="Total Amount"
                        value={totalSavings}
                        onChange={e => setTotalSavings(parseFloat(e.target.value) || '')}
                     />
                </div>

                <div className="mb-4 border-t pt-4">
                    <button
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        className="text-blue-600 text-sm underline mb-4"
                    >
                        {showBreakdown ? "I don't know the breakdown (Hide)" : "I know the breakdown (Show)"}
                    </button>

                    {showBreakdown && (
                        <div>
                            <Input
                                label="Pre-Tax Savings (401k, Traditional IRA)"
                                type="number"
                                value={data.savingsPreTax}
                                onChange={e => update('savingsPreTax', parseFloat(e.target.value))}
                            />
                            <Input
                                label="Post-Tax Savings (Brokerage, Bank)"
                                type="number"
                                value={data.savingsPostTax}
                                onChange={e => update('savingsPostTax', parseFloat(e.target.value))}
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {showBreakdown ? (
                        <button onClick={next} className="flex-1 bg-blue-600 text-white p-3 rounded">Next</button>
                    ) : (
                         <button onClick={handleSkipBreakdown} className="flex-1 bg-blue-600 text-white p-3 rounded">Next (Apply Defaults)</button>
                    )}
                </div>
            </div>
        );
    }

    // Step 4: Social Security
    if (data.step === 4) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
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
            </div>
        );
    }

    return null;
};
