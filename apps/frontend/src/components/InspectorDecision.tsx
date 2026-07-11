"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, AlertTriangle, Play } from "lucide-react";
import { Node } from "@/types";

interface InspectorDecisionProps {
  selectedNode: Node;
  isAnalyzing: boolean;
  analysisResult: boolean;
  handleRunAnalysis: () => void;
}

export default function InspectorDecision({
  selectedNode,
  isAnalyzing,
  analysisResult,
  handleRunAnalysis
}: InspectorDecisionProps) {
  return (
    <motion.div
      key="decision-panel"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="space-y-5 font-sans"
    >
      {!analysisResult && !isAnalyzing ? (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-zinc-955/10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ShieldAlert className="w-10 h-10 text-zinc-400 mb-3" />
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5 font-serif">Shutdown Dependency Verify</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-normal mb-5">
            Assess risk levels, downstream piping dependencies, and calendar conflicts before executing shutdown.
          </p>
          <button
            onClick={handleRunAnalysis}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs font-semibold font-mono tracking-wider uppercase rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Verify Safe-to-Shutdown
          </button>
        </div>
      ) : isAnalyzing ? (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-950/20 rounded-2xl border border-zinc-850">
          <div className="w-8 h-8 rounded-full border-2 border-t-clay border-zinc-800 animate-spin mb-4" />
          <span className="text-xs font-mono text-zinc-400 tracking-wider">CORRELATING RELATIONSHIP PATHS...</span>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="space-y-4"
        >
          {/* Status Indicator */}
          {selectedNode.id.includes("p-101") ? (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-500 uppercase tracking-wide">NOT SAFE TO SHUTDOWN</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Shutting down Pump P-101 creates immediate downstream interruptions and compliance rule overlaps.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wide">COMPLIANCE RISK DETECTED</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Valve V-202 has overlapping procedure conflicts that must be bypassed prior to maintenance lockouts.
                </p>
              </div>
            </div>
          )}

          {/* High level Metrics */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-zinc-955/50 border border-zinc-800 p-3 rounded-xl">
              <div className="text-[9px] font-mono text-zinc-550">EST. DOWNTIME</div>
              <div className="text-base font-bold font-serif text-zinc-300 mt-0.5">2.4 Hours</div>
            </div>
            <div className="bg-zinc-955/50 border border-zinc-800 p-3 rounded-xl">
              <div className="text-[9px] font-mono text-zinc-550">AI CONFIDENCE</div>
              <div className="text-base font-bold font-serif text-zinc-300 mt-0.5">96%</div>
            </div>
          </div>

          {/* Traversals / Checklist */}
          <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-3 font-mono text-[11px]">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Dependency Checklist</span>
            
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Downstream equipment active:</span>
              <span className={selectedNode.id.includes("p-101") ? "text-red-400 font-semibold" : "text-[#788c5d] font-semibold"}>
                {selectedNode.id.includes("p-101") ? "Reactor-2 (Interrupted)" : "Clear"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Calendar schedule overlaps:</span>
              <span className="text-red-400 font-semibold">Valve V-202 calibration</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Regulatory standards validation:</span>
              <span className="text-red-400 font-semibold">Violates OISD Rule 14</span>
            </div>
          </div>

          {/* Actions checklist */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 text-xs">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block mb-2">Recommended Actions</span>
            <ul className="space-y-1.5 list-disc pl-4 text-zinc-650 dark:text-zinc-400">
              <li>Activate backup line bypass loop.</li>
              <li>Postpone to alternative window (Tomorrow 2:00 PM).</li>
              <li>Consult regulator standard OISD standard 119 guidelines.</li>
            </ul>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
