"use client";

import { useEffect, useRef, useCallback } from "react";

interface GraphUpdateEvent {
  event: "graph_updated";
  data: { new_node_ids: string[] };
}

export function useGraphUpdates(
  apiBaseUrl: string,
  onGraphUpdate: (newNodeIds: string[]) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onGraphUpdateRef = useRef(onGraphUpdate);
  onGraphUpdateRef.current = onGraphUpdate;

  const connect = useCallback(() => {
    const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/ws/updates";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg: GraphUpdateEvent = JSON.parse(event.data);
        if (msg.event === "graph_updated") {
          onGraphUpdateRef.current(msg.data.new_node_ids);
        }
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [apiBaseUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);
}
