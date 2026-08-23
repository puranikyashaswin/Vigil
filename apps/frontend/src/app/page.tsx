"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useGraphUpdates } from "@/hooks/useGraphUpdates";
import Header from "@/components/Header";
import SchematicPanel from "@/components/SchematicPanel";
import SidebarPanel from "@/components/SidebarPanel";
import MobileNodeInspector from "@/components/MobileNodeInspector";
import MobileNavBar from "@/components/MobileNavBar";
import PipelineStatusOverlay from "@/components/PipelineStatusOverlay";
import FloatingChatInput from "@/components/FloatingChatInput";
import ChatHistoryOverlay from "@/components/ChatHistoryOverlay";
import AlertDetailModal from "@/components/AlertDetailModal";
import DocumentViewer from "@/components/DocumentViewer";
import SplashScreen from "@/components/SplashScreen";
import { Node, GraphData, Alert, ChatMessage, Conversation } from "@/types";

const PipelineVisualizer = dynamic(() => import("@/components/PipelineVisualizer"), { ssr: false });
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"inspect" | "alerts" | "kb">("inspect");
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
  const [externalHighlightNodeIds, setExternalHighlightNodeIds] = useState<Set<string> | Map<string, "primary" | "secondary">>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  const [isOrganized, setIsOrganized] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"graph" | "alerts">("graph");
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [stats, setStats] = useState<{ source_documents: number; entities: number; vectors: number; queries_served: number } | null>(null);

  const handleGraphUpdate = useCallback((newNodeIds: string[]) => {
    loadData();
    if (newNodeIds.length > 0) {
      const m = new Map<string, "primary" | "secondary">();
      newNodeIds.forEach(id => m.set(id, "primary"));
      setExternalHighlightNodeIds(m);
      setTimeout(() => setExternalHighlightNodeIds(new Map()), 5000);
    }
  }, []);

  useGraphUpdates(API_BASE_URL, handleGraphUpdate);

  const handleRunImpactAnalysisAnimation = (nodeIds: Set<string>) => {
    const idsArray = Array.from(nodeIds);
    setExternalHighlightNodeIds(new Map());
    idsArray.forEach((id, idx) => {
      setTimeout(() => {
        setExternalHighlightNodeIds((prev) => {
          const next = new Map(prev as Map<string, "primary" | "secondary">);
          next.set(id, "primary");
          return next;
        });
      }, idx * 500);
    });
  };

  const triggerCitationImpactRipple = (citations: { source_file: string; score: number }[]) => {
    const relevantCitations = citations.filter(c => c.score >= 0.55);
    if (relevantCitations.length === 0) return;

    const citedNodeIds = new Set(relevantCitations.map(c => c.source_file));
    const neighbors = new Set<string>();

    citedNodeIds.forEach(nodeId => {
      graphData.links.forEach(link => {
        const src = typeof link.source === "string" ? link.source : (link.source as any).id;
        const tgt = typeof link.target === "string" ? link.target : (link.target as any).id;
        if (src === nodeId) neighbors.add(tgt);
        if (tgt === nodeId) neighbors.add(src);
      });
    });

    const primaryIds = Array.from(citedNodeIds);
    const secondaryIds = Array.from(neighbors).filter(n => !citedNodeIds.has(n));
    const allIds = [...primaryIds, ...secondaryIds];

    setExternalHighlightNodeIds(new Map());
    allIds.forEach((id, idx) => {
      setTimeout(() => {
        setExternalHighlightNodeIds((prev) => {
          const next = new Map(prev as Map<string, "primary" | "secondary">);
          next.set(id, citedNodeIds.has(id) ? "primary" : "secondary");
          return next;
        });
      }, idx * 300);
    });

    setTimeout(() => setExternalHighlightNodeIds(new Map()), allIds.length * 300 + 5000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [graphRes, alertsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/graph`),
        fetch(`${API_BASE_URL}/api/alerts`),
        fetch(`${API_BASE_URL}/api/stats`).catch(() => null)
      ]);
      if (graphRes.ok && alertsRes.ok) {
        setGraphData(await graphRes.json());
        setAlerts(await alertsRes.json());
        if (statsRes && statsRes.ok) {
          setStats(await statsRes.json());
        }
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
                return [newConv];
        }
      }
      localStorage.setItem("vigil_conversations", JSON.stringify(filtered));
      return filtered;
    });
  };

  const handleAskVigil = (query: string) => {
    setShowHistory(true);
    sendQuery(query);
  };

  const handleSendFollowUp = (question: string) => {
    sendQuery(question);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    sendQuery(inputMessage);
  };

  const sendQuery = async (queryText: string) => {
    setInputMessage("");
    const updated = [...messages, { role: "user", content: queryText } as ChatMessage];
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
          content: "**Live Chat Notice**: The multi-agent pipeline is disabled in this static preview. To query the Expert Copilot, RCA, Compliance, or Lessons-Learned agents, deploy the backend with AWS Bedrock credentials configured.",
          category: "Expert Copilot",
          metadata: { trace: ["route_intent", "expert_copilot"] }
        } as ChatMessage];
        setMessages(next);
        updateConversationMessages(currentConversationId, next);
        setShowHistory(true); // Automatically open the full screen chat history
        setIsTyping(false);
        setPipelineStep(0);
        clearInterval(stepInterval);
      }, 3500);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream connection failed");
      }

      clearInterval(stepInterval);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";
      let streamCategory = "";
      let streamCitations: { source_file: string; excerpt: string; score: number }[] = [];
      let streamMetadata: ChatMessage["metadata"] = {};
      let buffer = "";

      // Add placeholder assistant message for streaming
      const streamingMsg: ChatMessage = { role: "assistant", content: "", category: "" };
      const withPlaceholder = [...updated, streamingMsg];
      setMessages(withPlaceholder);
      setShowHistory(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith("data: ")) {
            const rawData = line.slice(6);
            try {
              const data = JSON.parse(rawData);

              if ("step" in data) {
                setPipelineStep(data.step);
              } else if ("token" in data) {
                streamedContent += data.token;
                setIsTyping(false);
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { ...copy[copy.length - 1], content: streamedContent };
                  return copy;
                });
              } else if ("category" in data && !("generated_response" in data)) {
                streamCategory = data.category;
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { ...copy[copy.length - 1], category: data.category };
                  return copy;
                });
              } else if ("warning" in data) {
                streamedContent = `⚠️ [SAFETY WARNING: Potential Contradiction Detected]\n${data.warning}\n\n` + streamedContent;
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { ...copy[copy.length - 1], content: streamedContent };
                  return copy;
                });
              } else if ("generated_response" in data) {
                // Final done event
                streamCitations = data.citations || [];
                streamMetadata = data.metadata || {};
                streamCategory = data.category || streamCategory;
                const finalContent = data.generated_response || streamedContent;
                const finalMsg: ChatMessage = {
                  role: "assistant",
                  content: finalContent,
                  category: streamCategory,
                  citations: streamCitations,
                  follow_ups: data.follow_ups || [],
                  metadata: streamMetadata,
                };
                const finalMessages = [...updated, finalMsg];
                setMessages(finalMessages);
                updateConversationMessages(currentConversationId, finalMessages);

                // Trigger impact ripple on graph
                if (streamCitations.length > 0) {
                  const relevant = streamCitations.filter((c: { score: number }) => c.score >= 0.55);
                  if (relevant.length > 0) {
                    const cited = new Set(relevant.map((c: { source_file: string }) => c.source_file));
                    let impactCount = cited.size;
                    cited.forEach(nodeId => {
                      graphData.links.forEach(link => {
                        const src = typeof link.source === "string" ? link.source : (link.source as any).id;
                        const tgt = typeof link.target === "string" ? link.target : (link.target as any).id;
                        if (src === nodeId && !cited.has(tgt)) impactCount++;
                        if (tgt === nodeId && !cited.has(src)) impactCount++;
                      });
                    });
                    finalMsg.metadata = { ...finalMsg.metadata, impact_nodes: impactCount };
                  }
                  triggerCitationImpactRipple(streamCitations);
                }
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      // Fallback to non-streaming endpoint
      try {
        const res = await fetch(`${API_BASE_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: queryText })
        });
        const data = await res.json();
        const next = [...updated, { role: "assistant", content: data.generated_response, category: data.category, citations: data.citations, metadata: data.metadata } as ChatMessage];
        setMessages(next);
        updateConversationMessages(currentConversationId, next);
        setShowHistory(true);
      } catch {
        const errMsgs = [...updated, { role: "assistant", content: "Error: Connection to backend query service failed." } as ChatMessage];
        setMessages(errMsgs);
        updateConversationMessages(currentConversationId, errMsgs);
        setShowHistory(true);
      }
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
          sourcesCount={stats?.source_documents ?? 0}
          entitiesCount={stats?.entities ?? 0}
          vectorsCount={stats?.vectors ?? 0}
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
            onAskVigil={handleAskVigil}
            onOpenDocument={(path) => setViewingDocument(path)}
            onTriggerUpload={() => setShowPipelineVisualizer(true)}
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
        onOpenDocument={setViewingDocument}
        onSendFollowUp={handleSendFollowUp}
      />

      <DocumentViewer
        filepath={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      <AlertDetailModal
        selectedAlert={selectedAlert} 
        onClose={() => setSelectedAlert(null)} 
      />

      <AnimatePresence>
        {showPipelineVisualizer && (
          <PipelineVisualizer
            onClose={() => setShowPipelineVisualizer(false)}
            onComplete={(newNodeIds) => {
              loadData();
              if (newNodeIds && newNodeIds.length > 0) {
                const m = new Map<string, "primary" | "secondary">();
                newNodeIds.forEach(id => m.set(id, "primary"));
                setExternalHighlightNodeIds(m);
                setTimeout(() => setExternalHighlightNodeIds(new Map()), 5000);
              }
            }}
          />
        )}
      </AnimatePresence>

    </>
  );
}
