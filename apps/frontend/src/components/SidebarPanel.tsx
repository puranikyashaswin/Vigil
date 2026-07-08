import React from "react";
import { FolderOpen, ShieldAlert, RefreshCw } from "lucide-react";
import { Menubar } from "@/components/ui/menubar";
import { AnimatePresence } from "framer-motion";
import InspectorPanel from "./InspectorPanel";
import AlertFeed from "./AlertFeed";
import { Node, Alert } from "@/types";

interface SidebarPanelProps {
  isMobile: boolean;
  mobileTab: "graph" | "alerts";
  activeTab: "inspect" | "alerts";
  setActiveTab: (tab: "inspect" | "alerts") => void;
  selectedNode: Node | null;
  onRunImpactAnalysis: (nodeIds: Set<string>) => void;
  alerts: Alert[];
  setSelectedAlert: (alert: Alert | null) => void;
  loading: boolean;
  onRefresh: () => void;
}

export default function SidebarPanel({
  isMobile,
  mobileTab,
  activeTab,
  setActiveTab,
  selectedNode,
  onRunImpactAnalysis,
  alerts,
  setSelectedAlert,
  loading,
  onRefresh
}: SidebarPanelProps) {
  return (
    <aside className={`${
      isMobile 
        ? (mobileTab === "alerts" ? "flex-1 flex flex-col overflow-hidden h-full w-full" : "hidden")
        : "md:w-2/5 border-t md:border-t-0 bg-brand-light-gray/10 dark:bg-brand-dark/20 flex flex-col overflow-hidden h-1/3 md:h-full"
    }`}>
      <div className="hidden md:block border-b border-brand-mid-gray/20 dark:border-brand-mid-gray/10 bg-brand-light dark:bg-brand-dark p-2.5 flex justify-center shrink-0">
        <Menubar className="w-full justify-start border-none bg-transparent h-auto select-none">
          <button
            onClick={() => setActiveTab("inspect")}
            className={`flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors ${
              activeTab === "inspect"
                ? "bg-brand-light-gray/40 dark:bg-brand-dark/80 text-brand-dark dark:text-brand-light font-semibold"
                : "text-brand-dark/80 dark:text-brand-light/80 hover:bg-brand-light-gray/20 dark:hover:bg-brand-dark/40 hover:text-brand-dark dark:hover:text-brand-light"
            }`}
          >
            <FolderOpen className="mr-2 size-4 text-brand-orange" />
            Inspector Panel
          </button>

          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors ${
              activeTab === "alerts"
                ? "bg-brand-light-gray/40 dark:bg-brand-dark/80 text-brand-dark dark:text-brand-light font-semibold"
                : "text-brand-dark/80 dark:text-brand-light/80 hover:bg-brand-light-gray/20 dark:hover:bg-brand-dark/40 hover:text-brand-dark dark:hover:text-brand-light"
            }`}
          >
            <ShieldAlert className="mr-2 size-4 text-brand-orange" />
            System Alerts ({alerts.length})
          </button>

          <button
            onClick={onRefresh}
            className="flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none text-brand-dark/80 dark:text-brand-light/80 hover:bg-brand-light-gray/20 dark:hover:bg-brand-dark/40 hover:text-brand-dark dark:hover:text-brand-light transition-colors"
          >
            <RefreshCw className={`mr-2 size-4 text-brand-green ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </Menubar>
      </div>
      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative bg-brand-light-gray/5 dark:bg-brand-dark/10">
        {isMobile ? (
          <AlertFeed alerts={alerts} onSelectAlert={setSelectedAlert} />
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "inspect" && (
              <InspectorPanel 
                key="inspect"
                selectedNode={selectedNode} 
                onRunImpactAnalysis={onRunImpactAnalysis} 
              />
            )}
            {activeTab === "alerts" && (
              <AlertFeed 
                key="alerts"
                alerts={alerts} 
                onSelectAlert={setSelectedAlert} 
              />
            )}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}
