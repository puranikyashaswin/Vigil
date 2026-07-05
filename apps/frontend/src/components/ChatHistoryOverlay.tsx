"use client";

import React from "react";
import { X, MessageSquare, RefreshCw, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, Conversation } from "@/types";

interface ChatHistoryOverlayProps {
  show: boolean;
  conversations: Conversation[];
  currentConversationId: string;
  messages: ChatMessage[];
  inputMessage: string;
  isTyping: boolean;
  onClose: () => void;
  onCreateNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteChat: (convId: string, e: React.MouseEvent) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onInputChange: (value: string) => void;
}

export default function ChatHistoryOverlay({
  show,
  conversations,
  currentConversationId,
  messages,
  inputMessage,
  isTyping,
  onClose,
  onCreateNewChat,
  onSelectConversation,
  onDeleteChat,
  onSendMessage,
  onInputChange
}: ChatHistoryOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex bg-zinc-50 dark:bg-zinc-950 font-sans"
        >
          {/* Left Sidebar */}
          <div className="w-[300px] border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-100 dark:bg-zinc-900 select-none">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Chat History
              </span>
              <button
                type="button"
                onClick={onCreateNewChat}
                className="px-2.5 py-1 text-xs font-medium text-white bg-clay hover:bg-clay/90 transition flex items-center gap-1 cursor-pointer rounded"
              >
                + New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === currentConversationId;
                const dateStr = new Date(conv.timestamp).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const lastMsg = conv.messages.filter(m => m.role === 'user').pop();
                const previewText = lastMsg ? lastMsg.content : "Empty conversation";

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv)}
                    className={`group flex items-center justify-between p-3 cursor-pointer transition rounded-lg ${
                      isActive
                        ? "bg-clay/10 dark:bg-clay/15 text-clay font-medium"
                        : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm truncate font-medium">{conv.title}</div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 flex justify-between">
                        <span>{dateStr}</span>
                        <span className="truncate max-w-[120px] ml-2 italic">{previewText}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => onDeleteChat(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                      title="Delete chat"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Panel */}
          <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 relative">
            <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
                  {conversations.find(c => c.id === currentConversationId)?.title || "Active Chat"}
                </h3>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Total messages: {messages.length}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800"
                title="Close history"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full bg-zinc-50 dark:bg-zinc-950">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 border border-zinc-200 dark:border-zinc-800">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">New Chat Started</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">
                    Ask a question about equipment, safety regulations, or maintenance logs to begin.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed rounded-2xl ${
                      msg.role === "user"
                        ? "bg-clay/10 dark:bg-clay/15 text-zinc-900 dark:text-zinc-100 rounded-br-none border border-clay/10 dark:border-clay/20"
                        : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200 dark:border-zinc-800"
                    }`}>
                      <div className={`whitespace-pre-wrap ${msg.role === "assistant" ? "font-serif text-zinc-800 dark:text-zinc-200 text-sm" : ""}`}>{msg.content}</div>
                      {msg.role === "assistant" && msg.category && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium text-zinc-400 dark:text-zinc-500">
                            Resolved by: <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{msg.category} agent</span>
                          </span>
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="text-zinc-400 dark:text-zinc-500 mt-1">
                              <span className="font-semibold text-zinc-500 dark:text-zinc-400">Citations:</span>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {msg.citations.map((c, i) => (
                                  <li key={i}>
                                    <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline">{c.source_file}</span> (score: {c.score.toFixed(2)})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-clay" />
                  <span>Vigil core is searching and synthesizing...</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-950">
              <form onSubmit={onSendMessage} className="max-w-3xl mx-auto flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-5 py-3 shadow-md dark:shadow-black/20">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Ask Vigil about equipment, procedures, or compliance..."
                  className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isTyping || !inputMessage.trim()}
                  className="p-2 bg-clay hover:bg-clay/90 disabled:opacity-50 text-white rounded-full transition flex items-center justify-center cursor-pointer"
                >
                  {isTyping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
