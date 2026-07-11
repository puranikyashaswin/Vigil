"use client";

import React, { useState, useEffect } from "react";
import { Database, ExternalLink, Calendar, ShieldAlert, AlertTriangle, CheckCircle2, Clock, Play, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Node } from "@/types";
import InspectorTimeline from "./InspectorTimeline";
import InspectorDecision from "./InspectorDecision";

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
            <InspectorTimeline timelineEvents={timelineEvents} />
          )}
          {activeTab === "decision" && (
            <InspectorDecision
              selectedNode={selectedNode}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
              handleRunAnalysis={handleRunAnalysis}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
