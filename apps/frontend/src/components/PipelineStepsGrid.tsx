"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PipelineStep {
  id: number;
  label: string;
  icon: LucideIcon;
  desc: string;
}

interface PipelineStepsGridProps {
  steps: PipelineStep[];
  activeStep: number;
  isRunning: boolean;
}

export default function PipelineStepsGrid({
  steps,
  activeStep,
  isRunning
}: PipelineStepsGridProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[280px] border-b border-zinc-800 relative bg-zinc-950/10 font-sans select-none">
      
      {/* Glowing Laser Lines (Visual Connections) */}
      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 hidden md:block z-0 px-12">
        <svg className="w-full h-8 overflow-visible">
          <path 
            d="M 20 4 H 500" 
            stroke="#1e1e1d" 
            strokeWidth="3" 
            strokeLinecap="round"
            className="dark:stroke-zinc-800"
          />
          {isRunning && (
            <motion.path 
              d="M 20 4 H 500" 
              stroke="url(#laserGrad)" 
              strokeWidth="1.5" 
              strokeLinecap="round"
              animate={{ strokeDashoffset: [-80, 0] }}
              strokeDasharray="15 35"
              transition={{ repeat: Infinity, ease: "linear", duration: 1.2 }}
            />
          )}
          <defs>
            <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6a9bcc" />
              <stop offset="50%" stopColor="#788c5d" />
              <stop offset="100%" stopColor="#d97757" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Glowing Pipeline Nodes Grid */}
      <div className="w-full max-w-3xl flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 px-6">
        {steps.map((step) => {
          const StepIcon = step.icon;
          const isCompleted = activeStep > step.id;
          const isActive = activeStep === step.id;
          
          return (
            <div key={step.id} className="flex flex-col items-center w-full md:w-24">
              <div className="relative">
                {/* Interactive Node Card */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 relative ${
                    isCompleted 
                      ? "bg-[#788c5d]/20 border-[#788c5d] text-[#788c5d]" 
                      : isActive 
                        ? "bg-clay/20 border-clay text-clay" 
                        : "bg-zinc-950 border-zinc-800 text-zinc-600"
                  }`}
                >
                  <StepIcon className="w-4 h-4" />
                  
                  {/* Inner glowing pulse indicator */}
                  {isActive && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-clay" />
                  )}
                  {isCompleted && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#788c5d] rounded-full flex items-center justify-center border border-zinc-900 text-white text-[7px]">✓</span>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-medium tracking-wide text-zinc-300 mt-3 text-center">
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
