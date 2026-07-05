"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { ShieldAlert, RefreshCw, Database, FolderOpen, LayoutGrid, Bookmark, BookmarkCheck, Tag, Star, Activity, PlusCircle, Settings, Share2 } from "lucide-react";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@/components/ui/menubar";
import ThemeToggle from "@/components/ThemeToggle";
import SplashScreen from "@/components/SplashScreen";
import GraphLegend from "@/components/GraphLegend";
import InspectorPanel from "@/components/InspectorPanel";
import AlertFeed from "@/components/AlertFeed";
import AlertDetailModal from "@/components/AlertDetailModal";
import FloatingChatInput from "@/components/FloatingChatInput";
import FloatingResponse from "@/components/FloatingResponse";
import ChatHistoryOverlay from "@/components/ChatHistoryOverlay";
import { Node, GraphData, Alert, ChatMessage, Conversation } from "@/types";

const ForceGraph2D = dynamic(() => import("@/components/ForceGraph2D"), { ssr: false });
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" className="fill-zinc-900 dark:fill-zinc-100 transition-colors duration-300" />
      <path
        d="M9 10L16 22L23 10"
        className="stroke-zinc-100 dark:stroke-zinc-900 transition-colors duration-300"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="12"
        r="3"
        className="fill-zinc-400 dark:fill-zinc-500 transition-colors duration-300"
      />
    </svg>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"inspect" | "alerts">("inspect");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showFloatingResponse, setShowFloatingResponse] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [isOrganized, setIsOrganized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [graphRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/graph`),
        fetch(`${API_BASE_URL}/api/alerts`)
      ]);
      setGraphData(await graphRes.json());
      setAlerts(await alertsRes.json());
    } catch (e) {
      console.error("Failed to load dashboard data from API", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    try {
      const stored = localStorage.getItem("vigil_conversations");
      let loadedConvs: Conversation[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(loadedConvs)) loadedConvs = [];
      loadedConvs.sort((a, b) => b.timestamp - a.timestamp);
      if (loadedConvs.length === 0 || loadedConvs[0].messages.length > 0) {
        const newConv: Conversation = { id: Date.now().toString(), title: "New Conversation", timestamp: Date.now(), messages: [] };
        loadedConvs = [newConv, ...loadedConvs];
        localStorage.setItem("vigil_conversations", JSON.stringify(loadedConvs));
      }
      setConversations(loadedConvs);
      setCurrentConversationId(loadedConvs[0].id);
      setMessages(loadedConvs[0].messages);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  }, []);

  const updateConversationMessages = (convId: string, newMsgs: ChatMessage[]) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === convId) {
          let title = c.title;
          if (title === "New Conversation" && newMsgs.length > 0) {
            const firstUserMsg = newMsgs.find(m => m.role === "user");
            if (firstUserMsg) title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
          }
          return { ...c, title, timestamp: Date.now(), messages: newMsgs };
        }
        return c;
      });
      const sorted = [...updated].sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem("vigil_conversations", JSON.stringify(sorted));
      return sorted;
    });
  };

  const handleCreateNewChat = () => {
    const newConv: Conversation = { id: Date.now().toString(), title: "New Conversation", timestamp: Date.now(), messages: [] };
    setConversations(prev => {
      const u = [newConv, ...prev];
      localStorage.setItem("vigil_conversations", JSON.stringify(u));
      return u;
    });
    setCurrentConversationId(newConv.id);
    setMessages([]);
    setShowFloatingResponse(false);
  };

  const handleDeleteChat = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const filtered = prev.filter(c => c.id !== convId);
      if (currentConversationId === convId) {
        if (filtered.length > 0) {
          setCurrentConversationId(filtered[0].id);
          setMessages(filtered[0].messages);
        } else {
          const newConv: Conversation = { id: Date.now().toString(), title: "New Conversation", timestamp: Date.now(), messages: [] };
          localStorage.setItem("vigil_conversations", JSON.stringify([newConv]));
          setCurrentConversationId(newConv.id);
          setMessages([]);
          setShowFloatingResponse(false);
          return [newConv];
        }
      }
      localStorage.setItem("vigil_conversations", JSON.stringify(filtered));
      return filtered;
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const userMsg = inputMessage;
    setInputMessage("");
    const updated = [...messages, { role: "user", content: userMsg } as ChatMessage];
    setMessages(updated);
    updateConversationMessages(currentConversationId, updated);
    setIsTyping(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      const next = [...updated, { role: "assistant", content: data.generated_response, category: data.category, citations: data.citations } as ChatMessage];
      setMessages(next);
      updateConversationMessages(currentConversationId, next);
      setShowFloatingResponse(true);
    } catch (err) {
      console.error("Chat error:", err);
      const errMsgs = [...updated, { role: "assistant", content: "Error: Connection to backend query service failed." } as ChatMessage];
      setMessages(errMsgs);
      updateConversationMessages(currentConversationId, errMsgs);
      setShowFloatingResponse(true);
    } finally {
      setIsTyping(false);
    }
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <>
      <SplashScreen />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <header className="h-20 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm px-8 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <div>
              <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-serif">Vigil</span>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 tracking-wide ml-2 hidden sm:inline">Industrial Intel Console</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono">
              <Database className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Nodes: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{graphData.nodes.length}</strong></span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              <span>Alerts: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{alerts.length}</strong></span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono">
              <Database className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 rotate-90" />
              <span>Edges: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{graphData.links.length}</strong></span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono">
              <RefreshCw className="w-3.5 h-3.5 text-[#788c5d]" />
              <span>Pipeline: <strong className="text-[#788c5d] font-bold">ONLINE</strong></span>
            </div>
            <button onClick={loadData} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center gap-2 cursor-pointer rounded-lg">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
          <section className={`p-6 flex flex-col relative transition-all duration-300 ${isFullScreen ? "fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 h-screen w-screen" : "flex-1 h-2/3 md:h-full md:w-3/5 border-r border-zinc-200 dark:border-zinc-800"}`}>
            {isFullScreen && (
              <button
                onClick={() => setIsFullScreen(false)}
                className="absolute top-6 right-6 z-50 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold font-mono rounded-lg transition shadow-lg cursor-pointer border border-zinc-200 dark:border-zinc-800"
              >
                Exit Full Screen
              </button>
            )}
            {!isFullScreen && (
              <div className="flex items-center justify-between mb-4 shrink-0">
                <GraphLegend graphData={graphData} />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsOrganized(!isOrganized)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer select-none font-mono ${
                      isOrganized
                        ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {isOrganized ? "Reset Layout" : "Organize"}
                  </button>
                  <button
                    onClick={() => setIsFullScreen(true)}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer select-none flex items-center gap-1.5"
                    title="Full Screen Mode"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    <span className="text-xs font-semibold font-mono">Full Screen</span>
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 w-full min-h-0 relative">
              <ForceGraph2D data={graphData} onNodeClick={(node) => { setSelectedNode(node); setActiveTab("inspect"); }} selectedNodeId={selectedNode?.id} isOrganized={isOrganized} />
            </div>
          </section>
          <aside className="md:w-2/5 border-t md:border-t-0 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col overflow-hidden h-1/3 md:h-full">
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 flex justify-center shrink-0">
              <Menubar className="w-full justify-start border-none bg-transparent h-auto">
                <button
                  onClick={() => setActiveTab("inspect")}
                  className={`flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors ${
                    activeTab === "inspect"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <FolderOpen className="mr-2 size-4 text-clay" />
                  Inspector Panel
                </button>

                <button
                  onClick={() => setActiveTab("alerts")}
                  className={`flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors ${
                    activeTab === "alerts"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <ShieldAlert className="mr-2 size-4 text-clay" />
                  System Alerts ({alerts.length})
                </button>

                <button
                  onClick={loadData}
                  className="flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <RefreshCw className={`mr-2 size-4 text-[#788c5d] ${loading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </Menubar>
            </div>
            <div className="flex-1 overflow-y-auto p-8 relative bg-zinc-50/50 dark:bg-zinc-950/50">
              <AnimatePresence mode="wait">
                {activeTab === "inspect" && <InspectorPanel selectedNode={selectedNode} />}
                {activeTab === "alerts" && <AlertFeed alerts={alerts} onSelectAlert={setSelectedAlert} />}
              </AnimatePresence>
            </div>
          </aside>
        </main>
      </div>
      {!isFullScreen && (
        <>
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none">
            <div className="pointer-events-auto">
              <FloatingResponse show={showFloatingResponse} lastAssistantMsg={lastAssistantMsg} conversationCount={messages.length} onClose={() => setShowFloatingResponse(false)} onViewHistory={() => setShowHistory(true)} />
            </div>
          </div>
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none">
            <div className="pointer-events-auto">
              <FloatingChatInput inputMessage={inputMessage} isTyping={isTyping} onSubmit={handleSendMessage} onChange={setInputMessage} onToggleHistory={() => setShowHistory(!showHistory)} />
            </div>
          </div>
        </>
      )}
      <ChatHistoryOverlay show={showHistory} conversations={conversations} currentConversationId={currentConversationId} messages={messages} inputMessage={inputMessage} isTyping={isTyping} onClose={() => setShowHistory(false)} onCreateNewChat={handleCreateNewChat} onSelectConversation={(c) => { setCurrentConversationId(c.id); setMessages(c.messages); }} onDeleteChat={handleDeleteChat} onSendMessage={handleSendMessage} onInputChange={setInputMessage} />
      <AlertDetailModal selectedAlert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </>
  );
}
