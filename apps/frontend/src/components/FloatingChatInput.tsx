"use client";

import { MessageSquare, RefreshCw, ArrowUp } from "lucide-react";

interface FloatingChatInputProps {
  inputMessage: string;
  isTyping: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (value: string) => void;
  onToggleHistory: () => void;
  shouldGlow?: boolean;
}

export default function FloatingChatInput({
  inputMessage,
  isTyping,
  onSubmit,
  onChange,
  onToggleHistory,
  shouldGlow = false
}: FloatingChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 w-full max-w-xl mx-auto px-4">
      <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-lg dark:shadow-black/30">
        <input 
          type="text"
          value={inputMessage}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask Vigil about equipment, procedures, or compliance..."
          className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleHistory}
          className={`p-2 transition rounded-full cursor-pointer ${
            shouldGlow 
              ? "chat-glow-button" 
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          title="View conversation history"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button 
          type="submit"
          disabled={isTyping || !inputMessage.trim()}
          className="p-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-zinc-100 dark:text-zinc-900 rounded-full transition flex items-center justify-center cursor-pointer"
        >
          {isTyping ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </form>
  );
}
