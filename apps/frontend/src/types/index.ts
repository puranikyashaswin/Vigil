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
  metadata?: { trace?: string[] };
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
