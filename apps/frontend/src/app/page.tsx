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
  ExternalLink
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const ForceGraph2D = dynamic(() => import("@/components/ForceGraph2D"), { ssr: false });

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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"inspect" | "chat" | "alerts">("inspect");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setInputMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsTyping(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      
      setMessages((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          content: data.generated_response,
          category: data.category,
          citations: data.citations
        }
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Connection to backend query service failed." }]);
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="h-20 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm px-8 flex items-center justify-between z-10 shrink-0">
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
          <div className="absolute top-6 right-6 z-10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/30 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5 min-w-[200px] select-none">
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-clay" />
              Graph Legend
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-zinc-400 dark:bg-zinc-500 rounded-full inline-block" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Concept / Equipment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-zinc-500 dark:bg-zinc-400 rounded-full inline-block" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Procedure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-zinc-600 dark:bg-zinc-300 rounded-full inline-block" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Regulation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-zinc-700 dark:bg-zinc-200 rounded-full inline-block" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Maintenance Log</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-clay rounded-full inline-block" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Compliance Alert</span>
              </div>
            </div>
          </div>

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
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-4 text-sm font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "chat" 
                  ? "border-clay text-clay bg-clay/5 dark:bg-clay/10" 
                  : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
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
              {/* Inspector Tab */}
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

              {/* Chat Tab */}
              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col bg-zinc-50/50 dark:bg-zinc-950/50"
                >
                  <div className="flex-1 space-y-4 pr-1 min-h-[250px] overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                          <MessageSquare className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Start a Conversation</h3>
                        <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xs">
                          Query compliance rules or maintenance logs via the multi-agent router.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg, index) => (
                        <div 
                          key={index}
                          className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                          <div className={`max-w-[90%] px-5 py-3 text-base leading-relaxed shadow-sm border rounded-lg ${
                            msg.role === "user" 
                              ? "bg-clay/10 dark:bg-clay/15 border-clay/20 dark:border-clay/30 text-zinc-900 dark:text-zinc-100" 
                              : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {msg.content}

                            {msg.role === "assistant" && msg.category && (
                              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex flex-col gap-2">
                                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                  Resolved by: {msg.category} agent
                                </div>
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Citations:
                                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                      {msg.citations.map((c, i) => (
                                        <li key={i}>
                                          <span className="text-clay font-medium">{c.source_file}</span> (score: {c.score.toFixed(2)})
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
                      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <RefreshCw className="w-4 h-4 animate-spin text-clay" />
                        <span>Querying agent network...</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-4 flex gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-6 bg-zinc-50 dark:bg-zinc-950">
                    <input 
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask Vigil..."
                      className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay transition"
                    />
                    <button 
                      type="submit"
                      className="px-5 py-3 bg-clay hover:bg-clay/85 text-white rounded-lg transition flex items-center justify-center cursor-pointer shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Alerts Tab */}
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
  );
}
