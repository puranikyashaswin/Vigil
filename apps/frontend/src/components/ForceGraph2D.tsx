"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import ForceGraph2DClient, { ForceGraphMethods } from "react-force-graph-2d";
import { LIGHT_COLORS, DARK_COLORS } from "./graph/graphColors";
import { drawNode, drawLink, GraphNode, GraphLink } from "./graph/graphDrawHandlers";
import { Node } from "@/types";

interface GraphData {
  nodes: Node[];
  links: { source: string | GraphNode; target: string | GraphNode; index?: number }[];
}

interface ForceGraph2DProps {
  data: GraphData;
  onNodeClick: (node: Node) => void;
  selectedNodeId?: string | null;
  isOrganized?: boolean;
}

export default function ForceGraph2D({ data, onNodeClick, selectedNodeId, isOrganized = false }: ForceGraph2DProps) {
  const { resolvedTheme } = useTheme();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());

  const isDark = resolvedTheme === "dark";
  const TYPE_COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const canvasBg = isDark ? "#141413" : "#faf9f5";
  const nodeBorderLight = isDark ? "#b0aea5" : "#e8e6dc";
  const nodeBorderSelected = isDark ? "#faf9f5" : "#141413";
  const linkDefault = isDark ? "#b0aea5" : "#e8e6dc";

  const initializedData = useMemo(() => {
    const degs: Record<string, number> = {};
    data.nodes.forEach((n) => { degs[n.id] = 0; });
    data.links.forEach((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      if (degs[sourceId] !== undefined) degs[sourceId]++;
      if (degs[targetId] !== undefined) degs[targetId]++;
    });
    const nodes: GraphNode[] = data.nodes.map((n, idx) => {
      const degree = degs[n.id] || 0;
      const size = Math.max(3.5, 3.5 + degree * 0.9);
      const angle = (idx / (data.nodes.length || 1)) * 2 * Math.PI;
      const radius = 120 + Math.random() * 40;
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const nx = (n as Partial<GraphNode>).x;
      const ny = (n as Partial<GraphNode>).y;
      return {
        ...n,
        x: nx !== undefined ? nx : centerX + Math.cos(angle) * radius,
        y: ny !== undefined ? ny : centerY + Math.sin(angle) * radius,
        degree,
        size
      };
    });
    const links: GraphLink[] = data.links.map((l) => ({ ...l }) as GraphLink);
    return { nodes, links };
  }, [data, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const hasZoomedRef = useRef(false);

  useEffect(() => {
    hasZoomedRef.current = false;
  }, [initializedData.nodes.length]);

  useEffect(() => {
    if (!fgRef.current || initializedData.nodes.length === 0 || isOrganized) return;
    const chargeForce = fgRef.current.d3Force("charge");
    if (chargeForce) chargeForce.strength(-240).distanceMax(250);
    const centerForce = fgRef.current.d3Force("center");
    if (centerForce) centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    const linkForce = fgRef.current.d3Force("link");
    if (linkForce) linkForce.distance(95).strength(0.8);
    const collisionForce = fgRef.current.d3Force("collision");
    if (collisionForce) collisionForce.radius(36).strength(0.7);
    fgRef.current.d3ReheatSimulation();
    setTimeout(() => {
      if (fgRef.current && !hasZoomedRef.current && !isOrganized) {
        fgRef.current.zoomToFit(600, 60);
        hasZoomedRef.current = true;
      }
    }, 1500);
  }, [initializedData.nodes.length, dimensions.width, dimensions.height, isOrganized]);

  useEffect(() => {
    if (selectedNodeId && fgRef.current && initializedData.nodes) {
      const node = initializedData.nodes.find((n) => n.id === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(2.0, 800);
      }
    }
  }, [selectedNodeId, initializedData.nodes]);

  useEffect(() => {
    if (initializedData.nodes.length === 0) return;
    
    if (isOrganized) {
      const N = initializedData.nodes.length;
      const C_x = dimensions.width / 2;
      const C_y = dimensions.height / 2;
      const R = Math.min(dimensions.width, dimensions.height) * 0.35;
      
      const startPositions = initializedData.nodes.map((n) => ({
        id: n.id,
        x: n.x ?? C_x,
        y: n.y ?? C_y
      }));
      
      const targets = initializedData.nodes.map((n, idx) => {
        const theta = (idx / N) * 2 * Math.PI;
        return {
          id: n.id,
          x: C_x + R * Math.cos(theta),
          y: C_y + R * Math.sin(theta)
        };
      });
      
      const duration = 600;
      const startTime = performance.now();
      
      let animFrameId: number;
      
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        const ease = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
        initializedData.nodes.forEach((node) => {
          const start = startPositions.find((p) => p.id === node.id);
          const target = targets.find((t) => t.id === node.id);
          if (start && target) {
            node.fx = start.x + (target.x - start.x) * ease;
            node.fy = start.y + (target.y - start.y) * ease;
          }
        });
        
        if (progress < 1) {
          animFrameId = requestAnimationFrame(animate);
        } else {
          initializedData.nodes.forEach((node) => {
            const target = targets.find((t) => t.id === node.id);
            if (target) {
              node.fx = target.x;
              node.fy = target.y;
            }
          });
        }
      };
      
      animFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animFrameId);
    } else {
      initializedData.nodes.forEach((node) => {
        node.fx = undefined;
        node.fy = undefined;
      });
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }
    }
  }, [isOrganized, initializedData.nodes, dimensions.width, dimensions.height]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    const hNodes = new Set<string>();
    const hLinks = new Set<GraphLink>();
    if (node) {
      hNodes.add(node.id);
      initializedData.links.forEach((l) => {
        const sourceId = typeof l.source === "object" ? l.source.id : l.source;
        const targetId = typeof l.target === "object" ? l.target.id : l.target;
        if (sourceId === node.id) { hNodes.add(targetId as string); hLinks.add(l); }
        else if (targetId === node.id) { hNodes.add(sourceId as string); hLinks.add(l); }
      });
    }
    setHighlightNodes(hNodes);
    setHighlightLinks(hLinks);
  }, [initializedData.links]);

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    drawNode(node, ctx, globalScale, TYPE_COLORS, highlightNodes, selectedNodeId, isDark, nodeBorderLight, nodeBorderSelected);
  }, [TYPE_COLORS, highlightNodes, selectedNodeId, isDark, nodeBorderLight, nodeBorderSelected]);

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    drawLink(link, ctx, highlightLinks, linkDefault);
  }, [highlightLinks, linkDefault]);

  const nodeVal = useCallback((node: GraphNode) => {
    const size = node.size || 3.5;
    const hitSize = Math.max(6, size);
    return hitSize * hitSize;
  }, []);

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
          ref={fgRef as unknown as React.MutableRefObject<ForceGraphMethods<GraphNode, GraphLink> | undefined>}
          width={dimensions.width}
          height={dimensions.height}
          graphData={initializedData}
          backgroundColor={canvasBg}
          nodeRelSize={1}
          nodeCanvasObject={nodeCanvasObject}
          linkCanvasObject={linkCanvasObject}
          nodeVal={nodeVal}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.35}
          onNodeHover={handleNodeHover}
          onNodeClick={(node) => onNodeClick(node as unknown as Node)}
          enableNodeDrag={true}
          onEngineStop={() => {
            if (fgRef.current && !hasZoomedRef.current) {
              fgRef.current.zoomToFit(600, 60);
              hasZoomedRef.current = true;
            }
          }}
        />
      )}
    </div>
  );
}
