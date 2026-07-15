"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import SchematicPanel from "@/components/SchematicPanel";
import SidebarPanel from "@/components/SidebarPanel";
import MobileNodeInspector from "@/components/MobileNodeInspector";
import MobileNavBar from "@/components/MobileNavBar";
import PipelineStatusOverlay from "@/components/PipelineStatusOverlay";
import FloatingChatInput from "@/components/FloatingChatInput";
import ChatHistoryOverlay from "@/components/ChatHistoryOverlay";
import AlertDetailModal from "@/components/AlertDetailModal";
import SplashScreen from "@/components/SplashScreen";
import { Node, GraphData, Alert, ChatMessage, Conversation } from "@/types";

const PipelineVisualizer = dynamic(() => import("@/components/PipelineVisualizer"), { ssr: false });
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"inspect" | "alerts">("inspect");
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showPipelineVisualizer, setShowPipelineVisualizer] = useState(false);
  const [externalHighlightNodeIds, setExternalHighlightNodeIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showFloatingResponse, setShowFloatingResponse] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [isOrganized, setIsOrganized] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"graph" | "alerts">("graph");
  const [showFreeTierModal, setShowFreeTierModal] = useState(false);

  useEffect(() => {
    // Show the notice modal 10 seconds after the page has mounted
    const timer = setTimeout(() => {
      setShowFreeTierModal(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleRunImpactAnalysisAnimation = (nodeIds: Set<string>) => {
    const idsArray = Array.from(nodeIds);
    setExternalHighlightNodeIds(new Set());
    idsArray.forEach((id, idx) => {
      setTimeout(() => {
        setExternalHighlightNodeIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }, idx * 500);
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [graphRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/graph`),
        fetch(`${API_BASE_URL}/api/alerts`)
      ]);
      if (graphRes.ok && alertsRes.ok) {
        setGraphData(await graphRes.json());
        setAlerts(await alertsRes.json());
        setIsDemoMode(false);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn("Backend API not reachable. Falling back to static demo mode...", e);
    }
    try {
      const [graphRes, alertsRes] = await Promise.all([
        fetch("/mock_graph.json"),
        fetch("/mock_alerts.json")
      ]);
      setGraphData(await graphRes.json());
      setAlerts(await alertsRes.json());
      setIsDemoMode(true);
    } catch (err) {
      console.error("Failed to load static mock files as fallback", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
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
    return () => window.removeEventListener("resize", checkMobile);
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
    setPipelineStep(1);
    const stepInterval = setInterval(() => {
      setPipelineStep(prev => (prev < 6 ? prev + 1 : prev));
    }, 900);

    if (isDemoMode) {
      setTimeout(() => {
        const next = [...updated, { 
          role: "assistant", 
          content: "⚠️ **Live Chat Notice**: The live multi-agent chat feature is disabled on this static web preview. To query the Expert Copilot, RCA, Compliance, or Lessons-Learned agents, please clone the repository and run the API server locally on your machine after adding your Portkey or Groq API key to your environment.", 
          category: "Expert Copilot",
          metadata: { trace: ["route_intent", "expert_copilot"] }
        } as ChatMessage];
        setMessages(next);
        updateConversationMessages(currentConversationId, next);
        setShowFloatingResponse(true);
        setShowHistory(true); // Automatically open the full screen chat history
        setIsTyping(false);
        setPipelineStep(0);
        clearInterval(stepInterval);
      }, 3500);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      const next = [...updated, { 
        role: "assistant", 
        content: data.generated_response, 
        category: data.category, 
        citations: data.citations,
        metadata: data.metadata
      } as ChatMessage];
      setMessages(next);
      updateConversationMessages(currentConversationId, next);
      setShowFloatingResponse(true);
      setShowHistory(true); // Automatically open the full screen chat history
    } catch (err) {
      console.error("Chat error:", err);
      const errMsgs = [...updated, { role: "assistant", content: "Error: Connection to backend query service failed." } as ChatMessage];
      setMessages(errMsgs);
      updateConversationMessages(currentConversationId, errMsgs);
      setShowFloatingResponse(true);
      setShowHistory(true); // Automatically open the full screen chat history to show the error
    } finally {
      setIsTyping(false);
      setPipelineStep(0);
      clearInterval(stepInterval);
    }
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <>
      <SplashScreen />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Header 
          nodesCount={graphData.nodes.length}
          edgesCount={graphData.links.length}
          alertsCount={alerts.length}
          loading={loading}
          onShowPipeline={() => setShowPipelineVisualizer(true)}
          onRefresh={loadData}
          apiBaseUrl={API_BASE_URL}
        />
        <main className={`flex-1 flex flex-col md:flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 ${isMobile ? "h-[calc(100vh-144px)] pb-16" : "h-[calc(100vh-80px)] pb-0"}`}>
          <SchematicPanel 
            isFullScreen={isFullScreen}
            setIsFullScreen={setIsFullScreen}
            isMobile={isMobile}
            mobileTab={mobileTab}
            graphData={graphData}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            isOrganized={isOrganized}
            setIsOrganized={setIsOrganized}
            externalHighlightNodeIds={externalHighlightNodeIds}
            setExternalHighlightNodeIds={setExternalHighlightNodeIds}
            setActiveTab={setActiveTab}
          />
          <SidebarPanel 
            isMobile={isMobile}
            mobileTab={mobileTab}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedNode={selectedNode}
            onRunImpactAnalysis={handleRunImpactAnalysisAnimation}
            alerts={alerts}
            setSelectedAlert={setSelectedAlert}
            loading={loading}
            onRefresh={loadData}
          />
        </main>
      </div>

      <MobileNodeInspector 
        isMobile={isMobile}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        onRunImpactAnalysis={handleRunImpactAnalysisAnimation}
      />

      {isMobile && (
        <MobileNavBar 
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          onShowHistory={() => setShowHistory(true)}
          messagesCount={messages.length}
          alertsCount={alerts.length}
        />
      )}

      {!isFullScreen && !isMobile && (
        <>
          <PipelineStatusOverlay 
            isTyping={isTyping}
            pipelineStep={pipelineStep}
            lastAssistantMsg={lastAssistantMsg}
          />
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none">
            <div className="pointer-events-auto">
              <FloatingChatInput 
                inputMessage={inputMessage} 
                isTyping={isTyping} 
                onSubmit={handleSendMessage} 
                onChange={setInputMessage} 
                onToggleHistory={() => setShowHistory(!showHistory)} 
                shouldGlow={messages.length > 0 && !showHistory}
              />
            </div>
          </div>
        </>
      )}

      <ChatHistoryOverlay 
        show={showHistory} 
        conversations={conversations} 
        currentConversationId={currentConversationId} 
        messages={messages} 
        inputMessage={inputMessage} 
        isTyping={isTyping} 
        pipelineStep={pipelineStep} 
        onClose={() => setShowHistory(false)} 
        onCreateNewChat={handleCreateNewChat} 
        onSelectConversation={(c) => { setCurrentConversationId(c.id); setMessages(c.messages); }} 
        onDeleteChat={handleDeleteChat} 
        onSendMessage={handleSendMessage} 
        onInputChange={setInputMessage} 
      />

      <AlertDetailModal 
        selectedAlert={selectedAlert} 
        onClose={() => setSelectedAlert(null)} 
      />

      <AnimatePresence>
        {showPipelineVisualizer && (
          <PipelineVisualizer 
            onClose={() => setShowPipelineVisualizer(false)} 
            onComplete={loadData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFreeTierModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 font-sans"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-serif font-bold text-[#d97757] mb-3">
                Cloud Service Notice
              </h3>
              <p className="text-sm text-zinc-650 dark:text-zinc-300 mb-4 leading-relaxed font-serif italic">
                This public demonstration connects to a backend running on a free-tier hosting platform (Render).
              </p>
              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 mb-6">
                <div className="flex gap-2">
                  <span className="text-[#d97757] font-bold">⚡</span>
                  <p>
                    <strong>Cold Start Wait:</strong> If the server has been idle, the first query or page load will take <strong>30-50 seconds</strong> to wake up.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#d97757] font-bold">🗄️</span>
                  <p>
                    <strong>Database Persistent:</strong> The Qdrant Cloud vector database is fully persistent, but custom file uploads will reset when the server restarts.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#d97757] font-bold">💻</span>
                  <p>
                    <strong>Run Locally:</strong> For instant, sub-second responses and permanent local file storage, clone the repository and run the services locally.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowFreeTierModal(false)}
                  className="px-5 py-2.5 bg-[#d97757] hover:bg-[#c86646] text-white rounded-xl text-xs font-semibold transition cursor-pointer select-none"
                >
                  Enter Console
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
