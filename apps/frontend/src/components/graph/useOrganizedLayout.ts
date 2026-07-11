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
      const N = nodes.length;
      const C_x = width / 2;
      const C_y = height / 2;
      const R = Math.min(width, height) * 0.35;
      
      const startPositions = nodes.map((n) => ({
        id: n.id,
        x: n.x ?? C_x,
        y: n.y ?? C_y
      }));
      
      const targets = nodes.map((n, idx) => {
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
          
        nodes.forEach((node) => {
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
          nodes.forEach((node) => {
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
