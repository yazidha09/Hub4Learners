import hashlib
import os
import re
import time
from threading import Lock
from typing import List, Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY  = os.getenv("gemini_api_key")
MODEL       = "gemini-3.1-flash-lite"
MAX_HISTORY = 20

# Configure the SDK once at import. Previously every call re-ran configure(),
# which is cheap but not free. Single-shot avoids the overhead.
_CONFIGURED = False
_CONFIG_LOCK = Lock()


def _ensure_configured() -> bool:
    global _CONFIGURED
    if not GEMINI_KEY:
        return False
    if _CONFIGURED:
        return True
    with _CONFIG_LOCK:
        if not _CONFIGURED:
            genai.configure(api_key=GEMINI_KEY)
            _CONFIGURED = True
    return True


# Lightweight TTL cache for AI summary outputs. Discussion / course summaries
# are deterministic for a given input payload, so we hash and dedupe in-process.
# Single-process only — for multi-worker prod, swap for Redis.
class _TTLCache:
    def __init__(self, max_entries: int = 256, ttl_seconds: int = 6 * 3600):
        self._store: dict = {}
        self._max = max_entries
        self._ttl = ttl_seconds
        self._lock = Lock()

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            value, ts = entry
            if (time.time() - ts) > self._ttl:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: str) -> None:
        with self._lock:
            if len(self._store) >= self._max:
                # Drop oldest ~10% by insertion order.
                drop = max(1, self._max // 10)
                for k in list(self._store.keys())[:drop]:
                    self._store.pop(k, None)
            self._store[key] = (value, time.time())


_summary_cache = _TTLCache()


def _hash_payload(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update((p or "").encode("utf-8", errors="ignore"))
        h.update(b"\x00")
    return h.hexdigest()


def chat_with_context(
    course_title: str,
    context_chunks: List[str],
    history: list[dict],
    user_message: str,
) -> str:
    if not _ensure_configured():
        return "AI is not configured. Please add a gemini_api_key to the environment."

    if context_chunks:
        context_block = (
            "\n\n## Relevant excerpts from this course:\n\n"
            + "\n\n---\n\n".join(context_chunks)
            + "\n\n---"
        )
        instructions = (
            "- Answer ONLY based on the course excerpts provided above.\n"
            "- If the answer is not in those excerpts, say: "
            "\"I couldn't find this in the course material — try rephrasing, or "
            "ask your professor to expand the lesson.\"\n"
            "- Never answer from general knowledge — stay grounded in the excerpts.\n"
        )
    else:
        # No matching chunks → either the course isn't indexed yet, or the
        # question is off-topic. Either way, do NOT bluff from training data.
        context_block = ""
        instructions = (
            "- You have no excerpts from this course to draw from.\n"
            "- Reply with exactly: \"I couldn't find anything about that in this "
            "course's material yet. If the course was just published or edited, "
            "indexing may still be in progress — please try again in a moment. "
            "Otherwise, ask your professor to verify the course content has been added.\"\n"
            "- Do not attempt to answer from general knowledge.\n"
        )

    system_text = (
        f"You are an intelligent study assistant for the Hub4Learners platform.\n"
        f"You are helping a student learn from the course: \"{course_title}\".\n\n"
        f"Instructions:\n"
        f"{instructions}"
        f"- Be concise, clear, and pedagogically helpful.\n"
        f"- Use markdown: **bold** key terms, bullet lists, short `code` blocks when relevant."
        f"{context_block}"
    )

    model = genai.GenerativeModel(MODEL, system_instruction=system_text)

    trimmed = history[-MAX_HISTORY:]
    gemini_history = [
        {"role": "user" if t["role"] == "user" else "model", "parts": [t["content"]]}
        for t in trimmed
    ]

    try:
        session = model.start_chat(history=gemini_history)
        response = session.send_message(user_message)
        return response.text.strip()
    except Exception as e:
        return f"AI error: {str(e)}"


SUMMARY_MODEL = "gemini-3.1-flash-lite"
# Gemini 3.x flash-lite has a generous context window, but we still cap input
# defensively — very large courses get truncated rather than rejected.
SUMMARY_MAX_INPUT_CHARS = 180_000

_COURSE_SUMMARY_SYSTEM = (
    "You are an expert academic editor producing a polished, exam-ready recap "
    "of an entire course for a student who has just finished it.\n\n"
    "Output requirements:\n"
    "- Pure GitHub-flavored markdown — no preamble, no closing remarks, no code fences around the whole thing.\n"
    "- Start with a level-2 heading: `## Course Recap`.\n"
    "- Then a short 2–3 sentence **Overview** paragraph capturing what the course is about and who it's for.\n"
    "- Then a `### Learning Outcomes` section with 4–7 concise bullet points "
    "(each starting with an action verb: *Understand*, *Apply*, *Build*, *Analyze*…).\n"
    "- Then a `### Key Concepts` section organized by the course's own sections — "
    "use a level-4 heading per section (`#### Section Title`) followed by 3–6 bullets "
    "summarizing the most important ideas, definitions, or formulas from that section. "
    "**Bold** key terms on first mention.\n"
    "- Then a `### Quick-Reference Cheat Sheet` — a markdown table with two columns: "
    "`Concept` and `What to remember`. Include 6–10 of the most testable rows.\n"
    "- End with a `### Next Steps` section: 2–4 bullets suggesting what the student "
    "could explore next or how to apply the material.\n\n"
    "Style:\n"
    "- Be precise and academic but readable. No fluff, no marketing language.\n"
    "- Stay strictly grounded in the provided course content — do not invent topics "
    "the course did not cover.\n"
    "- Use inline `code` for technical identifiers, formulas, or commands.\n"
)

# Models are cheap to construct, but reusing a single instance avoids the
# small per-call setup cost in the SDK and keeps memory flat.
_course_summary_model: Optional[genai.GenerativeModel] = None
_discussion_summary_model: Optional[genai.GenerativeModel] = None


def _get_course_summary_model() -> genai.GenerativeModel:
    global _course_summary_model
    if _course_summary_model is None:
        _course_summary_model = genai.GenerativeModel(
            SUMMARY_MODEL, system_instruction=_COURSE_SUMMARY_SYSTEM
        )
    return _course_summary_model


def generate_course_summary(
    course_title: str,
    course_description: str,
    sections: list[dict],
) -> str:
    """Produce a polished, well-structured markdown recap of an entire course.

    `sections` shape:
        [
          {"title": str, "items": [{"label": str, "text": str}, ...]},
          ...
        ]
    Each item is a single subsection / material. Already-stripped plain text.

    Returns markdown. Raises on configuration error so the caller can surface
    a real error to the user instead of a silently-stored failure string.
    """
    if not _ensure_configured():
        raise RuntimeError("gemini_api_key is not set")

    parts: list[str] = []
    parts.append(f"# Course: {course_title}")
    if course_description:
        parts.append(f"Description: {course_description}")
    for s in sections:
        parts.append(f"\n## Section: {s['title']}")
        for it in s["items"]:
            label = it.get("label") or "Lesson"
            txt = (it.get("text") or "").strip()
            if not txt:
                continue
            parts.append(f"\n### {label}\n{txt}")
    full_input = "\n".join(parts)
    if len(full_input) > SUMMARY_MAX_INPUT_CHARS:
        full_input = full_input[:SUMMARY_MAX_INPUT_CHARS] + "\n\n[... content truncated for length ...]"

    cache_key = "course:" + _hash_payload(course_title, course_description, full_input)
    cached = _summary_cache.get(cache_key)
    if cached is not None:
        return cached

    user_text = (
        "Below is the full content of the course. Produce the recap as specified.\n\n"
        f"{full_input}"
    )

    response = _get_course_summary_model().generate_content(user_text)
    text = (response.text or "").strip()
    # Strip a wrapping ```markdown ... ``` fence if the model added one.
    text = re.sub(r"^```(?:markdown)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)
    text = text.strip()
    if text:
        _summary_cache.set(cache_key, text)
    return text


DISCUSSION_SUMMARY_MAX_INPUT_CHARS = 60_000

_DISCUSSION_SUMMARY_SYSTEM = (
    "You analyze a lesson's student discussion thread and produce a short, "
    "scannable digest for someone deciding whether to read the full thread.\n\n"
    "Output requirements (pure markdown, no preamble or closing remarks):\n"
    "- Start with a one-sentence **TL;DR** in bold prefixed with `**TL;DR:**`.\n"
    "- Then `### Common questions` — 2-4 bullets, each a real recurring question.\n"
    "- Then `### Top answers & insights` — 2-4 bullets summarising the most upvoted "
    "or clarifying replies. Quote concrete techniques, terms, or examples.\n"
    "- Then `### Where students struggle` — 1-3 bullets on points of confusion.\n\n"
    "Style:\n"
    "- Be concise. Each bullet under 25 words.\n"
    "- Stay strictly grounded in the discussion content — do not invent topics.\n"
    "- Use inline `code` for technical identifiers.\n"
    "- If the thread is too short or off-topic to summarise meaningfully, "
    "reply with exactly: `Not enough discussion yet to summarise.`"
)


def _get_discussion_summary_model() -> genai.GenerativeModel:
    global _discussion_summary_model
    if _discussion_summary_model is None:
        _discussion_summary_model = genai.GenerativeModel(
            SUMMARY_MODEL, system_instruction=_DISCUSSION_SUMMARY_SYSTEM
        )
    return _discussion_summary_model


def summarize_discussion_thread(
    lesson_title: str,
    course_title: str,
    posts: list[dict],
) -> str:
    """Produce a short markdown summary of a lesson's discussion thread.

    `posts` shape: [{"author": str, "content": str, "upvotes": int,
                      "replies": [{"author": str, "content": str, "upvotes": int}]}]

    Output is markdown. Returns "" if there is nothing meaningful to summarize.
    """
    if not _ensure_configured():
        raise RuntimeError("gemini_api_key is not set")

    if not posts:
        return ""

    parts: list[str] = []
    parts.append(f"# Lesson: {lesson_title} (Course: {course_title})\n")
    for i, p in enumerate(posts, 1):
        parts.append(
            f"\n## Post {i} — {p.get('author', 'student')} "
            f"(↑{p.get('upvotes', 0)})\n{p.get('content', '').strip()}"
        )
        for r in p.get("replies", []) or []:
            parts.append(
                f"\n  ↳ Reply by {r.get('author', 'student')} "
                f"(↑{r.get('upvotes', 0)}): {r.get('content', '').strip()}"
            )
    full_input = "\n".join(parts)
    if len(full_input) > DISCUSSION_SUMMARY_MAX_INPUT_CHARS:
        full_input = full_input[:DISCUSSION_SUMMARY_MAX_INPUT_CHARS] + "\n\n[... truncated ...]"

    cache_key = "discussion:" + _hash_payload(lesson_title, course_title, full_input)
    cached = _summary_cache.get(cache_key)
    if cached is not None:
        return cached

    user_text = f"Below is the full discussion thread for this lesson.\n\n{full_input}"

    response = _get_discussion_summary_model().generate_content(user_text)
    text = (response.text or "").strip()
    text = re.sub(r"^```(?:markdown)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)
    text = text.strip()
    if text:
        _summary_cache.set(cache_key, text)
    return text
