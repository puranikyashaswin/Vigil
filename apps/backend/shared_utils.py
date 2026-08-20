import os
import logging
from dataclasses import dataclass
from time import perf_counter
from typing import Optional, Any

logger = logging.getLogger("vigil.shared_utils")

_bedrock_client = None


@dataclass
class LLMResponse:
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    latency_ms: float


def _get_bedrock_client():
    """Returns a singleton AnthropicBedrock client."""
    global _bedrock_client
    if _bedrock_client is not None:
        return _bedrock_client

    from anthropic import AnthropicBedrock

    _bedrock_client = AnthropicBedrock(
        aws_access_key=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_region=os.getenv("AWS_REGION", "us-east-1"),
    )
    return _bedrock_client


MODEL_ROUTER = {
    "route_intent": "us.anthropic.claude-sonnet-4-6",
    "extraction": "us.anthropic.claude-sonnet-4-6",
    "generation": "us.anthropic.claude-sonnet-4-6",
    "contradiction": "us.anthropic.claude-opus-4-6-v1",
    "contradiction_guard": "us.anthropic.claude-sonnet-4-6",
    "ocr": "us.anthropic.claude-sonnet-4-6",
    "topology": "us.anthropic.claude-opus-4-6-v1",
}

MAX_TOKENS_ROUTER = {
    "route_intent": 20,
    "extraction": 4096,
    "generation": 4096,
    "contradiction": 1024,
    "contradiction_guard": 256,
    "ocr": 8192,
    "topology": 4096,
}


def is_bedrock_configured() -> bool:
    key = os.getenv("AWS_ACCESS_KEY_ID")
    secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    return bool(key and secret and "your_" not in key)


def call_llm(
    task: str,
    system_prompt: str,
    user_content: Any,
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
) -> LLMResponse:
    """
    Unified LLM gateway. Returns LLMResponse with text, token usage, and timing.
    """
    tokens = max_tokens or MAX_TOKENS_ROUTER.get(task, 4096)
    start = perf_counter()

    if is_bedrock_configured():
        client = _get_bedrock_client()
        model = MODEL_ROUTER.get(task, "us.anthropic.claude-sonnet-4-6")

        if isinstance(user_content, str):
            messages = [{"role": "user", "content": user_content}]
        else:
            messages = [{"role": "user", "content": user_content}]

        response = client.messages.create(
            model=model,
            max_tokens=tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages,
        )
        elapsed = (perf_counter() - start) * 1000
        return LLMResponse(
            text=response.content[0].text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            model=model,
            latency_ms=round(elapsed, 1),
        )
    else:
        text = _call_openrouter_fallback(system_prompt, user_content, temperature)
        elapsed = (perf_counter() - start) * 1000
        return LLMResponse(
            text=text,
            input_tokens=0,
            output_tokens=0,
            model="meta-llama/llama-3.3-70b-instruct",
            latency_ms=round(elapsed, 1),
        )


def call_llm_vision(
    task: str,
    system_prompt: str,
    image_base64: str,
    media_type: str = "image/png",
    text_prompt: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
) -> LLMResponse:
    """Vision-specific LLM call. Returns LLMResponse with text, token usage, and timing."""
    tokens = max_tokens or MAX_TOKENS_ROUTER.get(task, 4096)
    start = perf_counter()

    if is_bedrock_configured():
        client = _get_bedrock_client()
        model = MODEL_ROUTER.get(task, "us.anthropic.claude-sonnet-4-6")

        content_blocks = []
        if text_prompt:
            content_blocks.append({"type": "text", "text": text_prompt})
        content_blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_base64,
            },
        })

        response = client.messages.create(
            model=model,
            max_tokens=tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": content_blocks}],
        )
        elapsed = (perf_counter() - start) * 1000
        return LLMResponse(
            text=response.content[0].text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            model=model,
            latency_ms=round(elapsed, 1),
        )
    else:
        text = _call_openrouter_vision_fallback(
            system_prompt, image_base64, media_type, text_prompt, temperature
        )
        elapsed = (perf_counter() - start) * 1000
        return LLMResponse(
            text=text,
            input_tokens=0,
            output_tokens=0,
            model="openrouter-vision-fallback",
            latency_ms=round(elapsed, 1),
        )


def _call_openrouter_fallback(
    system_prompt: str, user_content: Any, temperature: float
) -> str:
    from openai import OpenAI

    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_api_key or "your_" in openrouter_api_key:
        raise ValueError(
            "No LLM backend configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for Bedrock, "
            "or OPENROUTER_API_KEY for fallback."
        )

    client = OpenAI(api_key=openrouter_api_key, base_url="https://openrouter.ai/api/v1")
    content = user_content if isinstance(user_content, str) else str(user_content)
    response = client.chat.completions.create(
        model="meta-llama/llama-3.3-70b-instruct",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
        temperature=temperature,
    )
    return response.choices[0].message.content


def _call_openrouter_vision_fallback(
    system_prompt: str,
    image_base64: str,
    media_type: str,
    text_prompt: Optional[str],
    temperature: float,
) -> str:
    import httpx

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key or "your_" in api_key:
        raise ValueError("No vision backend configured.")

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    content_blocks = []
    if text_prompt:
        content_blocks.append({"type": "text", "text": text_prompt})
    else:
        content_blocks.append({"type": "text", "text": system_prompt})
    content_blocks.append({
        "type": "image_url",
        "image_url": {"url": f"data:{media_type};base64,{image_base64}"},
    })

    payload = {
        "model": "google/gemma-4-26b-a4b-it:free",
        "messages": [{"role": "user", "content": content_blocks}],
    }
    with httpx.Client(timeout=90.0) as http_client:
        response = http_client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"]
        else:
            raise Exception(f"OpenRouter vision fallback failed: HTTP {response.status_code}")


def clean_json_string(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s
