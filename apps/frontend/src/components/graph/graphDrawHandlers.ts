import { Node } from "@/types";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  val?: number;
  interactive?: boolean;
  file_ext?: string;
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
  highlightNodes: Set<string> | Map<string, "primary" | "secondary">,
  selectedNodeId: string | null | undefined,
  isDark: boolean,
  nodeBorderLight: string,
  nodeBorderSelected: string,
  hoveredNodeId?: string | null
): void {
  const x = node.x;
  const y = node.y;
  const size = node.size || 3.5;
  const hasNode = highlightNodes instanceof Map
    ? highlightNodes.has(node.id)
    : highlightNodes.has(node.id);
  const highlightLevel = highlightNodes instanceof Map
    ? highlightNodes.get(node.id) || null
    : (highlightNodes.has(node.id) ? "primary" : null);
  const isHighlighted = highlightNodes.size === 0 || hasNode;
  const isSelected = selectedNodeId === node.id;
  const isHoveredNode = hoveredNodeId === node.id;
  const typeLower = (node.type || "concept").toLowerCase().trim();
  const isDocNode = typeLower === "source_document";

  ctx.save();

  // Interactive nodes (documents, or all nodes in fallback mode) are primary
  // Non-interactive entity nodes are decorative
  if (node.interactive) {
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.4;
  } else {
    ctx.globalAlpha = isHighlighted ? 0.45 : 0.12;
  }

  if (highlightNodes instanceof Map && highlightNodes.size > 0 && hasNode && highlightLevel) {
    if (highlightLevel === "primary") {
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#d97757";
    } else {
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#6a9bcc";
    }
  }

  if (isDocNode) {
    // === SOURCE DOCUMENT NODE: Large rounded rectangle with document icon ===
    const isHovered = isHoveredNode;

    if (isHovered || isSelected) {
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#d97757";
    }

    // Determine color by file extension
    const ext = (node.file_ext || "").toLowerCase();
    let docColor = "#d97757";
    if (ext === ".csv") docColor = "#788c5d";
    else if (ext === ".xlsx" || ext === ".xls") docColor = "#4ade80";
    else if (ext === ".png" || ext === ".jpg") docColor = "#a78bfa";
    else if (ext === ".pdf") docColor = "#d97757";

    // Draw rounded rectangle body
    const w = 28;
    const h = 22;
    const r = 4;

    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.lineTo(x + w / 2 - r, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    ctx.lineTo(x + w / 2, y + h / 2 - r);
    ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    ctx.lineTo(x - w / 2 + r, y + h / 2);
    ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
    ctx.lineTo(x - w / 2, y - h / 2 + r);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
    ctx.closePath();

    // Fill
    ctx.fillStyle = isDark ? "#1e1e1e" : "#ffffff";
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected || isHovered ? docColor : (isDark ? "#3f3f46" : "#d4d4d8");
    ctx.lineWidth = isSelected || isHovered ? 2.2 : 1.2;
    ctx.stroke();

    // Document icon (small colored corner fold)
    const foldSize = 5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - foldSize, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2 + foldSize);
    ctx.lineTo(x + w / 2 - foldSize, y - h / 2 + foldSize);
    ctx.closePath();
    ctx.fillStyle = docColor;
    ctx.fill();

    // Extension badge
    const extLabel = ext.replace(".", "").toUpperCase() || "DOC";
    ctx.font = "bold 5px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = docColor;
    ctx.fillText(extLabel, x, y - 2);

    // Horizontal lines (simulating text)
    ctx.strokeStyle = isDark ? "#3f3f46" : "#d4d4d8";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      const ly = y + 3 + i * 3;
      ctx.beginPath();
      ctx.moveTo(x - 8, ly);
      ctx.lineTo(x + 8 - i * 2, ly);
      ctx.stroke();
    }

    // Label below — always visible for document nodes
    const labelText = node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label;
    const fontSize = Math.max(4, 10 / globalScale);
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.5;

    ctx.strokeStyle = isDark ? "#141413" : "#faf9f5";
    ctx.lineWidth = 3.0;
    ctx.lineJoin = "round";
    ctx.strokeText(labelText, x, y + h / 2 + 4);

    ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
    ctx.fillText(labelText, x, y + h / 2 + 4);

  } else if (node.interactive) {
    // === ENTITY NODE in fallback mode (no documents exist): render as labeled shape ===
    const color = typeColors[typeLower] || typeColors[node.type] || "#b0aea5";

    if (isHoveredNode || isSelected) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
    }

    // Rounded pill shape
    const labelText = node.label.length > 14 ? node.label.slice(0, 12) + "…" : node.label;
    ctx.font = "600 7px Inter, system-ui, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const w = textW + 12;
    const h = 14;
    const r = 7;

    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.lineTo(x + w / 2 - r, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y);
    ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    ctx.lineTo(x - w / 2 + r, y + h / 2);
    ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? (isDark ? "#faf9f5" : "#141413") : (isDark ? "#3f3f46" : "#d4d4d8");
    ctx.lineWidth = isSelected ? 1.5 : 0.6;
    ctx.stroke();

    ctx.fillStyle = "#faf9f5";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, x, y);

  } else {
    // === ENTITY NODES: Small, non-interactive dots ===
    const color = typeColors[typeLower] || typeColors[node.type] || "#b0aea5";
    const r = Math.max(2.5, size * 0.6);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Show label only when highlighted (from document click)
    if (hasNode && highlightLevel) {
      ctx.globalAlpha = 0.9;
      const fontSize = Math.max(3, 7 / globalScale);
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.strokeStyle = isDark ? "#141413" : "#faf9f5";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      const lbl = node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label;
      ctx.strokeText(lbl, x, y + r + 2);
      ctx.fillStyle = isDark ? "#faf9f5" : "#141413";
      ctx.fillText(lbl, x, y + r + 2);
    }
  }

  ctx.restore();
}

