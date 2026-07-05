"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, 
  Activity, 
  Database, 
  MessageSquare, 
  Send, 
  X, 
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  Clock,
  ExternalLink,
  ChevronUp,
  ArrowUp,
  Layers
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const ForceGraph2D = dynamic(() => import("@/components/ForceGraph2D"), { ssr: false });
const SplashScreen = dynamic(() => import("@/components/SplashScreen"), { ssr: false });

interface Node {
  id: string;
  label: string;
  type: string;
  description?: string;
  val?: number;
}

interface Link {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence_score: number;
  timestamp: string;
  content: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  category?: string;
  citations?: { source_file: string; excerpt: string; score: number }[];
}

interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [graphRes, alertsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/graph"),
        fetch("http://127.0.0.1:8000/api/alerts")
      ]);
      const gData = await graphRes.json();
      const aData = await alertsRes.json();
      setGraphData(gData);
      setAlerts(aData);
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
      let loadedConvs: Conversation[] = [];
      if (stored) {
        loadedConvs = JSON.parse(stored);
      }
      
      if (!Array.isArray(loadedConvs)) {
        loadedConvs = [];
      }

      loadedConvs.sort((a, b) => b.timestamp - a.timestamp);

      // Start a fresh new chat session only if the last active conversation is not empty.
      const mostRecent = loadedConvs[0];
      if (!mostRecent || mostRecent.messages.length > 0) {
        const newId = Date.now().toString();
        const newConv: Conversation = {
          id: newId,
          title: "New Conversation",
          timestamp: Date.now(),
          messages: []
        };
        loadedConvs = [newConv, ...loadedConvs];
        localStorage.setItem("vigil_conversations", JSON.stringify(loadedConvs));
      }

      setConversations(loadedConvs);
      const activeConv = loadedConvs[0];
      setCurrentConversationId(activeConv.id);
      setMessages(activeConv.messages);
    } catch (e) {
      console.error("Failed to load chat history from localStorage", e);
    }
  }, []);

  const updateConversationMessages = (convId: string, newMsgs: ChatMessage[]) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id === convId) {
          let title = c.title;
          if (title === "New Conversation" && newMsgs.length > 0) {
            const firstUserMsg = newMsgs.find(m => m.role === "user");
            if (firstUserMsg) {
              title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
            }
          }
          return {
            ...c,
            title,
            timestamp: Date.now(),
            messages: newMsgs
          };
        }
        return c;
      });
      const sorted = [...updated].sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem("vigil_conversations", JSON.stringify(sorted));
      return sorted;
    });
  };

  const handleCreateNewChat = () => {
    const newId = Date.now().toString();
    const newConv: Conversation = {
      id: newId,
      title: "New Conversation",
      timestamp: Date.now(),
      messages: []
    };
    setConversations((prev) => {
      const updated = [newConv, ...prev];
      localStorage.setItem("vigil_conversations", JSON.stringify(updated));
      return updated;
    });
    setCurrentConversationId(newId);
    setMessages([]);
    setShowFloatingResponse(false);
  };

  const handleDeleteChat = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId);
      if (currentConversationId === convId) {
        if (filtered.length > 0) {
          setCurrentConversationId(filtered[0].id);
          setMessages(filtered[0].messages);
        } else {
          const newId = Date.now().toString();
          const newConv: Conversation = {
            id: newId,
            title: "New Conversation",
            timestamp: Date.now(),
            messages: []
          };
          const newFiltered = [newConv];
          localStorage.setItem("vigil_conversations", JSON.stringify(newFiltered));
          setCurrentConversationId(newId);
          setMessages([]);
          setShowFloatingResponse(false);
          return newFiltered;
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
    
    const updatedMsgsWithUser: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(updatedMsgsWithUser);
    updateConversationMessages(currentConversationId, updatedMsgsWithUser);
    setIsTyping(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      
      const updatedMsgsWithAssistant: ChatMessage[] = [
        ...updatedMsgsWithUser, 
        { 
          role: "assistant", 
          content: data.generated_response,
          category: data.category,
          citations: data.citations
        }
      ];
      setMessages(updatedMsgsWithAssistant);
      updateConversationMessages(currentConversationId, updatedMsgsWithAssistant);
      setShowFloatingResponse(true);
    } catch (err) {
      console.error("Chat error:", err);
      const updatedMsgsWithError: ChatMessage[] = [
        ...updatedMsgsWithUser,
        { role: "assistant", content: "Error: Connection to backend query service failed." }
      ];
      setMessages(updatedMsgsWithError);
      updateConversationMessages(currentConversationId, updatedMsgsWithError);
      setShowFloatingResponse(true);
    } finally {
      setIsTyping(false);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-clay/10 dark:bg-clay/15 border border-clay/20 dark:border-clay/30",
          badge: "bg-clay text-white text-xs font-semibold px-2.5 py-0.5",
        };
      case "high":
        return {
          bg: "bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600",
          badge: "bg-zinc-600 dark:bg-zinc-500 text-white text-xs font-semibold px-2.5 py-0.5",
        };
      case "medium":
        return {
          bg: "bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
          badge: "bg-zinc-500 dark:bg-zinc-600 text-white text-xs font-semibold px-2.5 py-0.5",
        };
      default:
        return {
          bg: "bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
          badge: "bg-zinc-400 dark:bg-zinc-600 text-white text-xs font-semibold px-2.5 py-0.5",
        };
    }
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const conversationCount = messages.length;

  return (
    <>
      <SplashScreen />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="h-20 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-clay flex items-center justify-center text-white text-sm font-bold">
            V
          </div>
          <div>
            <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Vigil
            </span>
            <span className="text-sm font-medium text-clay tracking-wide ml-2 hidden sm:inline">
              Industrial Intel Console
            </span>
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
          
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center gap-2 cursor-pointer rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Left: Graph (60%) */}
        <section className="flex-1 h-2/3 md:h-full md:w-3/5 p-6 flex flex-col relative border-r border-zinc-200 dark:border-zinc-800">
          {/* Graph Legend Card */}
          {(() => {
            const counts: Record<string, number> = {};
            graphData.nodes.forEach(n => {
              counts[n.type] = (counts[n.type] || 0) + 1;
            });
            return (
          <div className="absolute top-6 right-6 z-10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/30 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 min-w-[200px] select-none">
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-clay" />
              Knowledge Schema
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#6a9bcc]" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Concept</span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts["concept"] || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#788c5d]" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Procedure</span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts["procedure"] || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#d97757]" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Regulation</span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts["regulation"] || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#b0aea5]" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Maintenance</span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts["maintenance_log"] || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#EF4444]" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Alert</span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{counts["alert"] || 0}</span>
              </div>
            </div>
          </div>
            );
          })()}

          <div className="flex-1 w-full h-full">
            <ForceGraph2D 
              data={graphData} 
              onNodeClick={(node) => {
                setSelectedNode(node);
                setActiveTab("inspect");
              }}
              selectedNodeId={selectedNode?.id}
            />
          </div>
        </section>

        {/* Right Panel (40%) */}
        <aside className="md:w-2/5 border-t md:border-t-0 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col overflow-hidden h-1/3 md:h-full">
          {/* Tabs */}
          <nav className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <button 
              onClick={() => setActiveTab("inspect")}
              className={`flex-1 py-4 text-sm font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "inspect" 
                  ? "border-clay text-clay bg-clay/5 dark:bg-clay/10" 
                  : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Inspector
            </button>
            <button 
              onClick={() => setActiveTab("alerts")}
              className={`flex-1 py-4 text-sm font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "alerts" 
                  ? "border-clay text-clay bg-clay/5 dark:bg-clay/10" 
                  : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Alerts ({alerts.length})
            </button>
          </nav>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-8 relative bg-zinc-50/50 dark:bg-zinc-950/50">
            <AnimatePresence mode="wait">
              {activeTab === "inspect" && (
                <motion.div
                  key="inspect"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col"
                >
                  {selectedNode ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded">
                          {selectedNode.type}
                        </span>
                        <span className="text-sm text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]" title={selectedNode.id}>
                          {selectedNode.id}
                        </span>
                      </div>
                      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
                        {selectedNode.label}
                      </h2>
                      <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 mb-6 rounded-lg">
                        <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Description</h4>
                        <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {selectedNode.description || "No description provided."}
                        </p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                          <ExternalLink className="w-4 h-4" />
                          Source Reference Path
                        </h4>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-full hover:underline cursor-pointer">
                          {selectedNode.id}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <Database className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">No Node Selected</h3>
                      <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xs">
                        Select a node in the knowledge graph to inspect its details.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "alerts" && (
                <motion.div
                  key="alerts"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16">
                      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <ShieldAlert className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">No Active Alerts</h3>
                      <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xs">
                        All compliance checks have passed. Contradictions will appear here when detected during ingestion.
                      </p>
                    </div>
                  ) : (
                    alerts.map((alert) => {
                      const style = getSeverityStyle(alert.severity);
                      return (
                        <div 
                          key={alert.id}
                          onClick={() => setSelectedAlert(alert)}
                          className={`p-5 cursor-pointer hover:opacity-90 transition flex flex-col gap-3 relative overflow-hidden rounded-lg ${style.bg}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={style.badge}>
                              {alert.severity}
                            </span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-clay" />
                              {alert.title}
                            </h3>
                            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed truncate">
                              {alert.description}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </main>

      {/* Floating Chat Response Overlay - full-screen centered */}
      <AnimatePresence>
        {showFloatingResponse && lastAssistantMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4"
          >
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl dark:shadow-black/40 p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {lastAssistantMsg.category && `Resolved by ${lastAssistantMsg.category} agent`}
                </span>
                <button
                  onClick={() => setShowFloatingResponse(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-4">
                {lastAssistantMsg.content}
              </p>
              {lastAssistantMsg.citations && lastAssistantMsg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Citations:
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {lastAssistantMsg.citations.slice(0, 3).map((c, i) => (
                        <li key={i}>
                          <span className="text-clay font-medium">{c.source_file}</span> (score: {c.score.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {conversationCount > 1 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="mt-3 text-xs font-medium text-clay hover:text-clay/80 transition flex items-center gap-1 cursor-pointer"
                >
                  View conversation ({conversationCount} messages)
                  <ChevronUp className="w-3 h-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Input Bar - full-screen centered */}
      <form 
        onSubmit={handleSendMessage}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4"
      >
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-lg dark:shadow-black/30">
          <input 
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask Vigil about equipment, procedures, or compliance..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            title="View conversation history"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button 
            type="submit"
            disabled={isTyping || !inputMessage.trim()}
            className="p-2 bg-clay hover:bg-clay/85 disabled:opacity-50 text-white rounded-full transition flex items-center justify-center cursor-pointer"
          >
            {isTyping ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      {/* Full-Screen Chat History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex bg-zinc-50 dark:bg-zinc-950 font-sans"
          >
            {/* Left Sidebar */}
            <div className="w-[300px] border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-100 dark:bg-zinc-900 select-none">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Chat History
                </span>
                <button
                  type="button"
                  onClick={handleCreateNewChat}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-clay hover:bg-clay/90 transition flex items-center gap-1 cursor-pointer rounded"
                >
                  + New Chat
                </button>
              </div>

              {/* Sidebar List */}
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
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        setMessages(conv.messages);
                      }}
                      className={`group flex items-center justify-between p-3 cursor-pointer transition rounded-lg ${
                        isActive
                          ? "bg-clay/10 dark:bg-clay/15 text-clay font-medium"
                          : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm truncate font-medium">
                          {conv.title}
                        </div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 flex justify-between">
                          <span>{dateStr}</span>
                          <span className="truncate max-w-[120px] ml-2 italic">{previewText}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteChat(conv.id, e)}
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
              {/* Header */}
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
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-800"
                  title="Close history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message History Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full bg-zinc-50 dark:bg-zinc-950">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 border border-zinc-200 dark:border-zinc-800">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      New Chat Started
                    </h4>
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
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.role === "assistant" && msg.category && (
                          <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-400 dark:text-zinc-500">
                              Resolved by: <span className="text-clay">{msg.category} agent</span>
                            </span>
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="text-zinc-400 dark:text-zinc-500 mt-1">
                                <span className="font-semibold text-zinc-500 dark:text-zinc-400">Citations:</span>
                                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                  {msg.citations.map((c, i) => (
                                    <li key={i}>
                                      <span className="text-clay/90 font-medium">{c.source_file}</span> (score: {c.score.toFixed(2)})
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
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-455 pl-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-clay" />
                    <span>Vigil core is searching & synthesizing...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Inside Overlay */}
              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-950">
                <form 
                  onSubmit={handleSendMessage}
                  className="max-w-3xl mx-auto flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-5 py-3 shadow-md dark:shadow-black/20"
                >
                  <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask Vigil about equipment, procedures, or compliance..."
                    className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                  />
                  <button 
                    type="submit"
                    disabled={isTyping || !inputMessage.trim()}
                    className="p-2 bg-clay hover:bg-clay/90 disabled:opacity-50 text-white rounded-full transition flex items-center justify-center cursor-pointer"
                  >
                    {isTyping ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.98, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl dark:shadow-black/40 overflow-hidden rounded-lg"
            >
              <div className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/80">
                <div className="flex items-center gap-3">
                  <span className={getSeverityStyle(selectedAlert.severity).badge}>
                    {selectedAlert.severity}
                  </span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedAlert.title}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50 dark:bg-zinc-950">
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">Audit Findings</h4>
                  <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 rounded-lg text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                    {selectedAlert.content}
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="px-6 py-2.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
