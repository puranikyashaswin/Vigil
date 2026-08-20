import os
import re
from typing import Tuple
from openai import OpenAI


def get_client() -> Tuple[OpenAI, str]:
    """
    Initializes OpenAI client routed through OpenRouter or Portkey.
    Returns (client, model_slug).
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

    is_groq_placeholder = not groq_api_key or "your_" in groq_api_key
    is_portkey_placeholder = not portkey_api_key or "your_" in portkey_api_key
    is_openrouter_placeholder = not openrouter_api_key or "your_" in openrouter_api_key

    if not is_groq_placeholder:
        if not is_portkey_placeholder:
            client = OpenAI(
                api_key=groq_api_key,
                base_url="https://api.portkey.ai/v1",
                default_headers={
                    "x-portkey-provider": "groq",
                    "x-portkey-api-key": portkey_api_key,
                },
            )
            groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
            return client, groq_model
        else:
            client = OpenAI(
                api_key=groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
            groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
            return client, groq_model

    if not is_openrouter_placeholder:
        client = OpenAI(
            api_key=openrouter_api_key, base_url="https://openrouter.ai/api/v1"
        )
        return client, "tencent/hy3:free"

    raise ValueError(
        "No valid API keys configured. Please set a valid GROQ_API_KEY or OPENROUTER_API_KEY in your .env file."
    )


def clean_json_string(s: str) -> str:
    """
    Cleans raw markdown block wrappers from a JSON string returned by LLM.
    """
    s = s.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s
