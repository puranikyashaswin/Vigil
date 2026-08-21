"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Eye, Cpu, ShieldAlert, Database, Play, X, Layers, Server, Activity } from "lucide-react";
import PerformanceTelemetry from "./PerformanceTelemetry";
import PipelineStepsGrid from "./PipelineStepsGrid";
import DocumentSelector from "./DocumentSelector";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface PipelineVisualizerProps {
  onClose: () => void;
  onComplete?: (newNodeIds?: string[]) => void;
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

  const addLog = (text: string, type: "info" | "warning" | "success" | "system" = "info") => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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
          cpu: isPipelineRunning ? 65 + Math.random() * 25 : 12 + Math.random() * 6,
          speed: isPipelineRunning ? 450 + Math.random() * 200 : 0
        });
        return next;
      });
    }, 400);

    return () => {
      if (chartIntervalRef.current) clearInterval(chartIntervalRef.current);
    };
  }, [isRunning]);

  const runPipeline = async () => {
    if (isRunning || selectedFiles.length === 0) return;
    setIsRunning(true);
    setLogs([]);
    setProgress(0);
    setActiveStep(0);

    addLog("Initializing real ingestion pipeline.", "system");
    addLog(`Uploading ${selectedFiles.length} document${selectedFiles.length > 1 ? "s" : ""} to Vigil API...`, "info");

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(`${API_BASE_URL}/api/ingest/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        addLog(`Upload failed: HTTP ${res.status}`, "warning");
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newNodeIds: string[] = [];
      let totalFiles = selectedFiles.length;
      let completedFiles = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if ("step" in data && "label" in data) {
                const step = data.step as number;
                // Map backend steps (1-5) to frontend steps (0-4)
                setActiveStep(Math.min(step - 1, 4));

                if (data.status === "running") {
                  addLog(`[${data.file}] ${data.label}`, "info");
                } else if (data.status === "complete") {
                  addLog(`[${data.file}] ${data.label}`, "success");
                } else if (data.status === "error") {
                  addLog(`[${data.file}] ${data.label}`, "warning");
                }

                // Update progress
                const stepProgress = (step / 5) * 100;
                const fileProgress = (completedFiles / totalFiles) * 100;
                setProgress(Math.round(fileProgress + stepProgress / totalFiles));
              }

              if ("detected" in data && data.detected) {
                addLog(`CONFLICT: ${data.explanation || "Contradiction detected"} [${data.severity}]`, "warning");
              }

              if ("file" in data && "index" in data && "total" in data && !("step" in data)) {
                addLog(`Processing file ${data.index + 1}/${data.total}: ${data.file}`, "system");
              }

              if ("entities_count" in data && "file" in data && !("step" in data)) {
                completedFiles++;
                addLog(`Completed ${data.file}: ${data.entities_count} entities, ${data.contradictions || 0} conflicts`, "success");
              }

              if ("total_files" in data && "new_node_ids" in data) {
                newNodeIds = data.new_node_ids || [];
                setProgress(100);
                setActiveStep(5);
                addLog(`Pipeline complete. ${data.total_entities} entities indexed. Graph updated.`, "success");
              }
            } catch {
              // skip malformed
            }
          }
        }
      }

      setIsRunning(false);
      if (onComplete) onComplete(newNodeIds);

    } catch (err) {
      addLog(`Connection error: ${String(err)}`, "warning");
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-4 md:p-6 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[85vh] text-zinc-100 font-sans"
      >
        {/* Top Bar */}
        <div className="h-16 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-[#d97757]" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200 font-serif">Central Ingestion Console</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split Pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

          {/* LEFT: Steps + Upload */}
          <div className="flex-[1.1] flex flex-col border-r border-zinc-800 overflow-hidden">
            <PipelineStepsGrid steps={steps} activeStep={activeStep} isRunning={isRunning} />

            {/* Progress bar */}
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
                    className="h-full bg-gradient-to-r from-[#6a9bcc] via-[#788c5d] to-[#d97757]"
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

            {/* Document Upload + Overview */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 bg-zinc-950/20">
              <DocumentSelector
                selectedFiles={selectedFiles}
                onFilesSelected={setSelectedFiles}
                isRunning={isRunning}
              />

              <div className="flex flex-col gap-2 bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Process Overview</span>
                <div className="flex-1 flex flex-col justify-between text-xs mt-1">
                  <p className="text-zinc-400 leading-relaxed font-serif italic text-[13px]">
                    Drop documents to parse, extract entities, detect contradictions, and index into the vector database — all in real-time.
                  </p>
                  <div className="text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2 flex justify-between">
                    <span>Engine: Claude Sonnet 4.6</span>
                    <span>Database: Qdrant Vector DB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Logs + Telemetry */}
          <div className="flex-[0.9] flex flex-col overflow-hidden bg-zinc-950">
            <div className="flex-1 min-h-0 p-5 flex flex-col text-xs border-b border-zinc-800">
              <div className="flex items-center justify-between text-zinc-500 border-b border-zinc-800 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#788c5d]" />
                  <span className="font-semibold text-[10px] tracking-wide uppercase">Ingestion Activity Log</span>
                </div>
                <span className="text-[9px] tracking-wide text-zinc-600 font-mono uppercase">Live Trace</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar text-[12px] leading-relaxed">
                {logs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-zinc-700 italic font-serif">
                    Console ready. Drop files and trigger ingestion.
                  </div>
                )}
                {logs.map((log, idx) => (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} key={idx} className="flex items-start gap-2">
                    <span className="text-[#d97757] text-xs select-none">&rsaquo;</span>
                    <span className={`flex-1 font-sans ${
                      log.type === "warning" ? "text-red-400 font-medium"
                        : log.type === "success" ? "text-[#788c5d]"
                        : log.type === "system" ? "text-[#6a9bcc]"
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

        {/* Footer */}
        <div className="h-20 border-t border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-zinc-950/70 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-serif italic">
            <Server className="w-4 h-4 text-zinc-500" />
            <span>{selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected</span>
          </div>
          <button
            onClick={runPipeline}
            disabled={isRunning || selectedFiles.length === 0}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer transition select-none ${
              isRunning || selectedFiles.length === 0
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
