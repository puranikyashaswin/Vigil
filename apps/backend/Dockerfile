FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for compiling python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/backend/ ./backend/
COPY knowledge_graph/ ./knowledge_graph/

ENV PORT=8000
ENV HOST=0.0.0.0
ENV PYTHONPATH=/app/backend

EXPOSE 8000

CMD ["python", "backend/api.py"]
