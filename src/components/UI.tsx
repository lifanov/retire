import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, ...props }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 mb-4">
      <label htmlFor={id} className="text-gray-700 font-medium">{label}</label>
      <input
        id={id}
        className="border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        {...props}
      />
    </div>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: {value: string, label: string}[] }> = ({ label, options, ...props }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 mb-4">
      <label htmlFor={id} className="text-gray-700 font-medium">{label}</label>
      <select
        id={id}
        className="border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        {...props}
      >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

export const Tooltip: React.FC<{ content: React.ReactNode; children: React.ReactNode; className?: string }> = ({ content, children, className = '' }) => {
  return (
    <div className={`group relative flex flex-col items-center ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal leading-normal">
        {content}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
};

export const HelpIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-gray-600 cursor-help inline-block ml-1">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);
