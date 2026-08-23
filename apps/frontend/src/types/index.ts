export interface Node {
  id: string;
  label: string;
  type: string;
  description?: string;
  val?: number;
}

export interface Link {
  source: string;
  target: string;
  type?: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence_score: number;
  timestamp: string;
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  category?: string;
  citations?: { source_file: string; excerpt: string; score: number }[];
  follow_ups?: string[];
  metadata?: {
    trace?: string[];
    node_metrics?: Record<string, {
      latency_ms?: number;
      input_tokens?: number;
      output_tokens?: number;
      model?: string;
      vector_hits?: number;
      filtered_count?: number;
      skipped?: boolean;
    }>;
    confidence?: { score: number; relevance: number; consensus: number; coverage: number; formula?: string };
    total_latency_ms?: number;
    total_tokens?: { input: number; output: number };
    impact_nodes?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
}

export interface SeverityStyle {
  bg: string;
  badge: string;
}
