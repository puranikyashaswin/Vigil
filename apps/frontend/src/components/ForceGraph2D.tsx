"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import ForceGraph2DClient, { ForceGraphMethods } from "react-force-graph-2d";
import { LIGHT_COLORS, DARK_COLORS } from "./graph/graphColors";
import { drawNode, drawLink, drawNodePointerArea, initializeGraphData, GraphNode, GraphLink } from "./graph/graphDrawHandlers";
import { Node } from "@/types";
import { Sliders } from "lucide-react";
import GraphPhysicsConfig from "./GraphPhysicsConfig";
import { useOrganizedLayout } from "./graph/useOrganizedLayout";

interface GraphData {
  nodes: Node[];
  links: { source: string | GraphNode; target: string | GraphNode; index?: number }[];
}

interface ForceGraph2DProps {
  data: GraphData;
  onNodeClick: (node: Node) => void;
  selectedNodeId?: string | null;
  isOrganized?: boolean;
  externalHighlightNodeIds?: Set<string>;
}

export default function ForceGraph2D({ data, onNodeClick, selectedNodeId, isOrganized = false, externalHighlightNodeIds }: ForceGraph2DProps) {
  const { resolvedTheme } = useTheme();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());
  const [chargeStrength, setChargeStrength] = useState(-240);
  const [linkDistance, setLinkDistance] = useState(95);
  const [collisionRadius, setCollisionRadius] = useState(36);
  const [showConfig, setShowConfig] = useState(false);

  const isDark = resolvedTheme === "dark";
  const TYPE_COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const canvasBg = isDark ? "#141413" : "#faf9f5";
  const nodeBorderLight = isDark ? "#b0aea5" : "#e8e6dc";
  const nodeBorderSelected = isDark ? "#faf9f5" : "#141413";
  const linkDefault = isDark ? "#b0aea5" : "#e8e6dc";

  const initializedData = useMemo(() => {
    return initializeGraphData(data, dimensions.width, dimensions.height);
  }, [data, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 50 && h > 50) {
          setDimensions({ width: w, height: h });
        }
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
    if (dimensions.width < 100 || dimensions.height < 100) return;

    const chargeForce = fgRef.current.d3Force("charge");
    if (chargeForce) chargeForce.strength(chargeStrength).distanceMax(250);
    const centerForce = fgRef.current.d3Force("center");
    if (centerForce) centerForce.x(dimensions.width / 2).y(dimensions.height / 2);
    const linkForce = fgRef.current.d3Force("link");
    if (linkForce) linkForce.distance(linkDistance).strength(0.8);
    const collisionForce = fgRef.current.d3Force("collision");
    if (collisionForce) collisionForce.radius(collisionRadius).strength(0.7);

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

  useOrganizedLayout(isOrganized, initializedData.nodes, dimensions.width, dimensions.height, fgRef);

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
    const activeHighlights = externalHighlightNodeIds && externalHighlightNodeIds.size > 0 
      ? externalHighlightNodeIds 
      : highlightNodes;
    drawNode(node, ctx, globalScale, TYPE_COLORS, activeHighlights, selectedNodeId, isDark, nodeBorderLight, nodeBorderSelected);
  }, [TYPE_COLORS, highlightNodes, externalHighlightNodeIds, selectedNodeId, isDark, nodeBorderLight, nodeBorderSelected]);

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const activeHighlightLinks = externalHighlightNodeIds && externalHighlightNodeIds.size > 0
      ? new Set(initializedData.links.filter((l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          return externalHighlightNodeIds.has(s) && externalHighlightNodeIds.has(t);
        }))
      : highlightLinks;
    drawLink(link, ctx, activeHighlightLinks, linkDefault);
  }, [highlightLinks, externalHighlightNodeIds, initializedData.links, linkDefault]);

  const nodeVal = useCallback((node: GraphNode) => {
    const size = node.size || 3.5;
    const hitSize = Math.max(6, size);
    return hitSize * hitSize;
  }, []);

  const nodePointerAreaPaint = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    drawNodePointerArea(node, color, ctx, globalScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 select-none touch-none">
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
        <>
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
            nodePointerAreaPaint={nodePointerAreaPaint}
            enableZoomInteraction={true}
            enablePanInteraction={true}
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

          {/* Obsidian-Style Force Control Button & Panel */}
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all shadow-lg"
          >
            <Sliders className="w-5 h-5" />
          </button>

          {showConfig && (
            <GraphPhysicsConfig
              chargeStrength={chargeStrength}
              setChargeStrength={setChargeStrength}
              linkDistance={linkDistance}
              setLinkDistance={setLinkDistance}
              collisionRadius={collisionRadius}
              setCollisionRadius={setCollisionRadius}
              onClose={() => setShowConfig(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
