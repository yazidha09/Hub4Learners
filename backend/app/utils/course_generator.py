"""
PDF → Course pipeline.

Design rule (per professor request): the professor's PDF content is preserved
verbatim. The AI is used ONLY to organize the structure — it picks a course
title, names sections/subsections, and assigns each PDF chunk to the right
subsection. It does NOT rewrite, summarize, or invent content.

Pipeline:
  1. parse_pdf            → list[PDFChunk] with line metadata preserved.
  2. _generate_outline    → ONE Gemini call. Returns:
        { title, sections: [{ title, subsections: [{ title, chunk_ids }] }] }
  3. For each subsection, gather lines from the assigned chunks and render
     them as HTML via lines_to_html. Content is verbatim.
"""
import asyncio
import json
import logging
import os
import re
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from app.utils.pdf_parser import PDFChunk, PDFLine, lines_to_html

load_dotenv()
logger = logging.getLogger(__name__)

_MODEL = "gemini-3.1-flash-lite-preview"
_MAX_RETRIES = 3
_MAX_OUTLINE_CHARS = 60_000   # cap of chunk text we send for outline inference


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
    text = re.sub(r"^```(?:json|html)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


async def _call_json(prompt: str) -> Any:
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
    raise ValueError(f"Gemini returned invalid JSON after {_MAX_RETRIES} attempts. Last error: {last_exc}")


# ── Outline (structure + chunk assignment) ────────────────────────────────────

def _outline_prompt(chunks: list[PDFChunk]) -> str:
    body_parts: list[str] = []
    total = 0
    for c in chunks:
        # Truncate each chunk's text in the prompt — we only need enough for
        # the AI to understand the topic, not the full body. The full body
        # is recovered from chunk.lines when we render content.
        snippet = c.text.strip()
        if len(snippet) > 1200:
            snippet = snippet[:1200] + "…"
        section = f"[CHUNK {c.index}] (pages {c.page_start}-{c.page_end})\n{snippet}\n"
        if total + len(section) > _MAX_OUTLINE_CHARS:
            body_parts.append("[remaining chunks truncated — assign them to the LAST subsection]")
            break
        body_parts.append(section)
        total += len(section)

    body = "\n".join(body_parts)
    last_id = chunks[-1].index

    return f"""You are an expert instructional designer.

Below are numbered text chunks extracted from a PDF document. Organize them
into a clean course outline. You assign each chunk to a subsection — you do
NOT rewrite or summarize the content (a separate step renders the chunk text
verbatim).

CHUNKS (ids {chunks[0].index} … {last_id}):
{body}

Return ONLY a valid JSON object — no explanations, no markdown fences, no
extra text.

Exact format required:
{{
  "title": "Descriptive Course Title (reflects the document subject)",
  "sections": [
    {{
      "title": "Section Title",
      "subsections": [
        {{
          "title": "Subsection Title (descriptive, specific)",
          "chunk_ids": [list of integer chunk ids belonging to this subsection]
        }}
      ]
    }}
  ]
}}

Strict rules:
- 3 to 7 sections that reflect the document's natural structure.
- 1 to 6 subsections per section. Every section MUST have at least one subsection.
- Every chunk_id must be a valid integer between {chunks[0].index} and {last_id}.
- Every chunk MUST be assigned to exactly one subsection. Do not skip any chunk.
- Order chunks within a subsection in ascending id order.
- Skip cover-page / table-of-contents fluff by merging it into the first real subsection — do NOT create empty sections for it.
- Title chunks (single-line big-font headings) should be merged with the next subsection rather than getting their own section.
- Subsection titles should describe the content, not just repeat the section title.
"""


async def _generate_outline(chunks: list[PDFChunk]) -> dict:
    data = await _call_json(_outline_prompt(chunks))
    if not isinstance(data, dict):
        raise ValueError("Outline response is not a JSON object")
    if "title" not in data or not isinstance(data.get("sections"), list):
        raise ValueError(f"Outline response missing required fields: {list(data.keys())}")
    if len(data["sections"]) == 0:
        raise ValueError("Outline returned zero sections")
    return data


# ── Assemble final course (verbatim content) ──────────────────────────────────

def _assigned_chunks(ids: list, chunks_by_id: dict[int, PDFChunk]) -> list[PDFChunk]:
    out: list[PDFChunk] = []
    for cid in ids or []:
        try:
            cid_int = int(cid)
        except (TypeError, ValueError):
            continue
        chunk = chunks_by_id.get(cid_int)
        if chunk:
            out.append(chunk)
    out.sort(key=lambda c: c.index)
    return out


def _fill_missing_chunks(
    outline: dict,
    chunks: list[PDFChunk],
    chunks_by_id: dict[int, PDFChunk],
) -> None:
    """Attach any chunks the AI forgot to the nearest subsection by chunk-id distance."""
    assigned: set[int] = set()
    for section in outline["sections"]:
        for sub in section.get("subsections", []):
            for cid in sub.get("chunk_ids", []) or []:
                try:
                    assigned.add(int(cid))
                except (TypeError, ValueError):
                    continue

    missing = [c.index for c in chunks if c.index not in assigned]
    if not missing:
        return

    # Build flat list of (subsection_ref, min_assigned_id, max_assigned_id)
    subs: list[tuple[dict, int, int]] = []
    for section in outline["sections"]:
        for sub in section.get("subsections", []):
            ids = [int(x) for x in (sub.get("chunk_ids") or []) if isinstance(x, (int, str)) and str(x).lstrip("-").isdigit()]
            if not ids:
                continue
            subs.append((sub, min(ids), max(ids)))

    if not subs:
        # No subsection has any chunks — dump everything into the first subsection of the first section
        if outline["sections"] and outline["sections"][0].get("subsections"):
            outline["sections"][0]["subsections"][0].setdefault("chunk_ids", [])
            outline["sections"][0]["subsections"][0]["chunk_ids"] = sorted(c.index for c in chunks)
        return

    for cid in missing:
        # Pick the subsection whose range is closest to this chunk id
        best_sub, _ = min(
            ((sub, _distance(cid, lo, hi)) for sub, lo, hi in subs),
            key=lambda t: t[1],
        )
        best_sub.setdefault("chunk_ids", [])
        best_sub["chunk_ids"].append(cid)
        best_sub["chunk_ids"] = sorted(set(int(x) for x in best_sub["chunk_ids"]))


def _distance(cid: int, lo: int, hi: int) -> int:
    if cid < lo:
        return lo - cid
    if cid > hi:
        return cid - hi
    return 0


def _render_subsection_html(lines: list[PDFLine]) -> str:
    html = lines_to_html(lines)
    return html or "<p>(no content)</p>"


async def build_full_course(chunks: list[PDFChunk], difficulty: str = "intermediate") -> dict:
    """
    Build a course JSON from the chunked PDF. AI organizes structure; chunk
    text is rendered verbatim into HTML.
    Returns: { title, sections: [{ title, subsections: [{ title, content }] }] }
    """
    if not chunks:
        return {"title": "Empty Course", "sections": []}

    chunks_by_id = {c.index: c for c in chunks}

    try:
        outline = await _generate_outline(chunks)
    except Exception as exc:
        logger.warning("AI outline failed (%s) — falling back to flat structure", exc)
        return _flat_fallback_course(chunks)

    _fill_missing_chunks(outline, chunks, chunks_by_id)

    course = {
        "title": (outline.get("title") or "Untitled Course").strip(),
        "sections": [],
    }

    for section in outline["sections"]:
        sec_title = (section.get("title") or "Section").strip()
        sec_out = {"title": sec_title, "subsections": []}

        for sub in section.get("subsections") or []:
            sub_title = (sub.get("title") or "Subsection").strip()
            assigned = _assigned_chunks(sub.get("chunk_ids") or [], chunks_by_id)
            lines: list[PDFLine] = []
            for ch in assigned:
                lines.extend(ch.lines)
            html = _render_subsection_html(lines)
            sec_out["subsections"].append({"title": sub_title, "content": html})

        # Drop sections that ended up empty after assignment
        if sec_out["subsections"]:
            course["sections"].append(sec_out)

    if not course["sections"]:
        return _flat_fallback_course(chunks)

    return course


def _flat_fallback_course(chunks: list[PDFChunk]) -> dict:
    """Used if AI fails entirely — at least give the professor their content back."""
    all_lines: list[PDFLine] = []
    for c in chunks:
        all_lines.extend(c.lines)
    return {
        "title": "Course Content",
        "sections": [{
            "title": "Document",
            "subsections": [{
                "title": "Content",
                "content": _render_subsection_html(all_lines),
            }],
        }],
    }


# ── Format-only re-format prompt (for /regenerate route) ──────────────────────

_POLISH_PROMPT = """You are a strict HTML formatter. Your job is ONLY to add
HTML tags so the content displays nicely. You MUST NOT rewrite, summarize,
shorten, expand, translate, or paraphrase. Every word from the input MUST
appear in the output unchanged, in the same order.

Rules:
- Allowed tags ONLY: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>,
  <pre><code>, <blockquote>, <br/>
- Wrap paragraphs in <p>. Group bullet/numbered lines into <ul>/<ol>.
- If a line clearly looks like code or a command, wrap it in <pre><code>.
- Do NOT add any introduction, explanation, headings, or markdown fences.
- Do NOT change punctuation, spelling, or word order.
- Output raw HTML only — start your response with the first HTML tag.

INPUT:
{body}
"""


def _content_prompt(
    course_title: str,
    section_title: str,
    subsection_title: str,
    reference_text: str,
    difficulty: str,
) -> str:
    """Format-only prompt used by /regenerate to re-lay-out an existing subsection."""
    return _POLISH_PROMPT.format(body=reference_text or subsection_title)


# ── Quiz generation (legitimate AI — quizzes are net-new) ─────────────────────

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
