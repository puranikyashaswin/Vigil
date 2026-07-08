import React from "react";
import { ChatMessage } from "@/types";

interface PipelineStatusOverlayProps {
  isTyping: boolean;
  pipelineStep: number;
  lastAssistantMsg: ChatMessage | undefined;
}

export default function PipelineStatusOverlay({
  isTyping,
  pipelineStep,
  lastAssistantMsg
}: PipelineStatusOverlayProps) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        {isTyping && (
          <div className="bg-brand-dark/95 text-brand-light border border-brand-mid-gray/40 backdrop-blur-md rounded-xl p-3 shadow-xl font-mono text-[10px] uppercase tracking-wider flex flex-col gap-1.5 transition-all select-none">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brand-orange">Agent Graph Pipeline Running</span>
              <span className="text-brand-mid-gray/80">{pipelineStep}/6</span>
            </div>
            <div className="w-full bg-brand-light/10 rounded-full h-1">
              <div 
                className="bg-brand-orange h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(pipelineStep / 6) * 100}%` }} 
              />
            </div>
            <div className="text-brand-mid-gray">
              {pipelineStep === 1 && "▶ [1/6] INTENT ROUTER: Classifying query intent..."}
              {pipelineStep === 2 && "▶ [2/6] VECTOR RETRIEVAL: Querying Qdrant points..."}
              {pipelineStep === 3 && "▶ [3/6] FLASH-RANK: Reranking matching contexts..."}
              {pipelineStep === 4 && "▶ [4/6] CORE AGENT: Synthesizing response..."}
              {pipelineStep === 5 && "▶ [5/6] CONTRADICTION GUARD: Evaluating safety and conflicts..."}
              {pipelineStep === 6 && "▶ [6/6] TELEMETRY PIPELINE: Logging RAGAS metrics..."}
            </div>
          </div>
        )}
        {!isTyping && lastAssistantMsg?.metadata?.trace && (
          <div className="bg-brand-light/95 dark:bg-brand-dark/95 border border-brand-mid-gray/30 dark:border-brand-mid-gray/25 backdrop-blur-sm rounded-xl p-2.5 shadow-md font-mono text-[9px] uppercase tracking-wider flex items-center gap-2 select-none">
            <span className="text-brand-mid-gray">Trace:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              {lastAssistantMsg.metadata.trace.map((node: string, idx: number) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-brand-mid-gray/50">→</span>}
                  <span className="bg-brand-light-gray dark:bg-brand-dark/80 text-brand-dark dark:text-brand-light px-1.5 py-0.5 rounded border border-brand-mid-gray/10">
                    {node}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