export function drawLink(
  link: GraphLink,
  ctx: CanvasRenderingContext2D,
  highlightLinks: Set<GraphLink>,
  linkDefault: string,
  showLabels?: boolean
): void {
  const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link);
  const source = link.source;
  const target = link.target;

  if (typeof source !== "object" || typeof target !== "object") return;

  ctx.save();
  ctx.beginPath();

  let strokeColor = linkDefault;
  let defaultAlpha = 0.22;

  if (link.type === "EXTRACTED_FROM") {
    // Subtle straight line from document to entity
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    defaultAlpha = 0.12;
  } else if (link.type === "SHARED_CONTEXT") {
    // Dashed line between documents
    ctx.setLineDash([4, 3]);
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    strokeColor = "#d97757";
    defaultAlpha = 0.4;
  } else {
    // Orthogonal right-angle connector for entity-entity links
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(source.x, target.y);
    ctx.lineTo(target.x, target.y);
  }

  if (link.type === "VIOLATES") {
    strokeColor = "#EF4444";
    defaultAlpha = 0.45;
  } else if (link.type === "COMPLIES_WITH") {
    strokeColor = "#788c5d";
    defaultAlpha = 0.35;
  }

  const isHovered = isHighlighted && highlightLinks.size > 0;
  const isDark = linkDefault === "#b0aea5";
  const hoverColor = isDark ? "#faf9f5" : "#141413";
  ctx.strokeStyle = isHovered ? hoverColor : strokeColor;
  ctx.lineWidth = isHovered ? 1.4 : (link.type === "SHARED_CONTEXT" ? 1.0 : 0.5);
  ctx.globalAlpha = isHighlighted ? 0.85 : defaultAlpha;

  ctx.stroke();

  // Edge label on highlighted links
  if (showLabels && isHovered && link.type) {
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const label = link.type.replace("_", " ");

    ctx.font = "bold 6px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textW = ctx.measureText(label).width + 6;

    // Background pill
    ctx.globalAlpha = 0.9;
    let bgColor = isDark ? "#27272a" : "#ffffff";
    let textColor = "#b0aea5";
    if (link.type === "VIOLATES") { textColor = "#EF4444"; }
    else if (link.type === "COMPLIES_WITH") { textColor = "#788c5d"; }

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(midX - textW / 2, midY - 5, textW, 10, 3);
    ctx.fill();
    ctx.strokeStyle = isDark ? "#3f3f46" : "#e4e4e7";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = textColor;
    ctx.fillText(label, midX, midY);
  }

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
  const typeLower = (node.type || "concept").toLowerCase().trim();

  ctx.save();
  ctx.fillStyle = color;

  if (node.interactive) {
    if (typeLower === "source_document") {
      const w = 50;
      const h = 50;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    } else {
      // Interactive entity nodes (fallback mode)
      const w = 40;
      const h = 20;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    }
  }
  // Non-interactive nodes: draw nothing

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
