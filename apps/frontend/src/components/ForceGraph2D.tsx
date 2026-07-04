"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
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

const LIGHT_COLORS: Record<string, string> = {
  concept:         "#a1a1aa", // zinc-400
  equipment:       "#a1a1aa", // zinc-400
  procedure:       "#71717a", // zinc-500
  regulation:      "#52525b", // zinc-600
  maintenance_log: "#3f3f46", // zinc-700
  alert:           "#d97757", // clay
};

const DARK_COLORS: Record<string, string> = {
  concept:         "#71717a", // zinc-500
  equipment:       "#71717a", // zinc-500
  procedure:       "#a1a1aa", // zinc-400
  regulation:      "#d4d4d8", // zinc-300
  maintenance_log: "#e4e4e7", // zinc-200
  alert:           "#d97757", // clay (same)
};

export default function ForceGraph2D({ data, onNodeClick, selectedNodeId }: ForceGraph2DProps) {
  const { resolvedTheme } = useTheme();
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());

  const isDark = resolvedTheme === "dark";
  const TYPE_COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const canvasBg = isDark ? "#09090b" : "#fafafa";
  const canvasBorder = isDark ? "#3f3f46" : "#d4d4d8";
  const nodeBorderLight = isDark ? "#18181b" : "#fafafa";
  const nodeBorderSelected = isDark ? "#fafafa" : "#18181b";
  const linkDefault = isDark ? "#52525b" : "#d4d4d8";

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

  const initializedData = useMemo(() => {
    const nodes = data.nodes.map((n, idx) => {
      if (n.x !== undefined && n.y !== undefined) {
        return { ...n };
      }
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

  useEffect(() => {
    if (!fgRef.current || initializedData.nodes.length === 0) return;

    const chargeForce = fgRef.current.d3Force("charge");
    if (chargeForce) {
      chargeForce.strength(-240).distanceMax(400);
    }

    const centerForce = fgRef.current.d3Force("center");
    if (centerForce) {
      centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    }

    const linkForce = fgRef.current.d3Force("link");
    if (linkForce) {
      linkForce.distance(115).strength(0.65);
    }

    fgRef.current.d3ReheatSimulation();

    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
      }
    }, 1000);
  }, [initializedData.nodes.length, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (selectedNodeId && fgRef.current && initializedData.nodes) {
      const node = initializedData.nodes.find((n) => n.id === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(2.0, 800);
      }
    }
  }, [selectedNodeId, initializedData.nodes]);

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
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
      {initializedData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-950">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 border border-zinc-300 dark:border-zinc-600">
            <div className="w-6 h-6 bg-clay" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Vigil Intelligence Core</h3>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-sm">
            Knowledge Graph is currently empty. Ingest active documents to populate nodes and links.
          </p>
        </div>
      ) : (
        <ForceGraph2DClient
          key={isDark ? "dark" : "light"}
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={initializedData}
          backgroundColor={canvasBg}
          nodeRelSize={1}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.label || node.id;
            const size = Math.max(3.5, 3.5 + (degrees[node.id] || 0) * 0.9);
            
            const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
            const isSelected = selectedNodeId === node.id;
            
            ctx.save();
            
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, size + 3.5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "#d97757";
              ctx.lineWidth = 1.8;
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            
            ctx.fillStyle = TYPE_COLORS[node.type] || "#a1a1aa";
            ctx.globalAlpha = isHighlighted ? 1.0 : 0.12;
            ctx.fill();

            ctx.strokeStyle = isSelected ? nodeBorderSelected : nodeBorderLight;
            ctx.lineWidth = 0.6;
            ctx.stroke();

            const fontSize = Math.max(2.4, 9 / globalScale);
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isDark ? "#f4f4f5" : "#18181b";
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
            
            ctx.strokeStyle = isHighlighted ? "#d97757" : linkDefault;
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
