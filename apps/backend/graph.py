import logging
from langgraph.graph import StateGraph, START, END
from state import AgentState
from retrieval import retrieve_context_node, rerank_context_node
from nodes import (
    route_query_intent,
    synthesize_response_node,
    contradiction_guard_node,
    log_ragas_metrics_node,
)

logger = logging.getLogger("vigil.graph")

workflow = StateGraph(AgentState)

workflow.add_node("route_intent", route_query_intent)
workflow.add_node("retrieve_context", retrieve_context_node)
workflow.add_node("rerank_context", rerank_context_node)
workflow.add_node("synthesize_response", synthesize_response_node)
workflow.add_node("contradiction_guard", contradiction_guard_node)
workflow.add_node("log_metrics", log_ragas_metrics_node)

# Parallel fan-out: route + retrieve run concurrently
workflow.add_edge(START, "route_intent")
workflow.add_edge(START, "retrieve_context")

# Fan-in: rerank waits for both to complete
workflow.add_edge(["route_intent", "retrieve_context"], "rerank_context")

# Sequential remainder
workflow.add_edge("rerank_context", "synthesize_response")
workflow.add_edge("synthesize_response", "contradiction_guard")
workflow.add_edge("contradiction_guard", "log_metrics")
workflow.add_edge("log_metrics", END)

app = workflow.compile()
