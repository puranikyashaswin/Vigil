"use client";

import React from "react";
import { Activity } from "lucide-react";

interface MetricHistoryPoint {
  time: number;
  cpu: number;
  speed: number;
}

interface PerformanceTelemetryProps {
  metrics: MetricHistoryPoint[];
}

export default function PerformanceTelemetry({ metrics }: PerformanceTelemetryProps) {
  const currentCpu = metrics.length > 0 ? Math.round(metrics[metrics.length - 1].cpu) : 0;
  const currentSpeed = metrics.length > 0 ? Math.round(metrics[metrics.length - 1].speed) : 0;

  return (
    <div className="p-5 flex flex-col gap-3 shrink-0 h-44 bg-zinc-950/60 font-sans select-none">
      <div className="flex items-center gap-2 text-zinc-500 border-b border-zinc-800 pb-1.5 shrink-0">
        <Activity className="w-4 h-4 text-clay" />
        <span className="font-semibold text-[10px] tracking-wide uppercase">Pipeline Performance Telemetry</span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 text-xs">
        {/* SVG Graph for CPU / Memory */}
        <div className="flex flex-col justify-between bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3">
          <div className="flex justify-between text-[10px] text-zinc-500 tracking-wide font-serif">
            <span>CPU LOAD</span>
            <span className="text-zinc-300 font-semibold">{currentCpu}%</span>
          </div>
          <div className="h-12 w-full mt-2 relative">
            <svg className="w-full h-full overflow-visible">
              <polyline
                fill="none"
                stroke="#d97757"
                strokeWidth="1.5"
                points={metrics.map((m, idx) => `${(idx / 19) * 160},${48 - (m.cpu / 100) * 44}`).join(" ")}
              />
            </svg>
          </div>
        </div>

        {/* SVG Graph for Processing Speed */}
        <div className="flex flex-col justify-between bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3">
          <div className="flex justify-between text-[10px] text-zinc-500 tracking-wide font-serif">
            <span>INGEST RATE</span>
            <span className="text-zinc-300 font-semibold">{currentSpeed} tok/s</span>
          </div>
          <div className="h-12 w-full mt-2 relative">
            <svg className="w-full h-full overflow-visible">
              <polyline
                fill="none"
                stroke="#788c5d"
                strokeWidth="1.5"
                points={metrics.map((m, idx) => `${(idx / 19) * 160},${48 - (m.speed / 1000) * 44}`).join(" ")}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
