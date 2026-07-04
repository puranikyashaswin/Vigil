"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import ForceGraph2DClient from "react-force-graph-2d";

interface Node {
  id: string;
  label: string;
  type: string;
  description?: string;
  val?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: any;
  target: any;
  index?: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface ForceGraph2DProps {
  data: GraphData;
  onNodeClick: (node: Node) => void;
  selectedNodeId?: string | null;
}

// Warm, muted brand guidelines palette
const TYPE_COLORS: Record<string, string> = {
  concept: "#6a9bcc",      // Accent Blue
  equipment: "#6a9bcc",    // Accent Blue
  procedure: "#788c5d",    // Accent Green
  regulation: "#d97757",   // Accent Orange/Clay
  maintenance_log: "#b0aea5", // Accent Gray
  alert: "#EF4444",        // Crimson
};

export default function ForceGraph2D({ data, onNodeClick, selectedNodeId }: ForceGraph2DProps) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover states for Obsidian style highlight
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());

  // Compute node connection counts (degrees) for sizing
  const degrees = useMemo(() => {
    const degs: Record<string, number> = {};
    data.nodes.forEach((n) => {
      degs[n.id] = 0;
    });
    data.links.forEach((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      if (degs[sourceId] !== undefined) degs[sourceId]++;
      if (degs[targetId] !== undefined) degs[targetId]++;
    });
    return degs;
  }, [data]);

  // Give nodes initial random/circular coordinates to start the physics simulation beautifully
  const initializedData = useMemo(() => {
    const nodes = data.nodes.map((n, idx) => {
      if (n.x !== undefined && n.y !== undefined) {
        return { ...n };
      }
      // Arrange initial positions in a circular pattern around the center
      const angle = (idx / (data.nodes.length || 1)) * 2 * Math.PI;
      const radius = 120 + Math.random() * 40;
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      return {
        ...n,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    const links = data.links.map((l) => ({ ...l }));
    return { nodes, links };
  }, [data, dimensions.width, dimensions.height]);

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
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Configure D3 forces and settle animations
  useEffect(() => {
    if (!fgRef.current || initializedData.nodes.length === 0) return;

    // Push force (prevent overlaps, distribute nodes nicely)
    const chargeForce = fgRef.current.d3Force("charge");
    if (chargeForce) {
      chargeForce.strength(-240).distanceMax(400);
    }

    // Centering force
    const centerForce = fgRef.current.d3Force("center");
    if (centerForce) {
      centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    }

    // Link pulling force
    const linkForce = fgRef.current.d3Force("link");
    if (linkForce) {
      linkForce.distance(115).strength(0.65);
    }

    // Warm up the physics engine
    fgRef.current.d3ReheatSimulation();

    // Auto fit layout view
    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
      }
    }, 1000);
  }, [initializedData.nodes.length, dimensions.width, dimensions.height]);

  // Handle selection zoom
  useEffect(() => {
    if (selectedNodeId && fgRef.current && initializedData.nodes) {
      const node = initializedData.nodes.find((n) => n.id === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(2.0, 800);
      }
    }
  }, [selectedNodeId, initializedData.nodes]);

  // Update hover highlights
  const handleNodeHover = (node: any) => {
    setHoverNode(node);
    const hNodes = new Set<string>();
    const hLinks = new Set<any>();

    if (node) {
      hNodes.add(node.id);
      initializedData.links.forEach((l) => {
        const sourceId = typeof l.source === "object" ? l.source.id : l.source;
        const targetId = typeof l.target === "object" ? l.target.id : l.target;
        if (sourceId === node.id) {
          hNodes.add(targetId);
          hLinks.add(l);
        } else if (targetId === node.id) {
          hNodes.add(sourceId);
          hLinks.add(l);
        }
      });
    }

    setHighlightNodes(hNodes);
    setHighlightLinks(hLinks);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#faf9f5] border border-[#e8e6dc] rounded-none">
      {initializedData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#faf9f5]">
          <div className="w-16 h-16 rounded-none bg-[#e8e6dc] flex items-center justify-center mb-4 border border-[#b0aea5]">
            <div className="w-6 h-6 bg-[#d97757]" />
          </div>
          <h3 className="text-lg font-bold font-mono uppercase tracking-tight text-[#141413] mb-2">Vigil Intelligence Core</h3>
          <p className="text-xs font-mono text-[#b0aea5] max-w-sm">
            Knowledge Graph is currently empty. Ingest active documents to populate nodes and links.
          </p>
        </div>
      ) : (
        <ForceGraph2DClient
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={initializedData}
          backgroundColor="#faf9f5"
          nodeRelSize={1}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.label || node.id;
            const size = Math.max(3.5, 3.5 + (degrees[node.id] || 0) * 0.9);
            
            // Dim if hover active and not highlighted
            const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
            const isSelected = selectedNodeId === node.id;
            
            ctx.save();
            
            // Render selection ring
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, size + 3.5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "#d97757"; // Clay highlight
              ctx.lineWidth = 1.8;
              ctx.stroke();
            }

            // Draw Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            
            ctx.fillStyle = TYPE_COLORS[node.type] || "#b0aea5";
            ctx.globalAlpha = isHighlighted ? 1.0 : 0.12;
            ctx.fill();

            // Border
            ctx.strokeStyle = isSelected ? "#141413" : "#faf9f5";
            ctx.lineWidth = 0.6;
            ctx.stroke();

            // Text Label (Obsidian-style)
            const fontSize = Math.max(2.4, 9 / globalScale);
            ctx.font = `${fontSize}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#141413";
            ctx.globalAlpha = isHighlighted ? (globalScale > 1.1 || isSelected ? 0.95 : 0.35) : 0.08;
            
            ctx.fillText(label, node.x, node.y + size + fontSize + 1.2);
            
            ctx.restore();
          }}
          linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
            const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
            const source = link.source;
            const target = link.target;
            
            if (typeof source !== "object" || typeof target !== "object") return;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            
            ctx.strokeStyle = isHighlighted ? "#d97757" : "#e8e6dc";
            ctx.lineWidth = isHighlighted ? 1.4 : 0.6;
            ctx.globalAlpha = isHighlighted ? 0.85 : 0.22;
            
            ctx.stroke();
            ctx.restore();
          }}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.35}
          onNodeHover={handleNodeHover}
          onNodeClick={(node: any) => onNodeClick(node as Node)}
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}
