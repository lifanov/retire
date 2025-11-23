import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 mb-4">
    <label className="text-gray-700 font-medium">{label}</label>
    <input
      className="border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      {...props}
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: {value: string, label: string}[] }> = ({ label, options, ...props }) => (
  <div className="flex flex-col gap-1 mb-4">
    <label className="text-gray-700 font-medium">{label}</label>
    <select
      className="border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
      {...props}
    >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
