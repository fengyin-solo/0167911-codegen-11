import React from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  activeColor?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  icon,
  activeColor = 'bg-primary-500',
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <span className="text-dark-400">{icon}</span>}
        <span className="label-text mb-0">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative w-12 h-6 rounded-full transition-all duration-300 ease-out
          ${checked ? activeColor : 'bg-dark-700'}
          focus:outline-none focus:ring-2 focus:ring-primary-500/50
        `}
      >
        <span
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full shadow-md
            transition-all duration-300 ease-out
            ${checked ? 'left-7' : 'left-1'}
          `}
        />
      </button>
    </div>
  );
};
