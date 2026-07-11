"use client";

import React from "react";
import { FileText } from "lucide-react";

interface DocumentOption {
  name: string;
  type: string;
  size: string;
}

interface DocumentSelectorProps {
  documentOptions: DocumentOption[];
  selectedDoc: string;
  setSelectedDoc: (value: string) => void;
  isRunning: boolean;
}

export default function DocumentSelector({
  documentOptions,
  selectedDoc,
  setSelectedDoc,
  isRunning
}: DocumentSelectorProps) {
  return (
    <div className="flex flex-col gap-2 font-sans select-none">
      <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Select Source Asset</span>
      <div className="space-y-1.5">
        {documentOptions.map((doc) => (
          <button
            key={doc.name}
            disabled={isRunning}
            onClick={() => setSelectedDoc(doc.name)}
            className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex justify-between items-center cursor-pointer ${
              selectedDoc === doc.name
                ? "bg-zinc-850 border-clay text-zinc-100 shadow-md"
                : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800/30"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <FileText className={`w-3.5 h-3.5 ${selectedDoc === doc.name ? "text-clay" : "text-zinc-500"}`} />
              <span className="truncate">{doc.name}</span>
            </div>
            <span className="text-[9px] text-zinc-500">{doc.size}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
