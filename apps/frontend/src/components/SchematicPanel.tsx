import React from "react";
import dynamic from "next/dynamic";
import GraphLegend from "./GraphLegend";
import { Node, GraphData } from "@/types";

const ForceGraph2D = dynamic(() => import("./ForceGraph2D"), { ssr: false });

interface SchematicPanelProps {
  isFullScreen: boolean;
  setIsFullScreen: (val: boolean) => void;
  isMobile: boolean;
  mobileTab: "graph" | "alerts";
  graphData: GraphData;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  isOrganized: boolean;
  setIsOrganized: (val: boolean) => void;
  externalHighlightNodeIds: Set<string>;
  setExternalHighlightNodeIds: (ids: Set<string>) => void;
  setActiveTab: (tab: "inspect" | "alerts") => void;
}

export default function SchematicPanel({
  isFullScreen,
  setIsFullScreen,
  isMobile,
  mobileTab,
  graphData,
  selectedNode,
  setSelectedNode,
  isOrganized,
  setIsOrganized,
  externalHighlightNodeIds,
  setExternalHighlightNodeIds,
  setActiveTab
}: SchematicPanelProps) {
  return (
    <section className={`p-4 md:p-6 flex flex-col relative transition-all duration-300 ${
      isFullScreen 
        ? "fixed inset-0 z-40 bg-brand-light dark:bg-brand-dark h-screen w-screen" 
        : isMobile
          ? (mobileTab === "graph" ? "flex-1 h-full w-full" : "hidden")
          : "flex-1 h-2/3 md:h-full md:w-3/5 border-r border-brand-mid-gray/25 dark:border-brand-mid-gray/15"
    }`}>
      {isFullScreen && (
        <button
          onClick={() => setIsFullScreen(false)}
          className="absolute top-6 right-6 z-50 px-4 py-2 bg-brand-dark dark:bg-brand-light text-brand-light dark:text-brand-dark hover:bg-brand-dark/95 dark:hover:bg-brand-light/95 text-xs font-semibold font-mono rounded transition shadow-lg cursor-pointer border border-brand-mid-gray/20 dark:border-brand-mid-gray/10"
        >
          Exit Full Screen
        </button>
      )}
      {!isFullScreen && (
        <div className="flex items-center justify-end mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOrganized(!isOrganized)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition cursor-pointer select-none font-mono ${
                isOrganized
                  ? "bg-brand-dark dark:bg-brand-light border-brand-dark dark:border-brand-light text-brand-light dark:text-brand-dark hover:bg-brand-dark/90 dark:hover:bg-brand-light/90"
                  : "bg-white dark:bg-zinc-900 border-brand-mid-gray/20 dark:border-brand-mid-gray/15 text-brand-dark/70 dark:text-brand-light/70 hover:text-brand-dark dark:hover:text-brand-light"
              }`}
            >
              {isOrganized ? "Reset Layout" : "Organize"}
            </button>
            <button
              onClick={() => setIsFullScreen(true)}
              className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-brand-mid-gray/20 dark:border-brand-mid-gray/15 rounded text-brand-dark/70 dark:text-brand-light/70 hover:text-brand-dark dark:hover:text-brand-light transition cursor-pointer select-none flex items-center gap-1.5"
              title="Full Screen Mode"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span className="text-xs font-semibold font-mono">Full Screen</span>
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 w-full min-h-0 relative">
        <GraphLegend graphData={graphData} />
        <ForceGraph2D 
          data={graphData} 
          onNodeClick={(node) => { 
            setSelectedNode(node); 
            setExternalHighlightNodeIds(new Set()); 
            if (!isMobile) setActiveTab("inspect"); 
          }} 
          selectedNodeId={selectedNode?.id} 
          isOrganized={isOrganized} 
          externalHighlightNodeIds={externalHighlightNodeIds} 
        />
      </div>
    </section>
  );
}
