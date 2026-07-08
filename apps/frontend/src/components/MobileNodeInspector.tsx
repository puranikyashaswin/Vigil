import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import InspectorPanel from "./InspectorPanel";
import { Node } from "@/types";

interface MobileNodeInspectorProps {
  isMobile: boolean;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  onRunImpactAnalysis: (nodeIds: Set<string>) => void;
}

export default function MobileNodeInspector({
  isMobile,
  selectedNode,
  setSelectedNode,
  onRunImpactAnalysis
}: MobileNodeInspectorProps) {
  return (
    <AnimatePresence>
      {isMobile && selectedNode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedNode(null)}
            className="fixed inset-0 bg-brand-dark/60 z-40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 120) {
                setSelectedNode(null);
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-brand-light dark:bg-brand-dark rounded-t-3xl border-t border-brand-mid-gray/20 dark:border-brand-mid-gray/10 shadow-2xl flex flex-col font-sans overflow-hidden"
          >
            <div className="w-full flex justify-center py-3 shrink-0 bg-brand-light dark:bg-brand-dark rounded-t-3xl cursor-grab active:cursor-grabbing border-b border-brand-mid-gray/10 dark:border-brand-mid-gray/5">
              <div className="w-12 h-1.5 bg-brand-mid-gray/30 dark:bg-brand-mid-gray/25 rounded-full" />
            </div>
            <div className="p-4 flex items-center justify-between border-b border-brand-mid-gray/20 dark:border-brand-mid-gray/10 bg-brand-light dark:bg-brand-dark shrink-0">
              <span className="text-sm font-bold text-brand-dark dark:text-brand-light font-mono uppercase tracking-wider">Node Inspector</span>
              <button
                onClick={() => setSelectedNode(null)}
                className="px-3 py-1 bg-brand-light-gray/60 dark:bg-brand-dark hover:bg-brand-light-gray/80 dark:hover:bg-brand-dark/80 text-brand-dark/80 dark:text-brand-light/80 font-semibold text-xs rounded transition cursor-pointer border border-brand-mid-gray/20 dark:border-brand-mid-gray/10"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-brand-light/50 dark:bg-brand-dark/30">
              <InspectorPanel 
                selectedNode={selectedNode} 
                onRunImpactAnalysis={onRunImpactAnalysis} 
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
