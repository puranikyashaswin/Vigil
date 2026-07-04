"use client";

import React, { useRef, useEffect, useState } from "react";
import ForceGraph3DClient from "react-force-graph-3d";

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

interface ForceGraph3DProps {
  data: GraphData;
  onNodeClick: (node: Node) => void;
  selectedNodeId?: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  concept: "#06B6D4",
  equipment: "#06B6D4",
  procedure: "#10B981",
  regulation: "#6366F1",
  maintenance_log: "#F59E0B",
  alert: "#EF4444",
};

export default function ForceGraph3D({ data, onNodeClick, selectedNodeId }: ForceGraph3DProps) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize canvas to parent container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    // Auto-focus camera on load
    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
      }
    }, 800);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Animate node fly-in if selected
  useEffect(() => {
    if (selectedNodeId && fgRef.current && data.nodes) {
      const node = data.nodes.find((n) => n.id === selectedNodeId);
      if (node) {
        // Aim camera at node coordinates
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
        
        fgRef.current.cameraPosition(
          { 
            x: (node.x || 0) * distRatio, 
            y: (node.y || 0) * distRatio, 
            z: (node.z || 0) * distRatio 
          },
          node, // lookAt
          2000  // transition ms
        );
      }
    }
  }, [selectedNodeId, data.nodes]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-bg-space/40 rounded-xl border border-white/5">
      {data.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#0B0F19]">
          <div className="w-16 h-16 rounded-full bg-accent-cyan/15 flex items-center justify-center pulse-core mb-4 border border-accent-cyan/30">
            <div className="w-6 h-6 rounded-full bg-accent-cyan" />
          </div>
          <h3 className="text-xl font-medium font-heading tracking-tight text-white mb-2">Vigil Intelligence Core</h3>
          <p className="text-sm text-gray-400 max-w-sm">
            Knowledge Graph is currently empty. Ingest active documents to populate nodes and links.
          </p>
        </div>
      ) : (
        <ForceGraph3DClient
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          backgroundColor="rgba(11, 15, 25, 0.0)" // transparent container bg
          nodeLabel={(node: any) => `
            <div class="px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-xs shadow-lg max-w-xs">
              <div class="font-bold text-white mb-0.5">${node.label}</div>
              <div class="text-[10px] text-gray-400 uppercase font-mono tracking-wider">${node.type}</div>
            </div>
          `}
          nodeColor={(node: any) => {
            if (node.id === selectedNodeId) return "#FFFFFF"; // highlight active selection
            return TYPE_COLORS[node.type] || "#FFFFFF";
          }}
          nodeVal={(node: any) => node.val || 4}
          nodeResolution={24}
          linkWidth={(link: any) => {
            const isRelated = selectedNodeId && (link.source.id === selectedNodeId || link.target.id === selectedNodeId);
            return isRelated ? 2.5 : 1.0;
          }}
          linkColor={(link: any) => {
            const isRelated = selectedNodeId && (link.source.id === selectedNodeId || link.target.id === selectedNodeId);
            return isRelated ? "rgba(6, 182, 212, 0.8)" : "rgba(255, 255, 255, 0.15)";
          }}
          linkDirectionalParticles={(link: any) => {
            const isRelated = selectedNodeId && (link.source.id === selectedNodeId || link.target.id === selectedNodeId);
            return isRelated ? 4 : 0;
          }}
          linkDirectionalParticleWidth={2.0}
          linkDirectionalParticleSpeed={0.008}
          onNodeClick={(node: any) => onNodeClick(node as Node)}
        />
      )}
    </div>
  );
}
