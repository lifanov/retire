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

const SavingsGraph: React.FC<{ history: SimulationResult['history'], withdrawalRate: number, showWithdrawals: boolean }> = ({ history, withdrawalRate, showWithdrawals }) => {
    const data = history.map(h => {
        const safeLimit = h.assetsStart * withdrawalRate;
        const totalWithdrawalNeeded = h.expenses + h.healthcare + h.taxes;

        const safeLineValue = Math.min(totalWithdrawalNeeded, safeLimit);
        const unsafeLineValue = totalWithdrawalNeeded > safeLimit ? totalWithdrawalNeeded : null;

        return {
            age: h.age,
            netWorth: Math.round(h.assetsEnd),
            year: h.year,
            expenses: Math.round(totalWithdrawalNeeded),
            safeLimit: Math.round(safeLimit),
            isUnsafe: totalWithdrawalNeeded > safeLimit,
            safeLineValue: Math.round(safeLineValue),
            unsafeLineValue: unsafeLineValue ? Math.round(unsafeLineValue) : null
        };
    });

    return (
        <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
                    <YAxis
                        tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                        width={60}
                    />
                    <Tooltip
                        labelFormatter={(label) => `Age ${label}`}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white p-3 border shadow rounded opacity-95 text-sm">
                                        <p className="font-bold mb-1">Age {label}</p>
                                        <p className="text-blue-700">Net Worth: ${d.netWorth.toLocaleString()}</p>
                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-gray-600">Safe Limit: ${d.safeLimit.toLocaleString()}</p>
                                            <p className={`font-semibold ${d.isUnsafe ? 'text-red-600' : 'text-green-600'}`}>
                                                Est. Withdrawal: ${d.expenses.toLocaleString()}
                                            </p>
                                        </div>
                                        {d.isUnsafe && <p className="text-xs text-red-500 mt-1 italic">Exceeds safe rate</p>}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#2563eb"
                        fillOpacity={0.8}
                        fill="#2563eb"
                    />
                    {showWithdrawals && (
                        <>
                            <Area
                                type="monotone"
                                dataKey="safeLineValue"
                                stroke="#16a34a"
                                fill="none"
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="unsafeLineValue"
                                stroke="#dc2626"
                                fill="none"
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        </>
                    )}
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
            savingsRoth: initialData.savingsRoth,
            savingsHSA: initialData.savingsHSA,
            annualIncome: initialData.annualIncome,
            annualExpenses: initialData.annualExpenses,
            socialSecurityAt67: initialData.ssEstimate,
            socialSecurityStartAge: 67, // Default
            state: initialData.state,
            filingStatus: initialData.filingStatus,
            inflationRate: CONSTANTS.INFLATION,
            returnRate: CONSTANTS.RETURN_RATE,
            healthcareInflationRate: CONSTANTS.HEALTHCARE_INFLATION
        };
    });

    const [tweakAssumptions, setTweakAssumptions] = useState(false);
    const [withdrawalRate, setWithdrawalRate] = useState(0.04);
    const [showWithdrawals, setShowWithdrawals] = useState(false);

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

    const safeWithdrawal = (retirementYearData.assetsStart * withdrawalRate);
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
                                label={`Safe Withdrawal (${(withdrawalRate * 100).toFixed(1)}%)`}
                                value={formatMoney(safeWithdrawal)}
                                targetId="row-Constants"
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
                    <SavingsGraph history={result.history} withdrawalRate={withdrawalRate} showWithdrawals={showWithdrawals} />
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
                        label="Savings (Roth / Tax-Free)"
                        value={simInputs.savingsRoth}
                        min={0}
                        max={2000000}
                        step={5000}
                        onChange={v => setSimInputs({...simInputs, savingsRoth: v})}
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

                         <div id="row-Constants" className="border-b pb-2">
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-700 text-sm uppercase">Constants</h4>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={tweakAssumptions}
                                        onChange={e => setTweakAssumptions(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-blue-600 font-semibold underline">Tweak</span>
                                </label>
                             </div>

                             <div className="grid grid-cols-2 gap-y-2 text-sm items-center">
                                 <span className="text-gray-600">Inflation</span>
                                 {tweakAssumptions ? (
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={((simInputs.inflationRate ?? CONSTANTS.INFLATION) * 100).toFixed(1)}
                                        onChange={e => setSimInputs({...simInputs, inflationRate: parseFloat(e.target.value) / 100})}
                                        className="text-right border rounded p-1 w-20"
                                    />
                                 ) : (
                                    <span className="font-mono text-right">{((simInputs.inflationRate ?? CONSTANTS.INFLATION) * 100).toFixed(1)}%</span>
                                 )}

                                 <span className="text-gray-600">Inv. Return Rate</span>
                                 {tweakAssumptions ? (
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={((simInputs.returnRate ?? CONSTANTS.RETURN_RATE) * 100).toFixed(1)}
                                        onChange={e => setSimInputs({...simInputs, returnRate: parseFloat(e.target.value) / 100})}
                                        className="text-right border rounded p-1 w-20"
                                    />
                                 ) : (
                                    <span className="font-mono text-right">{((simInputs.returnRate ?? CONSTANTS.RETURN_RATE) * 100).toFixed(1)}%</span>
                                 )}

                                 <span className="text-gray-600">Healthcare Inflation</span>
                                 {tweakAssumptions ? (
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={((simInputs.healthcareInflationRate ?? CONSTANTS.HEALTHCARE_INFLATION) * 100).toFixed(1)}
                                        onChange={e => setSimInputs({...simInputs, healthcareInflationRate: parseFloat(e.target.value) / 100})}
                                        className="text-right border rounded p-1 w-20"
                                    />
                                 ) : (
                                    <span className="font-mono text-right">{((simInputs.healthcareInflationRate ?? CONSTANTS.HEALTHCARE_INFLATION) * 100).toFixed(1)}%</span>
                                 )}

                                 <span className="text-gray-600">Safe Withdrawal Rate</span>
                                 {tweakAssumptions ? (
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={(withdrawalRate * 100).toFixed(1)}
                                        onChange={e => setWithdrawalRate(parseFloat(e.target.value) / 100)}
                                        className="text-right border rounded p-1 w-20"
                                    />
                                 ) : (
                                    <span className="font-mono text-right">{(withdrawalRate * 100).toFixed(1)}%</span>
                                 )}

                                 <span className="text-gray-600">Show Withdrawal Lines</span>
                                 <div className="flex justify-end">
                                     <input
                                         type="checkbox"
                                         checked={showWithdrawals}
                                         onChange={e => setShowWithdrawals(e.target.checked)}
                                         className="rounded text-blue-600 focus:ring-blue-500 h-5 w-5"
                                     />
                                 </div>
                             </div>
                         </div>

                         <div className="border-b pb-2">
                             <h4 className="font-bold text-gray-700 mb-2 text-sm uppercase">Federal Tax Data</h4>
                             <div className="grid grid-cols-2 gap-y-1 text-sm">
                                 <span className="text-gray-600">Filing Status</span>
                                 <span className="font-mono text-right capitalize">{simInputs.filingStatus.replace(/_/g, ' ')}</span>
                                 <span className="text-gray-600">Std Deduction</span>
                                 <span className="font-mono text-right">{formatMoney(federalTaxDataRaw.standard_deduction[simInputs.filingStatus])}</span>
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
