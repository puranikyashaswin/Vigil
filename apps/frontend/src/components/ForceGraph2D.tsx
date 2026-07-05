"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import ForceGraph2DClient from "react-force-graph-2d";
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
}

interface ForceGraphInstance {
  d3Force: (name: string) => any;
  d3ReheatSimulation: () => void;
  zoomToFit: (duration: number, padding: number) => void;
  centerAt: (x: number, y: number, duration: number) => void;
  zoom: (level: number, duration: number) => void;
}

export default function ForceGraph2D({ data, onNodeClick, selectedNodeId }: ForceGraph2DProps) {
  const { resolvedTheme } = useTheme();
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());

  const isDark = resolvedTheme === "dark";
  const TYPE_COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const canvasBg = isDark ? "#09090b" : "#fafafa";
  const nodeBorderLight = isDark ? "#18181b" : "#fafafa";
  const nodeBorderSelected = isDark ? "#fafafa" : "#18181b";
  const linkDefault = isDark ? "#52525b" : "#d4d4d8";

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
      const nx = (n as any).x;
      const ny = (n as any).y;
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
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!fgRef.current || initializedData.nodes.length === 0) return;
    const chargeForce = fgRef.current.d3Force("charge");
    if (chargeForce) chargeForce.strength(-350).distanceMax(300);
    const centerForce = fgRef.current.d3Force("center");
    if (centerForce) centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    const linkForce = fgRef.current.d3Force("link");
    if (linkForce) linkForce.distance(130).strength(0.8);
    const collisionForce = fgRef.current.d3Force("collision");
    if (collisionForce) collisionForce.radius(35).strength(0.7);
    fgRef.current.d3ReheatSimulation();
    setTimeout(() => {
      if (fgRef.current) fgRef.current.zoomToFit(400, 100);
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
          ref={fgRef as any}
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
          onNodeClick={(node: any) => onNodeClick(node as Node)}
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}
