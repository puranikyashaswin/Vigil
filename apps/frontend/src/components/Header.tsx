import React from "react";
import Logo from "./Logo";
import MetricPanel from "./MetricPanel";
import ThemeToggle from "./ThemeToggle";
import { Activity, RefreshCw, Database } from "lucide-react";

interface HeaderProps {
  nodesCount: number;
  edgesCount: number;
  alertsCount: number;
  loading: boolean;
  onShowPipeline: () => void;
  onRefresh: () => void;
  apiBaseUrl: string;
}

export default function Header({
  nodesCount,
  edgesCount,
  alertsCount,
  loading,
  onShowPipeline,
  onRefresh,
  apiBaseUrl
}: HeaderProps) {
  const complianceScore = nodesCount > 0 
    ? (Math.max(0, 100 - (alertsCount * 12.5))).toFixed(1) 
    : "100.0";

  return (
    <header className="h-20 border-b border-brand-mid-gray/20 dark:border-brand-mid-gray/10 bg-brand-light/95 dark:bg-brand-dark/95 backdrop-blur-sm px-4 sm:px-8 flex items-center justify-between z-20 shrink-0 select-none">
      <div className="flex items-center gap-2 sm:gap-3">
        <Logo className="w-8 h-8 sm:w-9 h-9" />
        <div>
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-brand-dark dark:text-brand-light font-serif">Vigil</span>
          <span className="text-xs sm:text-sm font-medium text-brand-mid-gray dark:text-brand-mid-gray/80 tracking-wide ml-2 hidden sm:inline">Industrial Intel Console</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* 4 Compact Metric Panels */}
        <div className="hidden md:flex gap-2">
          <MetricPanel label="Nodes" value={nodesCount} />
          <MetricPanel label="Edges" value={edgesCount} />
          <MetricPanel label="Compliance" value={`${complianceScore}%`} />
          <MetricPanel 
            label="Alerts" 
            value={alertsCount} 
            valueClassName={alertsCount > 0 ? "text-brand-orange animate-pulse" : ""}
          />
        </div>

        {/* Action Buttons */}
        <button 
          onClick={onShowPipeline}
          className="hidden lg:flex items-center gap-2 text-xs text-brand-dark/80 dark:text-brand-light/80 bg-brand-light-gray/40 dark:bg-brand-dark hover:bg-brand-light-gray/60 dark:hover:bg-brand-dark/80 px-3 py-2 rounded font-mono cursor-pointer transition select-none border border-brand-mid-gray/15 dark:border-brand-mid-gray/10"
          title="Open Ingestion Pipeline Console"
        >
          <Activity className="w-3.5 h-3.5 text-brand-green" />
          <span>Pipeline: <strong className="text-brand-green font-bold">ONLINE</strong></span>
        </button>
        
        <button 
          onClick={onRefresh} 
          className="p-2 sm:px-4 sm:py-2 bg-brand-light-gray/40 dark:bg-brand-dark hover:bg-brand-light-gray/60 dark:hover:bg-brand-dark/80 text-sm font-medium text-brand-dark/80 dark:text-brand-light/80 transition flex items-center gap-2 cursor-pointer rounded border border-brand-mid-gray/15 dark:border-brand-mid-gray/10"
          title="Refresh graph data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        
        <button 
          onClick={() => {
            window.open(`${apiBaseUrl}/api/compliance/export`, '_blank');
          }}
          className="p-2 sm:px-4 sm:py-2 bg-brand-orange text-brand-light hover:bg-brand-orange/90 text-sm font-medium transition flex items-center gap-2 cursor-pointer rounded shadow-sm font-sans select-none"
          title="Download compliance evidence package zip"
        >
          <Database className="w-4 h-4" />
          <span className="hidden sm:inline">Export Audit Package</span>
        </button>
        
        <ThemeToggle />
      </div>
    </header>
  );
}
