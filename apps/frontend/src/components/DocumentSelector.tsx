"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

interface DocumentSelectorProps {
  selectedFiles: File[];
  onFilesSelected: (files: File[]) => void;
  isRunning: boolean;
}

const ACCEPTED = ".pdf,.docx,.png,.jpg,.jpeg,.csv,.xlsx,.xls";
const MAX_SIZE = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentSelector({ selectedFiles, onFilesSelected, isRunning }: DocumentSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(f => f.size <= MAX_SIZE);
    if (valid.length > 0) {
      onFilesSelected([...selectedFiles, ...valid]);
    }
  };

  const removeFile = (index: number) => {
    onFilesSelected(selectedFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2 font-sans select-none">
      <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
        Upload Source Documents
      </span>

      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !isRunning && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragOver
            ? "border-[#d97757] bg-[#d97757]/10"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/30"
        } ${isRunning ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Upload className={`w-5 h-5 ${isDragOver ? "text-[#d97757]" : "text-zinc-500"}`} />
        <p className="text-[11px] text-zinc-400 text-center">
          {isDragOver ? "Drop files here" : "Drop files or click to browse"}
        </p>
        <p className="text-[9px] text-zinc-600">
          PDF, DOCX, PNG, CSV, XLSX (max 50MB each)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1 mt-1">
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 text-[#d97757] shrink-0" />
                <span className="truncate text-zinc-300">{file.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-zinc-500">{formatSize(file.size)}</span>
                {!isRunning && (
                  <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-zinc-500 hover:text-red-400 transition">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
