import React from "react";

interface MetricPanelProps {
  label: string;
  value: string | number;
  valueClassName?: string;
  className?: string;
}

export default function MetricPanel({
  label,
  value,
  valueClassName = "",
  className = ""
}: MetricPanelProps) {
  return (
    <div className={`flex flex-col items-start bg-brand-light-gray/30 dark:bg-brand-dark/80 border border-brand-mid-gray/30 dark:border-brand-mid-gray/20 px-2.5 py-1 rounded font-mono text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 min-w-[70px] select-none ${className}`}>
      <span className="text-[8px] opacity-75">{label}</span>
      <span className={`text-sm font-bold text-brand-dark dark:text-brand-light font-mono tabular-nums leading-none mt-0.5 ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}
