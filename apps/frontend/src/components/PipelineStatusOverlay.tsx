"use client";

import React from "react";
import { ChatMessage } from "@/types";

interface PipelineStatusOverlayProps {
  isTyping: boolean;
  pipelineStep: number;
  lastAssistantMsg: ChatMessage | undefined;
}

const STEP_NAMES = ["", "Intent Router", "Vector Search", "Reranking", "Generation", "Safety Check", "Logging"];

export default function PipelineStatusOverlay({
  isTyping,
  pipelineStep,
  lastAssistantMsg
}: PipelineStatusOverlayProps) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        {isTyping && (
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#d97757] rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {STEP_NAMES[pipelineStep] || "Initializing"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                Step {pipelineStep}/6
              </span>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                    step < pipelineStep ? "bg-[#788c5d]"
                    : step === pipelineStep ? "bg-[#d97757] animate-pulse"
                    : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
