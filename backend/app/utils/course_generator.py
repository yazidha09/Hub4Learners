import asyncio
import json
import logging
import os
import re
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from app.utils.pdf_parser import PDFChunk

load_dotenv()
logger = logging.getLogger(__name__)

_MODEL = "gemini-3.1-flash-lite-preview"
_MAX_RETRIES = 3
_MAX_STRUCTURE_CHARS = 40_000   # ~10 k tokens — enough for structure pass
_MAX_CONTENT_CHARS = 6_000      # per subsection reference window


# ── Gemini client ─────────────────────────────────────────────────────────────

def _get_model() -> genai.GenerativeModel:
    api_key = os.getenv("gemini_api_key")
    if not api_key:
        raise RuntimeError("gemini_api_key is not set in environment")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(_MODEL)


def _call_sync(prompt: str) -> str:
    return _get_model().generate_content(prompt).text.strip()


def _strip_fences(text: str) -> str:
    """Remove optional ```json … ``` or ``` … ``` markdown fences."""
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


async def _call_json(prompt: str) -> Any:
    """Call Gemini, parse JSON, retry up to _MAX_RETRIES times on failure."""
    last_exc: Exception | None = None
    for attempt in range(1, _MAX_RETRIES + 1):
        raw = await asyncio.to_thread(_call_sync, prompt)
        try:
            return json.loads(_strip_fences(raw))
        except (json.JSONDecodeError, ValueError) as exc:
            last_exc = exc
            logger.warning("JSON parse failed (attempt %d/%d): %s", attempt, _MAX_RETRIES, exc)
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1)
    raise ValueError(
        f"Gemini returned invalid JSON after {_MAX_RETRIES} attempts. "
        f"Last error: {last_exc}"
    )


# ── Step 2: generate course structure ────────────────────────────────────────

def _structure_prompt(chunks: list[PDFChunk]) -> str:
    body = "\n\n---\n\n".join(c.text for c in chunks)
    if len(body) > _MAX_STRUCTURE_CHARS:
        body = body[:_MAX_STRUCTURE_CHARS] + "\n\n[content truncated]"

    return f"""You are an expert instructional designer and course architect.

Analyze the following text extracted from a PDF and produce a structured course outline.

EXTRACTED CONTENT:
{body}

Return ONLY a valid JSON object — no explanations, no markdown fences, no extra text.

Exact format required:
{{
  "title": "Descriptive Course Title",
  "sections": [
    {{
      "title": "Section Title",
      "subsections": [
        {{"title": "Subsection Title"}}
      ]
    }}
  ]
}}

Rules:
- 3–7 top-level sections that cover the document logically
- 2–5 subsections per section
- Titles must be specific, educational, and unique
- The course title must accurately reflect the main subject
"""


async def generate_structure(chunks: list[PDFChunk]) -> dict:
    data = await _call_json(_structure_prompt(chunks))
    if "title" not in data or not isinstance(data.get("sections"), list):
        raise ValueError(f"Structure response missing required fields: {list(data.keys())}")
    if len(data["sections"]) == 0:
        raise ValueError("Structure response returned zero sections")
    return data


# ── Step 3: generate lesson content ──────────────────────────────────────────

def _find_relevant_text(subsection_title: str, chunks: list[PDFChunk]) -> str:
    """Return the most relevant chunk text by keyword overlap with subsection title."""
    keywords = set(w.lower() for w in subsection_title.split() if len(w) > 3)
    scored = sorted(
        chunks,
        key=lambda c: sum(1 for kw in keywords if kw in c.text.lower()),
        reverse=True,
    )
    # Take top 2 chunks
    combined = "\n\n".join(c.text for c in scored[:2])
    return combined[:_MAX_CONTENT_CHARS]


