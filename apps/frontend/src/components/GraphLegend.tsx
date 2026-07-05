"use client";

import { Layers } from "lucide-react";
import { GraphData } from "@/types";

interface GraphLegendProps {
  graphData: GraphData;
}

export default function GraphLegend({ graphData }: GraphLegendProps) {
  const counts: Record<string, number> = {};
  graphData.nodes.forEach(n => {
    counts[n.type] = (counts[n.type] || 0) + 1;
  });

  const items = [
    { type: "concept", color: "#6a9bcc", label: "Concept" },
    { type: "procedure", color: "#788c5d", label: "Procedure" },
    { type: "regulation", color: "#d97757", label: "Regulation" },
    { type: "maintenance_log", color: "#b0aea5", label: "Maintenance" },
    { type: "alert", color: "#EF4444", label: "Alert" },
  ];

  return (
    <div className="absolute top-6 right-6 z-10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/30 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 min-w-[200px] select-none">
      <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <Layers className="w-4 h-4 text-clay" />
        Knowledge Schema
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.type} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{item.label}</span>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts[item.type] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
