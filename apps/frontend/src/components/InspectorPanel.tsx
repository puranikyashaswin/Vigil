"use client";

import React, { useState, useEffect } from "react";
import { Database, ExternalLink, Calendar, ShieldAlert, AlertTriangle, CheckCircle2, Clock, Play, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Node } from "@/types";

interface InspectorPanelProps {
  selectedNode: Node | null;
  onRunImpactAnalysis?: (nodeIds: Set<string>) => void;
}

export default function InspectorPanel({ selectedNode, onRunImpactAnalysis }: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "decision">("overview");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<boolean>(false);

  // Reset tab and analysis when node changes
  useEffect(() => {
    setActiveTab("overview");
    setIsAnalyzing(false);
    setAnalysisResult(false);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 h-full">
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-850 rounded-full flex items-center justify-center mb-6">
          <Database className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
        </div>
        <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2 font-serif">No Asset Selected</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs leading-normal">
          Select any node in the knowledge schema to inspect historical parameters, compliance risks, and run impact simulations.
        </p>
      </div>
    );
  }

  const isEquipmentOrLog = 
    selectedNode.type === "equipment" || 
    selectedNode.type === "maintenance" || 
    selectedNode.type === "maintenance_log" ||
    selectedNode.id.includes("p-101") ||
    selectedNode.id.includes("v-202");

  // Mock static timeline events based on node tags
  const timelineEvents = selectedNode.id.includes("p-101")
    ? [
        { year: "2023", title: "Installation & Calibration", desc: "Installed in flow loop Alpha. OISD Standard 119 compliance verified.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2024", title: "Annual Structural Survey", desc: "Vibration measurements normal at 1.2 mm/s. Seal check completed.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2025", title: "Impeller Seal Lubrication", desc: "Addressed minor hydraulic seal leak. Closed via maintenance log M-204.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2026 (Active)", title: "Vibration Telemetry Peak", desc: "IoT sensor telemetry reports active anomaly at 5.2 mm/s. Pending check.", icon: AlertTriangle, color: "text-clay" }
      ]
    : selectedNode.id.includes("v-202")
    ? [
        { year: "2024", title: "System Integration", desc: "Calibrated to max pressure 100 PSI according to Standard SR-12 guidelines.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2025", title: "Pressure Drift Verification", desc: "Verified drift bounds. Confirmed correct bypass setpoint calibration.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2026 (Active)", title: "SOP Pressure Overlap Mismatch", desc: "Conflict found between procedure P-03 (120 PSI) and limit SR-12 (100 PSI).", icon: AlertTriangle, color: "text-red-500" }
      ]
    : [
        { year: "2024", title: "System Setup", desc: "Ingested into central knowledge graph system.", icon: CheckCircle2, color: "text-[#788c5d]" },
        { year: "2025", title: "Pairwise Contradiction Scan", desc: "Forward/reverse validation complete. No conflicts found.", icon: CheckCircle2, color: "text-[#788c5d]" }
      ];

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    
    // Simulate thinking delay
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResult(true);

      // Map highlight nodes based on node tags
      if (onRunImpactAnalysis) {
        const highlightedSet = new Set<string>();
        if (selectedNode.id.includes("p-101")) {
          highlightedSet.add(selectedNode.id);
          highlightedSet.add("maintenance/p-101-maintenance-log.md");
          highlightedSet.add("procedures/p-03.md");
          highlightedSet.add("regulations/sr-12.md");
        } else if (selectedNode.id.includes("v-202") || selectedNode.id.includes("p-03") || selectedNode.id.includes("sr-12")) {
          highlightedSet.add("procedures/p-03.md");
          highlightedSet.add("regulations/sr-12.md");
          highlightedSet.add("maintenance/v-202-maintenance-log.md");
        } else {
          highlightedSet.add(selectedNode.id);
        }
        onRunImpactAnalysis(highlightedSet);
      }
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col font-sans">
      {/* Node Info Header */}
      <div className="flex items-center gap-2.5 mb-4 shrink-0">
        <span className="text-[10px] font-bold tracking-wider uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
          {selectedNode.type}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]" title={selectedNode.id}>
          {selectedNode.id}
        </span>
      </div>

      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-5 font-serif shrink-0">
        {selectedNode.label}
      </h2>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6 shrink-0 text-xs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 pb-2.5 font-medium border-b-2 transition cursor-pointer text-center ${
            activeTab === "overview"
              ? "border-clay text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          Overview
        </button>
        {isEquipmentOrLog && (
          <>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`flex-1 pb-2.5 font-medium border-b-2 transition cursor-pointer text-center ${
                activeTab === "timeline"
                  ? "border-clay text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab("decision")}
              className={`flex-1 pb-2.5 font-medium border-b-2 transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                activeTab === "decision"
                  ? "border-clay text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Decision Engine
            </button>
          </>
        )}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto pr-1">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview-panel"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="space-y-6"
            >
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 rounded-xl leading-relaxed">
                <h4 className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 mb-2">Description</h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-serif italic text-[14px]">
                  {selectedNode.description || "No specification records provided for this concept node."}
                </p>
              </div>

              <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-450" />
                  Knowledge Concept Path
                </h4>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-full hover:underline cursor-pointer select-text">
                  {selectedNode.id}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "timeline" && (
            <motion.div
              key="timeline-panel"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="relative pl-6 space-y-6 border-l border-zinc-200 dark:border-zinc-800 ml-3 py-2"
            >
              {timelineEvents.map((evt, idx) => {
                const EvtIcon = evt.icon;
                return (
                  <div key={idx} className="relative">
                    {/* Circle Node Icon */}
                    <div className="absolute -left-[35px] top-0.5 bg-zinc-50 dark:bg-zinc-950 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-800">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${evt.color} bg-zinc-100 dark:bg-zinc-900`}>
                        <EvtIcon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold tracking-wide text-zinc-400 font-mono">
                        {evt.year}
                      </span>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 font-serif">
                        {evt.title}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                        {evt.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === "decision" && (
            <motion.div
              key="decision-panel"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="space-y-5"
            >
              {!analysisResult && !isAnalyzing ? (
                <div className="flex flex-col items-center justify-center text-center p-6 bg-zinc-950/10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
