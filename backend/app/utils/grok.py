"""
Grok AI chat utility (Groq / llama-3.3-70b-versatile).
Calls the Groq REST API directly with requests — no SDK required.
chat() now works with RAG: it receives pre-retrieved chunks, not raw sections.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROK_KEY    = os.getenv("GROK_API_KEY")
GROK_URL    = "https://api.groq.com/openai/v1/chat/completions"
MODEL       = "llama-3.3-70b-versatile"
MAX_HISTORY = 20


def chat(
    course_title: str,
    retrieved_chunks: list[dict],   # [{content, section_title, material_title, similarity}, ...]
    history: list[dict],            # [{role: "user"|"assistant", content: str}, ...]
    user_message: str,
) -> str:
    """
    Call Groq with the retrieved RAG chunks as context.
    Falls back to a "no content found" notice if chunks is empty.
    """
    if not GROK_KEY:
        return "AI is not configured. Please add a GROK_API_KEY to the environment."

    # Build context block from retrieved chunks
    if retrieved_chunks:
        parts = []
        for chunk in retrieved_chunks:
            header = f"[{chunk['section_title']} › {chunk['material_title']}]"
            parts.append(f"{header}\n{chunk['content']}")
        context = "\n\n---\n\n".join(parts)
    else:
        context = "(No relevant course content was found for this query.)"

    system_text = (
        f"You are an intelligent study assistant for the Hub4Learners platform.\n"
        f"You are helping a student learn from the course: \"{course_title}\".\n\n"
        f"The following passages were retrieved from the course materials as the most "
        f"relevant to the student's question:\n\n"
        f"===\n{context}\n===\n\n"
        f"Instructions:\n"
        f"- Answer ONLY based on the retrieved passages above.\n"
        f"- If the passages do not contain enough information, say so honestly and "
        f"suggest that the student check the relevant section.\n"
        f"- Be concise, clear, and pedagogically helpful.\n"
        f"- Use markdown: **bold** key terms, bullet lists, short `code` blocks.\n"
        f"- Never invent facts not present in the passages."
    )

    trimmed = history[-MAX_HISTORY:]
    messages = [{"role": "system", "content": system_text}]
    for turn in trimmed:
        role = turn["role"] if turn["role"] in ("user", "assistant") else "user"
        messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        resp = requests.post(
            GROK_URL,
            headers={
                "Authorization": f"Bearer {GROK_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.4,
            },
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except requests.HTTPError:
        try:
            detail = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            detail = resp.text
        return f"AI error: {detail}"
    except Exception as e:
        return f"AI error: {str(e)}"
