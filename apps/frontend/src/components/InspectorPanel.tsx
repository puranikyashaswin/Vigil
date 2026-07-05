"use client";

import { Database, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Node } from "@/types";

interface InspectorPanelProps {
  selectedNode: Node | null;
}

export default function InspectorPanel({ selectedNode }: InspectorPanelProps) {
  return (
    <motion.div
      key="inspect"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col"
    >
      {selectedNode ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded">
              {selectedNode.type}
            </span>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]" title={selectedNode.id}>
              {selectedNode.id}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            {selectedNode.label}
          </h2>
          <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 mb-6 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Description</h4>
            <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {selectedNode.description || "No description provided."}
            </p>
          </div>
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4" />
              Source Reference Path
            </h4>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-full hover:underline cursor-pointer">
              {selectedNode.id}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
            <Database className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">No Node Selected</h3>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xs">
            Select a node in the knowledge graph to inspect its details.
          </p>
        </div>
      )}
    </motion.div>
  );
}
