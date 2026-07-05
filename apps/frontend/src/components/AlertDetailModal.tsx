"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert } from "@/types";
import { getSeverityStyle } from "@/utils/severityStyles";

interface AlertDetailModalProps {
  selectedAlert: Alert | null;
  onClose: () => void;
}

export default function AlertDetailModal({ selectedAlert, onClose }: AlertDetailModalProps) {
  return (
    <AnimatePresence>
      {selectedAlert && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        >
          <motion.div 
            initial={{ scale: 0.98, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 10 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/40 overflow-hidden rounded-lg"
          >
            <div className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <span className={getSeverityStyle(selectedAlert.severity).badge}>
                  {selectedAlert.severity}
                </span>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedAlert.title}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50 dark:bg-zinc-950">
              <div>
                <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">Audit Findings</h4>
                <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 rounded-lg text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                  {selectedAlert.content}
                </div>
              </div>
            </div>
            <div className="px-8 py-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
