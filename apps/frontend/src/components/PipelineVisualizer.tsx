"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Eye, Cpu, ShieldAlert, Database, Play, X, CheckCircle2, Layers, Server, Activity, ChevronRight } from "lucide-react";
import PerformanceTelemetry from "./PerformanceTelemetry";
import PipelineStepsGrid from "./PipelineStepsGrid";
import DocumentSelector from "./DocumentSelector";

interface PipelineVisualizerProps {
  onClose: () => void;
  onComplete?: () => void;
}

interface LogLine {
  text: string;
  type: "info" | "warning" | "success" | "system";
}

interface MetricHistoryPoint {
  time: number;
  cpu: number;
  speed: number;
}

export default function PipelineVisualizer({ onClose, onComplete }: PipelineVisualizerProps) {
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("bypass_regulation_conflict.pdf");
  const [metrics, setMetrics] = useState<MetricHistoryPoint[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chartIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const steps = [
    { id: 0, label: "Document Ingestion", icon: FileText, desc: "Native parsing & OCR fallback" },
    { id: 1, label: "Visual Topology", icon: Eye, desc: "P&ID flow visual extraction" },
    { id: 2, label: "Entity Extractor", icon: Cpu, desc: "Pydantic structured mapping" },
    { id: 3, label: "Contradiction Safety", icon: ShieldAlert, desc: "Pairwise overlap safety scans" },
    { id: 4, label: "Vector Indexer", icon: Database, desc: "FastEmbed to Qdrant storage" }
  ];

  const documentOptions = [
    { name: "bypass_regulation_conflict.pdf", type: "PDF Document", size: "142 KB" },
    { name: "plant_topology_p&id.png", type: "P&ID Drawing Image", size: "1.8 MB" },
    { name: "OISD_standard_119.pdf", type: "Regulatory Standard", size: "840 KB" }
  ];

  const addLog = (text: string, type: "info" | "warning" | "success" | "system" = "info") => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Generate running system telemetry charts
  useEffect(() => {
    let tick = 0;
    const initialPoints = Array.from({ length: 20 }, (_, i) => ({
      time: i,
      cpu: 15 + Math.random() * 10,
      speed: 0
    }));
    setMetrics(initialPoints);

    chartIntervalRef.current = setInterval(() => {
      tick++;
      setMetrics((prev) => {
        const next = [...prev.slice(1)];
        const isPipelineRunning = isRunning;
        
        next.push({
          time: tick + 20,
          cpu: isPipelineRunning 
            ? 65 + Math.random() * 25 
            : 12 + Math.random() * 6,
          speed: isPipelineRunning
            ? 450 + Math.random() * 200
            : 0
        });
        return next;
      });
    }, 400);

    return () => {
      if (chartIntervalRef.current) clearInterval(chartIntervalRef.current);
    };
  }, [isRunning]);

  const runPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setProgress(0);

    // Stage 1: Document Ingestion
    setActiveStep(0);
    addLog("Initializing ingestion workflow.", "system");
    addLog(`Loading target asset: ${selectedDoc}`, "info");
    addLog(`Analyzing ${selectedDoc} structure.`, "info");
    
    if (selectedDoc.endsWith(".png")) {
      addLog("Visual drawing layout recognized. Activating optical character recognition.", "info");
    } else {
      addLog("Digital text layout verified. Directly parsed document content.", "success");
    }
    await delay(1200);
    setProgress(20);

    // Stage 2: Visual Topology Extraction
    setActiveStep(1);
    addLog(`Analyzing ${selectedDoc} visual layouts to extract connection lines.`, "info");
    if (selectedDoc.endsWith(".png") || selectedDoc.includes("topology") || selectedDoc.includes("p&id")) {
      addLog("Mapping process flow structures and equipment tags.", "info");
      addLog("Extracted process components: Pump P-101, Valve V-202, Tank T-301", "success");
      addLog("Mapped flow loop connections: P-101 connected to V-202 and T-301.", "success");
    } else {
      addLog(`No process flow piping layout found in ${selectedDoc}. Skipping visual connectivity trace.`, "info");
    }
    await delay(1500);
    setProgress(40);

    // Stage 3: Entity Extraction
    setActiveStep(2);
    addLog(`Mapping extracted ${selectedDoc} data into structured database entries.`, "info");
    addLog("Formatting knowledge entries to coordinate with schema files.", "info");
    addLog("Generated compliance entities and concept references.", "success");
    await delay(1100);
    setProgress(60);

    // Stage 4: Contradiction Check
    setActiveStep(3);
    addLog(`Running procedural setpoint checks against safety codes for ${selectedDoc}.`, "info");
    addLog("Comparing process specifications with regulatory guidelines.", "info");
    
    if (selectedDoc === "bypass_regulation_conflict.pdf") {
      addLog(`Conflict found: Procedure specs in ${selectedDoc} specify a setpoint of 120 PSI, which violates Safety Standard SR-12 (100 PSI limit) for Valve V-202.`, "warning");
      addLog("High-severity alert generated in the active safety feed.", "warning");
    } else {
      addLog(`Verification complete. No parameter setpoint conflicts detected for ${selectedDoc}.`, "success");
    }
    await delay(1600);
    setProgress(80);

    // Stage 5: Vector Indexing
    setActiveStep(4);
    addLog(`Splitting ${selectedDoc} content into semantic segments.`, "info");
    addLog(`Indexing ${selectedDoc} records into the vector search engine.`, "info");
    addLog("Updated local database index.", "success");
    await delay(1000);
    setProgress(100);

    // Complete
    setActiveStep(5);
    addLog("Ingestion pipeline successfully completed. System graph updated.", "success");
    setIsRunning(false);
    
    if (onComplete) {
      onComplete();
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-4 md:p-6 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[85vh] text-zinc-100 font-sans"
      >
        {/* Editorial Top Bar */}
        <div className="h-16 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-clay" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200 font-serif">Central Ingestion Console</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-855 rounded-lg text-zinc-500 hover:text-zinc-250 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outer Split Pane Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* LEFT COLUMN: Data Flow Map & Selection */}
          <div className="flex-[1.1] flex flex-col border-r border-zinc-800 overflow-hidden">
            
            <PipelineStepsGrid steps={steps} activeStep={activeStep} isRunning={isRunning} />

              {/* Progress HUD bar */}
              <div className="w-full max-w-xl mt-10 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1.5 tracking-wide">
                    <span>INGESTION RATE</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-[#6a9bcc] via-[#788c5d] to-clay"
                    />
                  </div>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div className="text-right shrink-0">
                  <div className="text-[9px] text-zinc-500 tracking-wider">STATUS</div>
                  <div className="text-xs font-semibold text-zinc-300">
                    {isRunning ? "PROCESSING" : progress === 100 ? "SUCCESS" : "STANDBY"}
                  </div>
                </div>
              </div>

            {/* Document Selection & Process Overview Details */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 bg-zinc-950/20">
              
              <DocumentSelector
                documentOptions={documentOptions}
                selectedDoc={selectedDoc}
                setSelectedDoc={setSelectedDoc}
                isRunning={isRunning}
              />

              {/* Editorial Process Overview */}
              <div className="flex flex-col gap-2 bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Process Overview</span>
                <div className="flex-1 flex flex-col justify-between text-xs mt-1">
                  <p className="text-zinc-400 leading-relaxed font-serif italic text-[13px]">
                    This utility maps data pipelines, coordinates semantic document parsers, runs safety checks, and populates the vector databases.
                  </p>
                  <div className="text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2 flex justify-between">
                    <span>Engine: Python 3.11</span>
                    <span>Database: Qdrant Vector DB</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Activity Log & Telemetry Sparklines */}
          <div className="flex-[0.9] flex flex-col overflow-hidden bg-zinc-950">
            
            {/* Activity Trace logs */}
            <div className="flex-1 min-h-0 p-5 flex flex-col text-xs border-b border-zinc-850">
              <div className="flex items-center justify-between text-zinc-500 border-b border-zinc-800 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#788c5d]" />
                  <span className="font-semibold text-[10px] tracking-wide uppercase">Ingestion Activity Log</span>
                </div>
                <span className="text-[9px] tracking-wide text-zinc-600 font-mono uppercase">Live Trace</span>
              </div>

              {/* Logs scrolling area */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar text-[12px] leading-relaxed">
                {logs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-zinc-700 italic font-serif">
                    Console ready. Trigger Ingestion to view activity log.
                  </div>
                )}
                {logs.map((log, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={idx} 
                    className="flex items-start gap-2"
                  >
                    <span className="text-clay text-xs select-none">›</span>
                    <span className={`flex-1 font-sans ${
                      log.type === "warning" 
                        ? "text-red-400 font-medium" 
                        : log.type === "success" 
                          ? "text-[#788c5d]" 
                          : log.type === "system" 
                            ? "text-[#6a9bcc]" 
                            : "text-zinc-300"
                    }`}>
                      {log.text}
                    </span>
                  </motion.div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>

            <PerformanceTelemetry metrics={metrics} />

          </div>
        </div>

        {/* Trigger Footer */}
        <div className="h-20 border-t border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-zinc-950/70 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-serif italic">
            <Server className="w-4 h-4 text-zinc-500" />
            <span>Target Node: Vigil API Gateway</span>
          </div>
          <button
            onClick={runPipeline}
            disabled={isRunning}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer transition select-none ${
              isRunning
                ? "bg-zinc-800 text-zinc-500 border border-zinc-800"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-lg shadow-white/5"
            }`}
          >
            <Play className={`w-4 h-4 ${isRunning ? "animate-spin text-zinc-400" : ""}`} />
            {isRunning ? "Running Pipeline..." : "Trigger Ingestion"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
