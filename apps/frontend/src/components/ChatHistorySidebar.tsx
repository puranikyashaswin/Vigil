"use client";

import React from "react";
import { X } from "lucide-react";
import { Conversation } from "@/types";

interface ChatHistorySidebarProps {
  conversations: Conversation[];
  currentConversationId: string;
  isMobile: boolean;
  showSidebarMobile: boolean;
  setShowSidebarMobile: (value: boolean) => void;
  onCreateNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteChat: (convId: string, e: React.MouseEvent) => void;
}

export default function ChatHistorySidebar({
  conversations,
  currentConversationId,
  isMobile,
  showSidebarMobile,
  setShowSidebarMobile,
  onCreateNewChat,
  onSelectConversation,
  onDeleteChat
}: ChatHistorySidebarProps) {
  const handleSelectConv = (conv: Conversation) => {
    onSelectConversation(conv);
    if (isMobile) {
      setShowSidebarMobile(false);
    }
  };

  return (
    <div className={`border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-100 dark:bg-zinc-900 select-none ${
      isMobile ? (showSidebarMobile ? "w-full" : "hidden") : "w-[300px]"
    }`}>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        {isMobile ? (
          <button
            type="button"
            onClick={() => setShowSidebarMobile(false)}
            className="px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 rounded cursor-pointer"
          >
            Back
          </button>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Chat History
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            onCreateNewChat();
            if (isMobile) setShowSidebarMobile(false);
          }}
          className="px-2.5 py-1 text-xs font-medium text-white bg-[#d97757] hover:bg-[#c26243] transition flex items-center gap-1 cursor-pointer rounded"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.map((conv) => {
          const isActive = conv.id === currentConversationId;
          const dateStr = new Date(conv.timestamp).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
          const lastMsg = conv.messages.filter(m => m.role === "user").pop();
          const previewText = lastMsg ? lastMsg.content : "Empty conversation";

          return (
            <div
              key={conv.id}
              onClick={() => handleSelectConv(conv)}
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
  );
}
