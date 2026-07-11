import { Node } from "@/types";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  val?: number;
  x: number;
  y: number;
  degree: number;
  size: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  source: GraphNode | string;
  target: GraphNode | string;
  index?: number;
  type?: string;
}

export function drawNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  typeColors: Record<string, string>,
  highlightNodes: Set<string>,
  selectedNodeId: string | null | undefined,
  isDark: boolean,
  nodeBorderLight: string,
  nodeBorderSelected: string
): void {
  const x = node.x;
  const y = node.y;
  const size = node.size || 3.5;
  const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const typeLower = (node.type || "concept").toLowerCase().trim();
  const color = typeColors[typeLower] || typeColors[node.type] || "#b0aea5";

  ctx.save();
  ctx.globalAlpha = isHighlighted ? 1.0 : 0.15;

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, 2 * Math.PI);
    ctx.strokeStyle = isDark ? "#faf9f5" : "#141413";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  if (
    typeLower === "equipment" ||
    typeLower === "concept" ||
    typeLower === "drawing" ||
    typeLower === "event" ||
    typeLower === "organization"
  ) {
    // 1. Rectangular shape for Equipment / Concept nodes
    const w = size * 3.8;
    const h = size * 2.0;
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);

    ctx.strokeStyle = isSelected ? nodeBorderSelected : nodeBorderLight;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);

    // Inner mono-spaced equipment tag text
    const monoText = node.label.split(" ")[0] || node.label;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#faf9f5"; // Clear white text inside colored rectangles for high contrast
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(monoText, x, y);

  } else if (typeLower === "regulation") {
    // 2. Hexagon outline for Regulation nodes
    const r = size * 1.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2.5 : 1.8;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 0.25 : 0.05;
    ctx.fill();

  } else if (typeLower === "procedure" || typeLower === "maintenance_log" || typeLower === "maintenance") {
    // 3. File-tab shape for Document nodes
    const w = size * 3.2;
    const h = size * 2.2;
    const tabW = w * 0.4;
    const tabH = h * 0.25;

    ctx.beginPath();
    // Start at top-left under the tab height
    ctx.moveTo(x - w / 2, y - h / 2 + tabH);
    ctx.lineTo(x - w / 2, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW + 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? nodeBorderSelected : nodeBorderLight;
    ctx.lineWidth = 0.8;
    ctx.stroke();

  } else {
    // Fallback circular nodes (e.g. Alerts)
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? nodeBorderSelected : nodeBorderLight;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Draw external label underneath node types that do not put mono text inside
  if (
    typeLower !== "equipment" &&
    typeLower !== "concept" &&
    typeLower !== "drawing" &&
    typeLower !== "event" &&
    typeLower !== "organization"
  ) {
    const isHovered = highlightNodes.size > 0 && highlightNodes.has(node.id);
    const shouldShowLabel = globalScale > 0.8 || isSelected || isHovered;
    
    if (shouldShowLabel) {
      const fontSize = Math.max(3.2, 9 / globalScale);
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const isTextHighlighted = isHighlighted ? (globalScale > 1.1 || isSelected ? 1.0 : 0.85) : 0.15;
      ctx.globalAlpha = isTextHighlighted;
      
      // Draw background stroke for maximum contrast outline
      ctx.strokeStyle = isDark ? "#141413" : "#faf9f5";
      ctx.lineWidth = 3.0;
      ctx.lineJoin = "round";
      ctx.strokeText(node.label, x, y + size * 2.2 + 2);

      ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
      ctx.fillText(node.label, x, y + size * 2.2 + 2);
    }
  }

  ctx.restore();
}

export function drawLink(
  link: GraphLink,
  ctx: CanvasRenderingContext2D,
  highlightLinks: Set<GraphLink>,
  linkDefault: string
): void {
  const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
  const source = link.source;
  const target = link.target;

  if (typeof source !== "object" || typeof target !== "object") return;

  ctx.save();
  ctx.beginPath();
  
  // Orthogonal right-angle connector line
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(source.x, target.y);
  ctx.lineTo(target.x, target.y);

  // Classify stroke style by relationship type when not hovered/focused
  let strokeColor = linkDefault;
  let defaultAlpha = 0.22;
  
  if (link.type === "VIOLATES") {
    strokeColor = "#EF4444"; // Red for violations
    defaultAlpha = 0.45;     // Extra visibility for violations
  } else if (link.type === "COMPLIES_WITH") {
    strokeColor = "#788c5d"; // Green for compliance links
    defaultAlpha = 0.35;
  }

  // Hovered state gets accent color (white in dark mode, black in light mode), otherwise uses relation colors
  const isHovered = isHighlighted && highlightLinks.size > 0;
  const isDark = linkDefault === "#b0aea5";
  const hoverColor = isDark ? "#faf9f5" : "#141413";
  ctx.strokeStyle = isHovered ? hoverColor : strokeColor;
  ctx.lineWidth = isHovered ? 1.4 : 0.6;
  ctx.globalAlpha = isHighlighted ? 0.85 : defaultAlpha;
  
  ctx.stroke();
  ctx.restore();
}

export function drawNodePointerArea(
  node: GraphNode,
  color: string,
  ctx: CanvasRenderingContext2D,
  globalScale: number
): void {
  const x = node.x;
  const y = node.y;
  const size = node.size || 3.5;
  const typeLower = (node.type || "concept").toLowerCase().trim();

  // Keep hit areas close to the node boundaries when zoomed out (preventing overlapping),
  // but expand them when zoomed in to make tapping on mobile/touch screens easier.
  const padding = globalScale < 0.8 ? 2.0 : Math.min(8.0, 12 / globalScale);

  ctx.save();
  ctx.fillStyle = color;

  if (
    typeLower === "equipment" ||
    typeLower === "concept" ||
    typeLower === "drawing" ||
    typeLower === "event" ||
    typeLower === "organization"
  ) {
    const w = size * 3.8 + padding * 2;
    const h = size * 2.0 + padding * 2;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
  } else if (typeLower === "regulation") {
    const r = size * 1.8 + padding;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  } else if (
    typeLower === "procedure" ||
    typeLower === "maintenance_log" ||
    typeLower === "maintenance"
  ) {
    const w = size * 3.2 + padding * 2;
    const h = size * 2.2 + padding * 2;
    const tabW = w * 0.4;
    const tabH = h * 0.25;

    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + tabH);
    ctx.lineTo(x - w / 2, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW + 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
  } else {
    const r = size + padding;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}

export function initializeGraphData(
  data: { nodes: Node[]; links: { source: string | GraphNode; target: string | GraphNode; index?: number }[] },
  width: number,
  height: number
): { nodes: GraphNode[]; links: GraphLink[] } {
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
    const pseudoRandom = ((idx * 9301 + 49297) % 233280) / 233280;
    const radius = 120 + pseudoRandom * 40;
    const centerX = width / 2;
    const centerY = height / 2;
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
}
