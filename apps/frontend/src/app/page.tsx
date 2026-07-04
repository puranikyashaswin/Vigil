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

// Dynamically import 2D Graph to avoid SSR issues
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
  
  // Chat States
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
          bg: "bg-red-50 border border-red-200 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.05)]",
          badge: "bg-red-600 text-white animate-pulse rounded-none",
        };
      case "high":
        return {
          bg: "bg-orange-50 border border-orange-200 text-orange-700",
          badge: "bg-orange-600 text-white rounded-none",
        };
      case "medium":
        return {
          bg: "bg-amber-50 border border-amber-200 text-amber-800",
          badge: "bg-amber-500 text-black font-semibold rounded-none",
        };
      default:
        return {
          bg: "bg-[#e8e6dc]/30 border border-[#e8e6dc] text-[#141413]",
          badge: "bg-[#b0aea5] text-[#faf9f5] rounded-none",
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#faf9f5] font-sans rounded-none text-[#141413]">
      {/* 1. Header Console Banner */}
      <header className="h-16 border-b border-[#e8e6dc] bg-[#faf9f5]/90 px-6 flex items-center justify-between z-10 rounded-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#6a9bcc] to-[#d97757] flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(106,155,204,0.25)] rounded-none">
            V
          </div>
          <div>
            <span className="font-heading text-lg font-bold tracking-tight text-[#141413] uppercase font-mono">
              Vigil //
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#d97757] ml-2 hidden sm:inline">
              Industrial Intel Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#575653] bg-[#e8e6dc]/30 px-3 py-1.5 border border-[#e8e6dc] rounded-none">
            <Database className="w-3.5 h-3.5 text-[#6a9bcc]" />
            <span>Nodes: <strong className="text-[#141413] font-mono">{graphData.nodes.length}</strong></span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#575653] bg-[#e8e6dc]/30 px-3 py-1.5 border border-[#e8e6dc] rounded-none">
            <ShieldAlert className="w-3.5 h-3.5 text-accent-crimson" />
            <span>Alerts: <strong className="text-[#141413] font-mono">{alerts.length}</strong></span>
          </div>
          
          <button 
            onClick={loadData}
            className="p-2 bg-[#e8e6dc]/30 hover:bg-[#e8e6dc]/60 rounded-none text-[#575653] hover:text-[#141413] transition border border-[#e8e6dc] flex items-center gap-1.5 text-xs font-mono cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden rounded-none bg-[#faf9f5]">
        {/* Left Side: 2D force-graph visualizer (60%) */}
        <section className="flex-1 h-2/3 md:h-full md:w-3/5 p-4 flex flex-col relative rounded-none border-r border-[#e8e6dc]">
          <div className="absolute top-6 left-6 z-10 rounded-none bg-[#faf9f5]/90 border border-[#e8e6dc] p-3 text-[10px] font-mono shadow-sm space-y-2 max-w-[180px] select-none">
            <div className="font-bold border-b border-[#e8e6dc] pb-1 uppercase tracking-wider text-[#141413] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#d97757] animate-pulse" />
              Graph Legend
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#6a9bcc] border border-[#6a9bcc]/25 rounded-full inline-block" />
                <span className="text-[#575653]">Concept / Equipment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#788c5d] border border-[#788c5d]/25 rounded-full inline-block" />
                <span className="text-[#575653]">Procedure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#d97757] border border-[#d97757]/25 rounded-full inline-block" />
                <span className="text-[#575653]">Regulation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#b0aea5] border border-[#b0aea5]/25 rounded-full inline-block" />
                <span className="text-[#575653]">Maintenance Log</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#EF4444] border border-[#EF4444]/25 rounded-full inline-block" />
                <span className="text-[#575653]">Compliance Alert</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full h-full rounded-none">
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

        {/* Right Side Panel: Tabs & Inspector (40%) */}
        <aside className="md:w-2/5 border-t md:border-t-0 bg-[#faf9f5]/30 flex flex-col overflow-hidden h-1/3 md:h-full rounded-none">
          {/* Tab Selection buttons */}
          <nav className="flex border-b border-[#e8e6dc] bg-[#faf9f5] rounded-none">
            <button 
              onClick={() => setActiveTab("inspect")}
              className={`flex-1 py-3.5 text-xs font-mono font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 rounded-none cursor-pointer ${
                activeTab === "inspect" 
                  ? "border-[#d97757] text-[#d97757] bg-[#e8e6dc]/20" 
                  : "border-transparent text-[#b0aea5] hover:text-[#141413] hover:bg-[#e8e6dc]/10"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Inspector
            </button>
            <button 
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3.5 text-xs font-mono font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 rounded-none cursor-pointer ${
                activeTab === "chat" 
                  ? "border-[#d97757] text-[#d97757] bg-[#e8e6dc]/20" 
                  : "border-transparent text-[#b0aea5] hover:text-[#141413] hover:bg-[#e8e6dc]/10"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button 
              onClick={() => setActiveTab("alerts")}
              className={`flex-1 py-3.5 text-xs font-mono font-medium border-b-2 tracking-wide transition flex items-center justify-center gap-2 rounded-none cursor-pointer ${
                activeTab === "alerts" 
                  ? "border-[#d97757] text-[#d97757] bg-[#e8e6dc]/20" 
                  : "border-transparent text-[#b0aea5] hover:text-[#141413] hover:bg-[#e8e6dc]/10"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Alerts ({alerts.length})
            </button>
          </nav>

          {/* Tab contents (animated) */}
          <div className="flex-1 overflow-y-auto p-6 relative rounded-none bg-[#faf9f5]/10">
            <AnimatePresence mode="wait">
              {activeTab === "inspect" && (
                <motion.div
                  key="inspect"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col rounded-none"
                >
                  {selectedNode ? (
                    <div className="flex flex-col h-full rounded-none">
                      <div className="flex items-center gap-2.5 mb-3 rounded-none">
                        <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-1 bg-[#e8e6dc] border border-[#b0aea5]/30 font-bold text-[#6a9bcc] rounded-none">
                          {selectedNode.type}
                        </span>
                        <span className="text-[10px] font-mono text-[#b0aea5] truncate max-w-[200px]" title={selectedNode.id}>
                          {selectedNode.id}
                        </span>
                      </div>
                      <h2 className="text-xl font-heading font-medium tracking-tight text-[#141413] mb-4 font-mono">
                        {selectedNode.label}
                      </h2>
                      <div className="border border-[#e8e6dc] p-4 bg-[#faf9f5] rounded-none mb-6">
                        <h4 className="text-xs uppercase font-mono text-[#b0aea5] mb-2">Description</h4>
                        <p className="text-sm leading-relaxed text-[#575653]">
                          {selectedNode.description || "No description provided."}
                        </p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-[#e8e6dc] rounded-none">
                        <h4 className="text-xs uppercase font-mono text-[#b0aea5] mb-3 flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Source Reference Path
                        </h4>
                        <div className="text-xs font-mono text-[#6a9bcc] truncate max-w-full hover:underline cursor-pointer font-bold">
                          {selectedNode.id}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#b0aea5] rounded-none">
                      <Database className="w-8 h-8 mb-3 opacity-30" />
                      <p className="text-sm font-mono">Select a graph node to inspect details.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col rounded-none bg-[#faf9f5]/10"
                >
                  {/* Chat logs */}
                  <div className="flex-1 space-y-4 pr-1 min-h-[250px] rounded-none overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#b0aea5] rounded-none">
                        <MessageSquare className="w-8 h-8 mb-3 opacity-30" />
                        <p className="text-sm font-mono">Query compliance rules or maintenance logs via Agent Routing.</p>
                      </div>
                    ) : (
                      messages.map((msg, index) => (
                        <div 
                          key={index}
                          className={`flex flex-col rounded-none ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                          <div className={`max-w-[90%] px-4 py-3 text-sm leading-relaxed rounded-none shadow-sm border ${
                            msg.role === "user" 
                              ? "bg-[#d97757]/10 border-[#d97757]/30 text-[#141413]" 
                              : "bg-[#e8e6dc]/30 border-[#e8e6dc] text-[#141413]"
                          }`}>
                            {msg.content}

                            {msg.role === "assistant" && msg.category && (
                              <div className="mt-3 pt-2.5 border-t border-[#e8e6dc] flex flex-col gap-2 rounded-none">
                                <div className="text-[10px] font-mono text-[#6a9bcc] uppercase tracking-wider font-bold">
                                  Resolved by: {msg.category} agent
                                </div>
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="text-[10px] font-mono text-[#b0aea5]">
                                    Citations:
                                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                      {msg.citations.map((c, i) => (
                                        <li key={i}>
                                          <span className="text-[#d97757] font-semibold">{c.source_file}</span> (score: {c.score.toFixed(2)})
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
                      <div className="flex items-center gap-2 text-xs font-mono text-[#b0aea5]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d97757]" />
                        <span>Querying Multi-Agent Graph...</span>
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="mt-4 flex gap-2 border-t border-[#e8e6dc] pt-4 rounded-none bg-[#faf9f5]">
                    <input 
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask Vigil console..."
                      className="flex-1 bg-[#faf9f5] border border-[#e8e6dc] rounded-none px-4 py-2.5 text-sm text-[#141413] placeholder-[#b0aea5] focus:outline-none focus:border-[#d97757] transition font-mono"
                    />
                    <button 
                      type="submit"
                      className="p-3 bg-[#d97757] hover:bg-[#d97757]/80 text-[#faf9f5] rounded-none transition border border-[#d97757] flex items-center justify-center cursor-pointer shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              )}

              {activeTab === "alerts" && (
                <motion.div
                  key="alerts"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4 rounded-none"
                >
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-[#b0aea5] rounded-none">
                      <ShieldAlert className="w-8 h-8 mb-3 opacity-30" />
                      <p className="text-sm font-mono">No compliance alerts active.</p>
                    </div>
                  ) : (
                    alerts.map((alert) => {
                      const style = getSeverityStyle(alert.severity);
                      return (
                        <div 
                          key={alert.id}
                          onClick={() => setSelectedAlert(alert)}
                          className={`border p-4 cursor-pointer hover:opacity-90 transition flex flex-col gap-3 relative overflow-hidden rounded-none ${style.bg}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 ${style.badge}`}>
                              {alert.severity}
                            </span>
                            <span className="text-[10px] font-mono text-[#575653] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#b0aea5]" />
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-[#141413] mb-1 flex items-center gap-1.5 font-mono font-bold">
                              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                              {alert.title}
                            </h3>
                            <p className="text-xs text-[#575653] leading-relaxed truncate font-sans">
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

      {/* 3. Contradiction Alert Compare Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 rounded-none"
          >
            <motion.div 
              initial={{ scale: 0.98, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
              className="bg-[#faf9f5] border border-[#e8e6dc] rounded-none max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-[#e8e6dc] flex items-center justify-between bg-[#faf9f5]/80 rounded-none">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono uppercase px-2.5 py-1 ${getSeverityStyle(selectedAlert.severity).badge}`}>
                    {selectedAlert.severity}
                  </span>
                  <h2 className="text-md font-mono font-bold text-[#141413] uppercase tracking-wider">
                    {selectedAlert.title}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="p-2 text-[#b0aea5] hover:text-[#141413] hover:bg-[#e8e6dc]/40 transition rounded-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 rounded-none bg-[#faf9f5]">
                <div>
                  <h4 className="text-xs uppercase font-mono text-[#b0aea5] mb-2">Audit Findings</h4>
                  <div className="border border-[#e8e6dc] bg-[#faf9f5] p-4 text-xs leading-relaxed text-[#141413] font-mono whitespace-pre-wrap">
                    {selectedAlert.content}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#e8e6dc] bg-[#faf9f5]/80 flex justify-end gap-3 rounded-none">
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 text-xs font-mono bg-[#faf9f5] hover:bg-[#e8e6dc]/40 text-[#141413] border border-[#e8e6dc] rounded-none cursor-pointer"
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
