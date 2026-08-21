"use client";

import React, { useEffect, useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { renderMarkdown } from "@/utils/markdown";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface DocumentViewerProps {
  filepath: string | null;
  onClose: () => void;
}

export default function DocumentViewer({ filepath, onClose }: DocumentViewerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filepath) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/docs/${filepath}`)
      .then(res => {
        if (!res.ok) throw new Error("Document not found");
        return res.json();
      })
      .then(data => setContent(data.content))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filepath]);

  return (
    <AnimatePresence>
      {filepath && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 250 }}
          className="fixed right-0 top-0 bottom-0 z-[60] w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
        >
          <div className="h-14 px-5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#d97757] shrink-0" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {filepath}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
              </div>
            )}
            {error && (
              <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
            )}
            {!loading && !error && content && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none font-serif text-zinc-800 dark:text-zinc-200 [&_table]:text-xs [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_td]:border-zinc-200 [&_td]:dark:border-zinc-700"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
