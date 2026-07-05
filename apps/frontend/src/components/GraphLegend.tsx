"use client";

import React, { useState, useEffect } from "react";
import { Layers, X } from "lucide-react";
import { GraphData } from "@/types";

interface GraphLegendProps {
  graphData: GraphData;
}

export default function GraphLegend({ graphData }: GraphLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Default to open on desktop screens, collapsed on mobile
  useEffect(() => {
    const handleInitialLayout = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      }
    };
    handleInitialLayout();
  }, []);

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
    <div className="absolute top-4 right-4 z-30 select-none">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-md rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 transition cursor-pointer"
        >
          <Layers className="w-4 h-4 text-clay animate-pulse" />
          <span className="text-xs font-semibold font-mono hidden sm:inline">Legend</span>
        </button>
      ) : (
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 w-[200px] transition-all">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-clay" />
              <span>Schema</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
      )}
    </div>
  );
}
