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

      // Separate document nodes from entity nodes
      const docNodes = nodes.filter(n => n.type === "source_document" || n.interactive);
      const entityNodes = nodes.filter(n => n.type !== "source_document" && !n.interactive);

      const targets: Record<string, { x: number; y: number }> = {};

      // Position document nodes in a clean grid/arc at center
      const numDocs = docNodes.length;
      if (numDocs <= 6) {
        // Single row
        const spacing = 80;
        const startX = C_x - ((numDocs - 1) * spacing) / 2;
        docNodes.forEach((node, i) => {
          targets[node.id] = { x: startX + i * spacing, y: C_y };
        });
      } else {
        // Two rows
        const cols = Math.ceil(numDocs / 2);
        const spacing = 80;
        const startX = C_x - ((cols - 1) * spacing) / 2;
        docNodes.forEach((node, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          targets[node.id] = {
            x: startX + col * spacing,
            y: C_y - 40 + row * 80,
          };
        });
      }

      // Position entity nodes in orbits around their linked document
      // Build doc -> entities map from links
      const docEntities: Record<string, GraphNode[]> = {};
      docNodes.forEach(d => { docEntities[d.id] = []; });

      // Find links connecting docs to entities
      const linkData = fgRef.current ? (fgRef.current as any).graphData?.() : null;
      const links: { source: string; target: string }[] = linkData?.links?.map((l: any) => ({
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      })) || [];

      const assignedEntities = new Set<string>();
      links.forEach(l => {
        if (docEntities[l.source] !== undefined && !assignedEntities.has(l.target)) {
          const ent = entityNodes.find(n => n.id === l.target);
          if (ent) {
            docEntities[l.source].push(ent);
            assignedEntities.add(l.target);
          }
        }
        if (docEntities[l.target] !== undefined && !assignedEntities.has(l.source)) {
          const ent = entityNodes.find(n => n.id === l.source);
          if (ent) {
            docEntities[l.target].push(ent);
            assignedEntities.add(l.source);
          }
        }
      });

      // Position entities in a circle around their document
      Object.entries(docEntities).forEach(([docId, entities]) => {
        const docPos = targets[docId];
        if (!docPos) return;
        const n = entities.length;
        const orbitRadius = Math.max(35, Math.min(60, n * 8));
        entities.forEach((ent, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          targets[ent.id] = {
            x: docPos.x + orbitRadius * Math.cos(angle),
            y: docPos.y + orbitRadius * Math.sin(angle),
          };
        });
      });

      // Unassigned entities go to a corner
      entityNodes.filter(n => !assignedEntities.has(n.id)).forEach((node, i) => {
        const angle = (i / 12) * 2 * Math.PI;
        targets[node.id] = {
          x: C_x + (width * 0.4) * Math.cos(angle),
          y: C_y + (height * 0.4) * Math.sin(angle),
        };
      });

      // Animate to positions
      const startPositions = nodes.map(n => ({
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

        nodes.forEach(node => {
          const start = startPositions.find(p => p.id === node.id);
          const target = targets[node.id];
          if (start && target) {
            node.fx = start.x + (target.x - start.x) * ease;
            node.fy = start.y + (target.y - start.y) * ease;
          }
        });

        if (progress < 1) {
          animFrameId = requestAnimationFrame(animate);
        } else {
          nodes.forEach(node => {
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
      nodes.forEach(node => {
        node.fx = undefined;
        node.fy = undefined;
      });
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }
    }
  }, [isOrganized, nodes, width, height, fgRef]);
}
