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
  const color = typeColors[typeLower] || typeColors[node.type] || "#a1a1aa";

  ctx.save();
  ctx.globalAlpha = isHighlighted ? 1.0 : 0.15;

  // Selected outer ring decoration
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, 2 * Math.PI);
    ctx.strokeStyle = "#d97757";
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
    ctx.fillStyle = isDark ? "#ffffff" : "#000000";
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
    const shouldShowLabel = globalScale > 1.5 || isSelected || isHovered;
    
    if (shouldShowLabel) {
      const fontSize = Math.max(2.4, 9 / globalScale);
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isDark ? "#f4f4f5" : "#18181b";
      
      const isTextHighlighted = isHighlighted ? (globalScale > 1.1 || isSelected ? 0.95 : 0.45) : 0.08;
      ctx.globalAlpha = isTextHighlighted;
      
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
    strokeColor = "#10B981"; // Green for compliance links
    defaultAlpha = 0.35;
  }

  // Hovered state gets accent clay color, otherwise uses relation colors
  const isHovered = isHighlighted && highlightLinks.size > 0;
  ctx.strokeStyle = isHovered ? "#d97757" : strokeColor;
  ctx.lineWidth = isHovered ? 1.4 : 0.6;
  ctx.globalAlpha = isHighlighted ? 0.85 : defaultAlpha;
  
  ctx.stroke();
  ctx.restore();
}
