"use client";

import React from "react";
import { X, MessageSquare, RefreshCw, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, Conversation } from "@/types";
import { renderMarkdown } from "@/utils/markdown";
import ChatHistorySidebar from "./ChatHistorySidebar";

interface ChatHistoryOverlayProps {
  show: boolean; conversations: Conversation[]; currentConversationId: string; messages: ChatMessage[];
  inputMessage: string; isTyping: boolean; pipelineStep: number; onClose: () => void;
  onCreateNewChat: () => void; onSelectConversation: (conv: Conversation) => void;
  onDeleteChat: (convId: string, e: React.MouseEvent) => void;
  onSendMessage: (e: React.FormEvent) => void; onInputChange: (value: string) => void;
}

const STEP_LABELS = [
  "",
  "▶ [1/6] INTENT ROUTER: Classifying query intent...",
  "▶ [2/6] VECTOR RETRIEVAL: Querying Qdrant points...",
  "▶ [3/6] FLASH-RANK: Reranking matching contexts...",
  "▶ [4/6] CORE AGENT: Synthesizing response...",
  "▶ [5/6] CONTRADICTION GUARD: Evaluating safety and conflicts...",
  "▶ [6/6] TELEMETRY PIPELINE: Logging RAGAS metrics..."
];

const VARIANTS = {
  desktop: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  mobile: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
};

const TRANSITIONS = {
  desktop: { type: "tween" as const, duration: 0.2 },
  mobile: { type: "spring" as const, damping: 25, stiffness: 220 }
};

export default function ChatHistoryOverlay({
  show,
  conversations,
  currentConversationId,
  messages,
  inputMessage,
  isTyping,
  pipelineStep,
  onClose,
  onCreateNewChat,
  onSelectConversation,
  onDeleteChat,
  onSendMessage,
  onInputChange
}: ChatHistoryOverlayProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  React.useEffect(() => {
    if (!show) {
      setShowSidebarMobile(false);
    }
  }, [show]);

  const variants = isMobile ? VARIANTS.mobile : VARIANTS.desktop;
  const transition = isMobile ? TRANSITIONS.mobile : TRANSITIONS.desktop;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          transition={transition as any}
          drag={isMobile ? "y" : false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.8 }}
          onDragEnd={(e, info) => {
            if (info.offset.y > 150) {
              onClose();
            }
          }}
          className={isMobile 
            ? "fixed bottom-0 left-0 right-0 z-50 h-[92vh] bg-zinc-50 dark:bg-zinc-950 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col font-sans overflow-hidden"
            : "fixed inset-0 z-50 flex bg-zinc-50 dark:bg-zinc-950 font-sans"
          }
        >
          {isMobile && (
            <div className="w-full flex justify-center py-3 shrink-0 bg-white dark:bg-zinc-900 rounded-t-3xl cursor-grab active:cursor-grabbing border-b border-zinc-100 dark:border-zinc-800/50">
              <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
            </div>
          )}

          <ChatHistorySidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            isMobile={isMobile}
            showSidebarMobile={showSidebarMobile}
            setShowSidebarMobile={setShowSidebarMobile}
            onCreateNewChat={onCreateNewChat}
            onSelectConversation={onSelectConversation}
            onDeleteChat={onDeleteChat}
          />

          {/* Main Panel */}
          <div className={`flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 relative ${
            isMobile ? (showSidebarMobile ? "hidden" : "flex-1") : "flex-1"
          }`}>
            <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowSidebarMobile(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
                  >
                    History
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
                    {conversations.find(c => c.id === currentConversationId)?.title || "Active Chat"}
                  </h3>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Total messages: {messages.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800"
                title="Close chat"
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
                      {msg.role === "assistant" && msg.metadata?.trace && (
                        <div className="mb-3 pb-2 border-b border-brand-mid-gray/25 dark:border-brand-mid-gray/15 font-mono text-[9px] uppercase tracking-wider text-brand-mid-gray flex items-center gap-1.5 overflow-x-auto whitespace-nowrap select-none">
                          <span className="text-brand-orange font-semibold">LOG_EXEC:</span>
                          <div className="flex items-center gap-1">
                            {msg.metadata.trace.map((node: string, idx: number) => (
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
                      {msg.role === "assistant" ? (
                        <div 
                          className="font-serif text-zinc-800 dark:text-zinc-200 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_li]:mb-1"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                      {msg.role === "assistant" && msg.category && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400 font-mono">
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
                <div className="flex flex-col gap-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 font-mono text-[10px] uppercase tracking-wider w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-clay">Agent Graph Pipeline Running</span>
                    <span className="text-zinc-500">{pipelineStep}/6</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1">
                    <div className="bg-clay h-1 rounded-full transition-all duration-500" style={{ width: `${(pipelineStep / 6) * 100}%` }} />
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    {STEP_LABELS[pipelineStep] || ""}
                  </div>
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
                  className="p-2 bg-clay hover:bg-clay/90 disabled:opacity-50 text-[#faf9f5] dark:text-[#141413] rounded-full transition flex items-center justify-center cursor-pointer"
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
