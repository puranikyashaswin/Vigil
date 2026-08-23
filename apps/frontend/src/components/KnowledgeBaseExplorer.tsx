"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, Image, Table, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface SourceFile {
  name: string;
}

interface KBFile {
  name: string;
  path: string;
  title: string;
  resource: string;
}

interface KBCategory {
  name: string;
  count: number;
  files: KBFile[];
}

interface KBTree {
  source_documents: SourceFile[];
  categories: KBCategory[];
}

interface KnowledgeBaseExplorerProps {
  onOpenDocument: (filepath: string) => void;
  onTriggerUpload: () => void;
  onHighlightSource?: (filename: string, entityPaths: string[]) => void;
  refreshKey?: number;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (ext === "csv") return <Table className="w-3.5 h-3.5 text-green-400 shrink-0" />;
  if (ext === "xlsx" || ext === "xls") return <Table className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return <Image className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
  if (ext === "docx" || ext === "doc") return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
}

const CATEGORY_COLORS: Record<string, string> = {
  equipment: "text-[#6a9bcc]",
  maintenance: "text-[#d97757]",
  procedures: "text-[#788c5d]",
  regulations: "text-amber-500",
  alerts: "text-red-400",
};

export default function KnowledgeBaseExplorer({ onOpenDocument, onTriggerUpload, onHighlightSource, refreshKey }: KnowledgeBaseExplorerProps) {
  const [tree, setTree] = useState<KBTree | null>(null);
  const [expandedSources, setExpandedSources] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [highlightedSource, setHighlightedSource] = useState<string | null>(null);

  useEffect(() => {
    fetchTree();
  }, [refreshKey]);

  const fetchTree = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge-base/tree`);
      if (res.ok) {
        setTree(await res.json());
      }
    } catch (e) {
      console.warn("Failed to load knowledge base tree", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSourceClick = (filename: string) => {
    if (!tree || !onHighlightSource) return;
    const entityPaths: string[] = [];
    for (const cat of tree.categories) {
      for (const file of cat.files) {
        if (file.resource && file.resource.includes(filename)) {
          entityPaths.push(file.path);
        }
      }
    }
    setHighlightedSource(highlightedSource === filename ? null : filename);
    onHighlightSource(filename, entityPaths);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!tree) return null;

  return (
    <motion.div
      key="kb-explorer"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="flex flex-col gap-0.5"
    >
      {/* Source Documents Section */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setExpandedSources(!expandedSources)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer"
        >
          {expandedSources ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          )}
          <Folder className="w-4 h-4 text-[#d97757] shrink-0" />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex-1 text-left">
            Source Documents
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {tree.source_documents.length}
          </span>
        </button>

        <AnimatePresence>
          {expandedSources && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="ml-5 pl-3 border-l border-zinc-200 dark:border-zinc-800 mt-0.5">
                {tree.source_documents.map(file => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => handleSourceClick(file.name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition cursor-pointer ${
                      highlightedSource === file.name
                        ? "bg-[#d97757]/15 border border-[#d97757]/30"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {getFileIcon(file.name)}
                    <span className={`text-xs truncate ${
                      highlightedSource === file.name
                        ? "text-[#d97757] font-medium"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {file.name}
                    </span>
                    {highlightedSource === file.name && (
                      <span className="ml-auto text-[9px] font-mono text-[#d97757]/70 shrink-0">
                        viewing
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 my-2" />

      {/* Knowledge Graph Entities */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Extracted Entities
        </span>
        <span className="text-[10px] font-mono text-zinc-400">
          {tree.categories.reduce((s, c) => s + c.count, 0)}
        </span>
      </div>

      {tree.categories.map(category => (
        <div key={category.name}>
          <button
            type="button"
            onClick={() => toggleCategory(category.name)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer"
          >
            {expandedCategories.has(category.name) ? (
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
            {expandedCategories.has(category.name) && (
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
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#d97757]/10 dark:hover:bg-[#d97757]/10 transition cursor-pointer text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
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

      {/* Add Document Button */}
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onTriggerUpload}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#d97757]/10 hover:bg-[#d97757]/20 border border-[#d97757]/20 hover:border-[#d97757]/40 text-[#d97757] text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Document
        </button>
      </div>
    </motion.div>
  );
}
