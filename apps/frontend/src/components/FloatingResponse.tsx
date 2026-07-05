"use client";

import { X, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/types";

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
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-4 font-serif">
              {lastAssistantMsg.content}
            </p>
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
