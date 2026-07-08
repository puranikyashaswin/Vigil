"use client";

import React from "react";
import { X, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/types";
import { renderMarkdown } from "@/utils/markdown";

interface FloatingResponseProps {
  show: boolean;
  lastAssistantMsg: ChatMessage | undefined;
  conversationCount: number;
  onClose: () => void;
  onViewHistory: () => void;
}

export default function FloatingResponse({
  show,
  lastAssistantMsg,
  conversationCount,
  onClose,
  onViewHistory
}: FloatingResponseProps) {
  return (
    <AnimatePresence>
      {show && lastAssistantMsg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="w-full max-w-xl mx-auto px-4 mb-4"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl dark:shadow-black/40 p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {lastAssistantMsg.category && `Resolved by ${lastAssistantMsg.category} agent`}
              </span>
              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {lastAssistantMsg.metadata?.trace && (
              <div className="mb-3 pb-2 border-b border-brand-mid-gray/25 dark:border-brand-mid-gray/15 font-mono text-[9px] uppercase tracking-wider text-brand-mid-gray flex items-center gap-1.5 overflow-x-auto whitespace-nowrap select-none">
                <span className="text-brand-orange font-semibold">LOG_EXEC:</span>
                <div className="flex items-center gap-1">
                  {lastAssistantMsg.metadata.trace.map((node: string, idx: number) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span className="text-brand-mid-gray/50">→</span>}
                      <span className="bg-brand-light-gray dark:bg-brand-dark/50 text-brand-dark dark:text-brand-light px-1.5 py-0.5 rounded border border-brand-mid-gray/15 font-semibold font-mono text-[8px]">
                        {node}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <div 
              className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-4 font-serif [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_li]:mb-1"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(lastAssistantMsg.content) }}
            />
            {lastAssistantMsg.citations && lastAssistantMsg.citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Citations:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                     {lastAssistantMsg.citations.slice(0, 3).map((c, i) => (
                      <li key={i}>
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline">{c.source_file}</span> (score: {c.score.toFixed(2)})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {conversationCount > 1 && (
              <button
                onClick={onViewHistory}
                className="mt-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-700 dark:hover:text-zinc-300 transition flex items-center gap-1 cursor-pointer underline"
              >
                View conversation ({conversationCount} messages)
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
