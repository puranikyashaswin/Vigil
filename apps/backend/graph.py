import logging
from langgraph.graph import StateGraph, END
from state import AgentState
from retrieval import retrieve_context_node, rerank_context_node
from nodes import (
    route_query_intent,
    synthesize_response_node,
    contradiction_guard_node,
    log_ragas_metrics_node,
)

# Set up logging
logger = logging.getLogger("vigil.graph")

# 6. Graph Compilation
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("route_intent", route_query_intent)
workflow.add_node("retrieve_context", retrieve_context_node)
workflow.add_node("rerank_context", rerank_context_node)
workflow.add_node("synthesize_response", synthesize_response_node)
workflow.add_node("contradiction_guard", contradiction_guard_node)
workflow.add_node("log_metrics", log_ragas_metrics_node)

# Connect Entry
workflow.set_entry_point("route_intent")

# Chaining Sequentially
workflow.add_edge("route_intent", "retrieve_context")
workflow.add_edge("retrieve_context", "rerank_context")
workflow.add_edge("rerank_context", "synthesize_response")
workflow.add_edge("synthesize_response", "contradiction_guard")
workflow.add_edge("contradiction_guard", "log_metrics")
workflow.add_edge("log_metrics", END)

# Compile
app = workflow.compile()
