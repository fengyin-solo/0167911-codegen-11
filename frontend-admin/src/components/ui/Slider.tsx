import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  icon?: React.ReactNode;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  icon,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-dark-400">{icon}</span>}
          <span className="label-text mb-0">{label}</span>
        </div>
        <span className="text-sm font-mono text-primary-400">
          {value}{unit}
        </span>
      </div>
      <div className="relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-primary-500/50 rounded-full pointer-events-none"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full relative z-10"
        />
      </div>
    </div>
  );
};
