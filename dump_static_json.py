import os
import sys
import json

# Ensure apps/backend/ is in the python path
sys.path.append(os.path.join(os.path.dirname(__file__), "apps", "backend"))
from api import get_graph_data, get_alerts

def main() -> None:
    print("Reading and building graph data from knowledge_graph/...")
    try:
        graph_data = get_graph_data()
        alerts_data = get_alerts()

        public_dir = os.path.join(os.path.dirname(__file__), "apps", "frontend", "public")
        os.makedirs(public_dir, exist_ok=True)

        graph_path = os.path.join(public_dir, "mock_graph.json")
        alerts_path = os.path.join(public_dir, "mock_alerts.json")

        with open(graph_path, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, indent=2)
        print(f"Exported graph data successfully to: {graph_path}")

        with open(alerts_path, "w", encoding="utf-8") as f:
            json.dump(alerts_data, f, indent=2)
        print(f"Exported alerts data successfully to: {alerts_path}")

    except Exception as e:
        print(f"Error during export: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
