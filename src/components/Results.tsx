import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type WizardData } from './Wizard';
import { RetirementCalculator } from '../logic/RetirementCalculator';
import { CONSTANTS, type SimulationInputs, type SimulationResult, type StateTaxData } from '../logic/types';
import { Select } from './UI';

import stateTaxDataRaw from '../data/state_tax_config.json';
import healthcareDataRaw from '../data/healthcare_data.json';
import federalTaxDataRaw from '../data/federal_tax_data.json';

const STATE_OPTIONS = Object.keys(stateTaxDataRaw).map(k => ({ value: k, label: (stateTaxDataRaw as any)[k].name }));

interface Props {
    initialData: WizardData;
    onReset: () => void;
}

const SliderRow: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (val: number) => void;
    format?: (val: number) => string;
}> = ({ label, value, min, max, step=1, onChange, format }) => (
    <div className="flex flex-col mb-4 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors" id={`row-${label.replace(/\s/g, '')}`}>
        <div className="flex justify-between mb-1">
            <span className="font-medium text-gray-700">{label}</span>
            <span className="font-bold text-blue-800">{format ? format(value) : value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-full accent-blue-600 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
        />
    </div>
);

const SavingsGraph: React.FC<{ history: SimulationResult['history'] }> = ({ history }) => {
    // Transform data for lighter payload if needed, but history is small enough
    const data = history.map(h => ({
        age: h.age,
        netWorth: Math.round(h.assetsEnd),
        year: h.year
    }));

    return (
        <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
                    <YAxis
                        tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                        width={60}
                    />
                    <Tooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                        labelFormatter={(label) => `Age ${label}`}
                    />
                    <Area
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#2563eb"
                        fillOpacity={1}
                        fill="url(#colorNetWorth)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export const Results: React.FC<Props> = ({ initialData, onReset }) => {
    // We maintain local state for the "interactive" part, seeded by wizard data
    const [simInputs, setSimInputs] = useState<SimulationInputs>(() => {
        const retirementDate = new Date(initialData.targetDate);
        const now = new Date();
        const yearsToRetire = (retirementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const retirementAge = Math.floor(initialData.currentAge + yearsToRetire);

        return {
            currentAge: initialData.currentAge,
            retirementAge: retirementAge,
            lifeExpectancy: 90,
            savingsPreTax: initialData.savingsPreTax,
            savingsPostTax: initialData.savingsPostTax,
            savingsHSA: initialData.savingsHSA,
            annualIncome: initialData.annualIncome,
            annualExpenses: initialData.annualExpenses,
            socialSecurityAt67: initialData.ssEstimate,
            socialSecurityStartAge: 67, // Default
            state: initialData.state
        };
    });

    const result: SimulationResult = useMemo(() => {
        const calculator = new RetirementCalculator(simInputs);
        return calculator.simulate();
    }, [simInputs]);

    const feasibleRetirementDate: number | null = useMemo(() => {
        if (result.isSolvent) return null;

        // Try to find a feasible date by incrementing retirement age
        // Limit search to age 80 to avoid infinite loops or unrealistic suggestions
        for (let age = simInputs.retirementAge + 1; age <= 80; age++) {
             const testInputs = { ...simInputs, retirementAge: age };
             const calc = new RetirementCalculator(testInputs);
             if (calc.simulate().isSolvent) {
                 return age;
             }
        }
        return null;
    }, [result.isSolvent, simInputs]);

    const formatMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;

    // Derived Formula Values (First year of retirement snapshot or simplified view)
    const retirementYearData = result.history.find(h => h.isRetired) || result.history[result.history.length-1];

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const FormulaItem: React.FC<{ label: string, value: string, targetId: string, operator?: string }> = ({ label, value, targetId, operator }) => (
        <span className="inline-flex items-center gap-2 flex-wrap">
            {operator && <span className="text-gray-400 font-light text-2xl">{operator}</span>}
            <button
                onClick={() => scrollTo(targetId)}
                className="flex flex-col items-center p-2 rounded hover:bg-blue-50 transition cursor-pointer border border-transparent hover:border-blue-200"
            >
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{label}</span>
                <span className="text-xl md:text-2xl font-mono font-bold text-gray-800">{value}</span>
            </button>
        </span>
    );

    const safeWithdrawal = (retirementYearData.assetsStart * 0.04); // 4% rule approximation for display
    const totalIncome = safeWithdrawal + retirementYearData.income; // SW + SS
    const totalOutflow = retirementYearData.expenses + retirementYearData.healthcare + retirementYearData.taxes;
    const surplus = totalIncome - totalOutflow;

    const selectedStateData = (stateTaxDataRaw as any)[simInputs.state] as StateTaxData;
    const stateHealthcareMultiplier = (healthcareDataRaw.state_multipliers as any)[simInputs.state] || 1.0;

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header / Status */}
            <div className={`p-8 rounded-xl text-center mb-8 shadow-lg ${result.isSolvent ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
                <h1 className="text-6xl font-black mb-2">{result.isSolvent ? 'YES' : 'NO'}</h1>
                <p className="text-xl">
                    {result.isSolvent
                        ? `You are on track to retire at age ${simInputs.retirementAge}.`
                        : `You run out of money at age ${result.history.find(h => h.assetsEnd < 0)?.age || 'unknown'}.`
                    }
                </p>
                {!result.isSolvent && (
                    <div className="mt-2">
                        {feasibleRetirementDate ? (
                             <p className="font-bold">You could retire at age {feasibleRetirementDate}.</p>
                        ) : (
                             <p className="text-sm opacity-80">We couldn't find a feasible date before age 80. Try adjusting expenses.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Formula Visualization & Graph */}
            <div className="bg-white p-6 rounded-xl shadow mb-8">
                <h3 className="text-lg font-bold text-gray-400 mb-4 uppercase tracking-widest text-center">First Year of Retirement Snapshot</h3>
                <div className="flex items-center justify-center gap-2 md:gap-4 overflow-x-auto min-w-[600px] pb-4">
                    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-center font-bold text-gray-400 text-xs">INFLOWS</span>
                        <div className="flex items-center gap-2">
                            <FormulaItem
                                label="Safe Withdrawal (4%)"
                                value={formatMoney(safeWithdrawal)}
                                targetId="row-Savings(Pre-Tax)"
                            />
                            <FormulaItem
                                label="Social Security"
                                value={formatMoney(retirementYearData.income)}
                                targetId="row-SocialSecurity(at67)"
                                operator="+"
                            />
                        </div>
                    </div>

                    <span className="text-4xl font-light text-gray-300">-</span>

                    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-center font-bold text-gray-400 text-xs">OUTFLOWS</span>
                        <div className="flex items-center gap-2">
                            <FormulaItem
                                label="Expenses"
                                value={formatMoney(retirementYearData.expenses)}
                                targetId="row-AnnualExpenses"
                            />
                            <FormulaItem
                                label="Healthcare"
                                value={formatMoney(retirementYearData.healthcare)}
                                targetId="row-Age"
                                operator="+"
                            />
                            <FormulaItem
                                label="Taxes"
                                value={formatMoney(retirementYearData.taxes)}
                                targetId="row-State"
                                operator="+"
                            />
                        </div>
                    </div>

                    <span className="text-4xl font-light text-gray-300">=</span>

                    <div className={`flex flex-col items-center p-3 rounded-lg border ${surplus >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                         <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Net Surplus</span>
                         <span className={`text-2xl font-mono font-bold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(surplus)}
                         </span>
                    </div>
                </div>

                <div className="mt-8 border-t pt-8">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Total Net Worth Over Time</h4>
                    <SavingsGraph history={result.history} />
                </div>
            </div>

            {/* Interactive Inputs */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow">
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">Modify Your Plan</h3>

                    <SliderRow
                        label="Retirement Age"
                        value={simInputs.retirementAge}
                        min={simInputs.currentAge + 1}
                        max={80}
                        onChange={v => setSimInputs({...simInputs, retirementAge: v})}
                    />

                    <SliderRow
                        label="Annual Expenses"
                        value={simInputs.annualExpenses}
                        min={10000}
                        max={200000}
                        step={1000}
                        onChange={v => setSimInputs({...simInputs, annualExpenses: v})}
                        format={formatMoney}
                    />

                    <SliderRow
                        label="Annual Income (Pre-Retirement)"
                        value={simInputs.annualIncome}
                        min={0}
                        max={500000}
                        step={1000}
                        onChange={v => setSimInputs({...simInputs, annualIncome: v})}
                        format={formatMoney}
                    />

                     <SliderRow
                        label="Savings (Pre-Tax)"
                        value={simInputs.savingsPreTax}
                        min={0}
                        max={2000000}
                        step={5000}
                        onChange={v => setSimInputs({...simInputs, savingsPreTax: v})}
                        format={formatMoney}
                    />

                     <SliderRow
                        label="Savings (Post-Tax)"
                        value={simInputs.savingsPostTax}
                        min={0}
                        max={2000000}
                        step={5000}
                        onChange={v => setSimInputs({...simInputs, savingsPostTax: v})}
                        format={formatMoney}
                    />

                     <SliderRow
                        label="HSA Balance"
                        value={simInputs.savingsHSA}
                        min={0}
                        max={500000}
                        step={1000}
                        onChange={v => setSimInputs({...simInputs, savingsHSA: v})}
                        format={formatMoney}
                    />

                     <SliderRow
                        label="Social Security (at 67)"
                        value={simInputs.socialSecurityAt67}
                        min={0}
                        max={60000}
                        step={1000}
                        onChange={v => setSimInputs({...simInputs, socialSecurityAt67: v})}
                        format={formatMoney}
                    />

                     <SliderRow
                        label="Start SS Age"
                        value={simInputs.socialSecurityStartAge}
                        min={62}
                        max={70}
                        step={1}
                        onChange={v => setSimInputs({...simInputs, socialSecurityStartAge: v})}
                    />
                </div>

                <div className="bg-white p-6 rounded-xl shadow">
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">Assumptions & Details</h3>
                    <div className="space-y-6">
                         <div id="row-Age" className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Current Age</span>
                            <span className="font-bold">{simInputs.currentAge}</span>
                         </div>

                         <div id="row-State" className="border-b pb-4">
                            <Select
                                label="State of Residence"
                                options={STATE_OPTIONS}
                                value={simInputs.state}
                                onChange={e => setSimInputs({...simInputs, state: e.target.value})}
                            />
                            {selectedStateData && (
                                <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                    <p><span className="font-semibold">Type:</span> {selectedStateData.income_tax.type}</p>
                                    {selectedStateData.income_tax.type === 'flat' && (
                                        <p><span className="font-semibold">Rate:</span> {(selectedStateData.income_tax.rate! * 100).toFixed(2)}%</p>
                                    )}
                                    {selectedStateData.income_tax.type === 'progressive' && (
                                        <p><span className="font-semibold">Top Rate:</span> {((selectedStateData.income_tax.brackets![selectedStateData.income_tax.brackets!.length - 1].rate) * 100).toFixed(2)}%</p>
                                    )}
                                    <p className="mt-1"><span className="font-semibold">Healthcare Cost Factor:</span> {stateHealthcareMultiplier}x</p>
                                </div>
                            )}
                         </div>

                         <div className="border-b pb-2">
                             <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Constants</h4>
                             <div className="grid grid-cols-2 gap-y-1 text-sm">
                                 <span className="text-gray-600">Inflation</span>
                                 <span className="font-mono text-right">{(CONSTANTS.INFLATION * 100).toFixed(1)}%</span>

                                 <span className="text-gray-600">Inv. Return Rate</span>
                                 <span className="font-mono text-right">{(CONSTANTS.RETURN_RATE * 100).toFixed(1)}%</span>

                                 <span className="text-gray-600">Healthcare Inflation</span>
                                 <span className="font-mono text-right">{(CONSTANTS.HEALTHCARE_INFLATION * 100).toFixed(1)}%</span>
                             </div>
                         </div>

                         <div className="border-b pb-2">
                             <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Federal Tax Data</h4>
                             <div className="grid grid-cols-2 gap-y-1 text-sm">
                                 <span className="text-gray-600">Std Deduction (Single)</span>
                                 <span className="font-mono text-right">{formatMoney(federalTaxDataRaw.standard_deduction.single)}</span>
                             </div>
                         </div>

                         <div className="border-b pb-2">
                             <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Healthcare (National)</h4>
                             <div className="grid grid-cols-2 gap-y-1 text-sm">
                                 <span className="text-gray-600">Base Pre-Medicare</span>
                                 <span className="font-mono text-right">{formatMoney(healthcareDataRaw.pre_medicare_annual_cost.base)}</span>

                                 <span className="text-gray-600">Medicare Total (Est)</span>
                                 <span className="font-mono text-right">{formatMoney(healthcareDataRaw.medicare_annual_cost.total)}</span>
                             </div>
                         </div>

                         <div className="pt-4">
                             <button onClick={onReset} className="text-blue-600 underline text-sm hover:text-blue-800">Start Over</button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
