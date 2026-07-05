"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { ShieldAlert, RefreshCw, Database, FolderOpen } from "lucide-react";
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
            <div className="w-9 h-9 bg-clay flex items-center justify-center text-white text-sm font-bold">V</div>
            <div>
              <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Vigil</span>
              <span className="text-sm font-medium text-clay tracking-wide ml-2 hidden sm:inline">Industrial Intel Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg">
              <Database className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Nodes: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{graphData.nodes.length}</strong></span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-clay" />
              <span>Alerts: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{alerts.length}</strong></span>
            </div>
            <button onClick={loadData} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center gap-2 cursor-pointer rounded-lg">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
          <section className="flex-1 h-2/3 md:h-full md:w-3/5 p-6 flex flex-col relative border-r border-zinc-200 dark:border-zinc-800">
            <GraphLegend graphData={graphData} />
            <div className="flex-1 w-full h-full">
              <ForceGraph2D data={graphData} onNodeClick={(node) => { setSelectedNode(node); setActiveTab("inspect"); }} selectedNodeId={selectedNode?.id} />
            </div>
          </section>
          <aside className="md:w-2/5 border-t md:border-t-0 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col overflow-hidden h-1/3 md:h-full">
            <nav className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
              <button onClick={() => setActiveTab("inspect")} className={`flex-1 py-4 text-sm font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${activeTab === "inspect" ? "border-clay text-clay bg-clay/5 dark:bg-clay/10" : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"}`}>
                <FolderOpen className="w-4 h-4" /> Inspector
              </button>
              <button onClick={() => setActiveTab("alerts")} className={`flex-1 py-4 text-sm font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${activeTab === "alerts" ? "border-clay text-clay bg-clay/5 dark:bg-clay/10" : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"}`}>
                <ShieldAlert className="w-4 h-4" /> Alerts ({alerts.length})
              </button>
            </nav>
            <div className="flex-1 overflow-y-auto p-8 relative bg-zinc-50/50 dark:bg-zinc-950/50">
              <AnimatePresence mode="wait">
                {activeTab === "inspect" && <InspectorPanel selectedNode={selectedNode} />}
                {activeTab === "alerts" && <AlertFeed alerts={alerts} onSelectAlert={setSelectedAlert} />}
              </AnimatePresence>
            </div>
          </aside>
        </main>
      </div>
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
      <ChatHistoryOverlay show={showHistory} conversations={conversations} currentConversationId={currentConversationId} messages={messages} inputMessage={inputMessage} isTyping={isTyping} onClose={() => setShowHistory(false)} onCreateNewChat={handleCreateNewChat} onSelectConversation={(c) => { setCurrentConversationId(c.id); setMessages(c.messages); }} onDeleteChat={handleDeleteChat} onSendMessage={handleSendMessage} onInputChange={setInputMessage} />
      <AlertDetailModal selectedAlert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </>
  );
}
