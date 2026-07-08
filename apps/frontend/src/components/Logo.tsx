import React from "react";

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect 
        width="32" 
        height="32" 
        rx="8" 
        className="fill-brand-dark dark:fill-brand-light transition-colors duration-300" 
      />
      <path
        d="M9 10L16 22L23 10"
        className="stroke-brand-light dark:stroke-brand-dark transition-colors duration-300"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="12"
        r="3"
        className="fill-brand-mid-gray dark:fill-brand-mid-gray/80 transition-colors duration-300"
      />
    </svg>
  );
}