def _content_prompt(
    course_title: str,
    section_title: str,
    subsection_title: str,
    reference_text: str,
    difficulty: str,
) -> str:
    return f"""You are an expert content writer for online educational courses.

Generate complete lesson content for the subsection below.

COURSE: {course_title}
SECTION: {section_title}
SUBSECTION: {subsection_title}
DIFFICULTY: {difficulty}

REFERENCE MATERIAL (use as context, do not copy verbatim):
{reference_text}

Return ONLY valid HTML using these tags: <p>, <ul>, <ol>, <li>, <strong>, <em>, <pre><code>, <h3>, <h4>, <blockquote>
Do NOT include <html>, <body>, <head>, or any markdown.

Requirements:
- Opening paragraph: introduce what this subsection covers
- Key concepts explained clearly at {difficulty} level
- At least one concrete example or use case
- <pre><code> blocks for any code, commands, or syntax
- Closing summary paragraph with key takeaways
- 400–700 words of educational content
"""


async def generate_lesson_content(
    course_title: str,
    section_title: str,
    subsection_title: str,
    chunks: list[PDFChunk],
    difficulty: str = "intermediate",
) -> str:
    """Generate Tiptap-ready HTML content for a single subsection."""
    reference = _find_relevant_text(subsection_title, chunks)
    if not reference:
        reference = "No reference material available."

    prompt = _content_prompt(course_title, section_title, subsection_title, reference, difficulty)

    for attempt in range(1, _MAX_RETRIES + 1):
        raw = await asyncio.to_thread(_call_sync, prompt)
        raw = raw.strip()
        if raw.startswith("<"):
            return raw
        # Try to salvage HTML buried inside markdown-fenced text
        match = re.search(r"<(?:p|h[34]|ul|ol|pre)[^>]*>", raw)
        if match:
            return raw[match.start():]
        logger.warning("Content attempt %d/%d returned no HTML", attempt, _MAX_RETRIES)
        if attempt < _MAX_RETRIES:
            await asyncio.sleep(1)

    return f"<p>{raw}</p>"


# ── Bonus: quiz generation ────────────────────────────────────────────────────

_QUIZ_PROMPT = """You are an expert educator creating assessment questions for an online course.

SUBSECTION: {title}

CONTENT SUMMARY:
{snippet}

Return ONLY a valid JSON array — no explanations, no markdown fences.

Exact format:
[
  {{
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Why this answer is correct"
  }}
]

Rules:
- Exactly 4 multiple-choice questions
- Each question has exactly 4 options
- correct_index is 0-based
- Test understanding, not memorization
"""


async def generate_quiz(subsection_title: str, content_html: str) -> list[dict]:
    snippet = re.sub(r"<[^>]+>", " ", content_html)[:3_000].strip()
    prompt = _QUIZ_PROMPT.format(title=subsection_title, snippet=snippet)
    result = await _call_json(prompt)
    if not isinstance(result, list):
        raise ValueError("Quiz response is not a JSON array")
    return result


# ── Step 4: assemble full course ──────────────────────────────────────────────

async def build_full_course(chunks: list[PDFChunk], difficulty: str = "intermediate") -> dict:
    """
    Full pipeline:
      1. Generate course structure (title + sections/subsections skeleton)
      2. Concurrently generate HTML content for every subsection
      3. Merge and return assembled course dict
    """
    structure = await generate_structure(chunks)
    course_title = structure["title"]

    # Cap concurrent Gemini calls to avoid rate-limit errors
    semaphore = asyncio.Semaphore(3)

    async def _gen(section: dict, sub: dict) -> str:
        async with semaphore:
            return await generate_lesson_content(
                course_title=course_title,
                section_title=section["title"],
                subsection_title=sub["title"],
                chunks=chunks,
                difficulty=difficulty,
            )

    tasks = []
    coords: list[tuple[int, int]] = []
    for s_i, section in enumerate(structure["sections"]):
        for ss_i, sub in enumerate(section["subsections"]):
            tasks.append(_gen(section, sub))
            coords.append((s_i, ss_i))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for (s_i, ss_i), result in zip(coords, results):
        sub = structure["sections"][s_i]["subsections"][ss_i]
        if isinstance(result, Exception):
            logger.error(
                "Content generation failed for '%s': %s",
                sub["title"], result
            )
            sub["content"] = "<p>Content generation failed for this subsection.</p>"
        else:
            sub["content"] = result

    return structure
