"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, FileText, Folder } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface KBFile {
  name: string;
  path: string;
  title: string;
  resource: string | null;
}

interface KBCategory {
  name: string;
  count: number;
  files: KBFile[];
}

interface KnowledgeBaseExplorerProps {
  onOpenDocument: (filepath: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  equipment: "text-[#6a9bcc]",
  maintenance: "text-[#d97757]",
  procedures: "text-[#788c5d]",
  regulations: "text-amber-500",
  alerts: "text-red-400",
};

export default function KnowledgeBaseExplorer({ onOpenDocument }: KnowledgeBaseExplorerProps) {
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTree();
  }, []);

  const fetchTree = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge-base/tree`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        if (data.categories.length > 0) {
          setExpanded(new Set(data.categories.map((c: KBCategory) => c.name)));
        }
      }
    } catch (e) {
      console.warn("Failed to load knowledge base tree", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        Loading knowledge base...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-zinc-400 text-sm text-center">
        <FileText className="w-8 h-8 mb-2 opacity-40" />
        <p>No documents ingested yet.</p>
        <p className="text-xs mt-1">Upload files via the Pipeline Console.</p>
      </div>
    );
  }

  const totalFiles = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <motion.div
      key="kb-explorer"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Knowledge Base
        </span>
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
          {totalFiles} entities
        </span>
      </div>

      {categories.map(category => (
        <div key={category.name} className="mb-1">
          <button
            type="button"
            onClick={() => toggleCategory(category.name)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer group"
          >
            {expanded.has(category.name) ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            )}
            <Folder className={`w-4 h-4 shrink-0 ${CATEGORY_COLORS[category.name] || "text-zinc-400"}`} />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 capitalize flex-1 text-left">
              {category.name}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {category.count}
            </span>
          </button>

          <AnimatePresence>
            {expanded.has(category.name) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="ml-5 pl-3 border-l border-zinc-200 dark:border-zinc-800 mt-0.5">
                  {category.files.map(file => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => onOpenDocument(file.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#d97757]/10 dark:hover:bg-[#d97757]/10 transition cursor-pointer group text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#d97757] shrink-0 transition" />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 group-hover:text-[#d97757] truncate transition">
                        {file.title}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  );
}
