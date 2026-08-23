import { useEffect } from "react";
import { GraphNode, GraphLink } from "./graphDrawHandlers";
import { ForceGraphMethods } from "react-force-graph-2d";

export function useOrganizedLayout(
  isOrganized: boolean,
  nodes: GraphNode[],
  width: number,
  height: number,
  fgRef: React.MutableRefObject<ForceGraphMethods<GraphNode, GraphLink> | null>
) {
  useEffect(() => {
    if (nodes.length === 0) return;

    if (isOrganized) {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }

      const C_x = width / 2;
      const C_y = height / 2;

      // Group nodes by type
      const groups: Record<string, GraphNode[]> = {};
      nodes.forEach((node) => {
        const typeLower = (node.type || "concept").toLowerCase().trim();
        const category = typeLower === "maintenance_log" ? "maintenance" : typeLower;
        if (!groups[category]) groups[category] = [];
        groups[category].push(node);
      });

      const groupKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
      const numGroups = groupKeys.length;

      const targets: Record<string, { x: number; y: number }> = {};

      // Position each group in a region around the center
      // Largest group gets center, others get outer positions
      const outerRadius = Math.min(width, height) * 0.35;

      groupKeys.forEach((key, groupIdx) => {
        const groupNodes = groups[key];
        const n = groupNodes.length;

        // Group center position
        let gx: number, gy: number;
        if (groupIdx === 0 && n > 15) {
          // Largest group gets the center
          gx = C_x;
          gy = C_y;
        } else {
          const angle = ((groupIdx === 0 ? 0 : groupIdx - 1) / Math.max(1, numGroups - 1)) * 2 * Math.PI - Math.PI / 2;
          const dist = groupIdx === 0 ? 0 : outerRadius;
          gx = C_x + dist * Math.cos(angle);
          gy = C_y + dist * Math.sin(angle);
        }

        if (n === 1) {
          targets[groupNodes[0].id] = { x: gx, y: gy };
        } else if (n <= 8) {
          // Small groups: circle
          const r = Math.max(40, n * 18);
          groupNodes.forEach((node, i) => {
            const a = (i / n) * 2 * Math.PI;
            targets[node.id] = {
              x: gx + r * Math.cos(a),
              y: gy + r * Math.sin(a),
            };
          });
        } else {
          // Large groups: grid layout
          const cols = Math.ceil(Math.sqrt(n * 1.5));
          const rows = Math.ceil(n / cols);
          const spacing = 55;
          const startX = gx - ((cols - 1) * spacing) / 2;
          const startY = gy - ((rows - 1) * spacing) / 2;

          groupNodes.forEach((node, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            targets[node.id] = {
              x: startX + col * spacing,
              y: startY + row * spacing,
            };
          });
        }
      });

      const startPositions = nodes.map((n) => ({
        id: n.id,
        x: n.x ?? C_x,
        y: n.y ?? C_y
      }));

      const duration = 700;
      const startTime = performance.now();
      let animFrameId: number;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        nodes.forEach((node) => {
          const start = startPositions.find((p) => p.id === node.id);
          const target = targets[node.id];
          if (start && target) {
            node.fx = start.x + (target.x - start.x) * ease;
            node.fy = start.y + (target.y - start.y) * ease;
          }
        });

        if (progress < 1) {
          animFrameId = requestAnimationFrame(animate);
        } else {
          nodes.forEach((node) => {
            const target = targets[node.id];
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
      nodes.forEach((node) => {
        node.fx = undefined;
        node.fy = undefined;
      });
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }
    }
  }, [isOrganized, nodes, width, height, fgRef]);
}
