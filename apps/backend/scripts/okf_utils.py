import os
import re
import unicodedata
import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger("vigil.build_graph")

def slugify(text: str) -> str:
    """
    Converts string to lowercase url-friendly slug.
    """
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def init_okf_dir(dir_path: str) -> None:
    """
    Initializes a subdirectory with index.md and log.md if they do not exist.
    """
    os.makedirs(dir_path, exist_ok=True)
    index_path = os.path.join(dir_path, "index.md")
    log_path = os.path.join(dir_path, "log.md")
    
    dir_name = os.path.basename(dir_path.rstrip("/"))
    
    if not os.path.exists(index_path):
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(f"# Index: {dir_name.capitalize()}\n\nList of all active concepts inside the {dir_name} category:\n\n")
            
    if not os.path.exists(log_path):
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"# Log: {dir_name.capitalize()} Audit Trail\n\nRecord of ingest, link, and modification actions:\n\n")

def append_to_index(dir_path: str, filename: str, title: str, desc: str) -> None:
    """
    Appends a new file reference to the index.md.
    """
    index_path = os.path.join(dir_path, "index.md")
    
    # Read current index to prevent duplicates
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    link_line = f"- [{title}](./{filename}): {desc[:120]}..."
    if link_line not in content and filename not in content:
        with open(index_path, "a", encoding="utf-8") as f:
            f.write(f"{link_line}\n")

def append_to_log(dir_path: str, action: str, msg: str) -> None:
    """
    Appends an audit log entry to log.md.
    """
    log_path = os.path.join(dir_path, "log.md")
    date_str = datetime.now().strftime("%Y-%m-%d")
    timestamp_str = datetime.now().isoformat()
    
    entry = f"\n### {date_str}\n**{action}**: {msg} ({timestamp_str})\n"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(entry)
