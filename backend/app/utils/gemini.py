import os
import re
from typing import List

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY  = os.getenv("gemini_api_key")
MODEL       = "gemini-3.1-flash-lite-preview"
MAX_HISTORY = 20


def chat(
    course_title: str,
    history: list[dict],
    user_message: str,
) -> str:
    """Legacy no-context chat — kept for backward compatibility."""
    return chat_with_context(
        course_title=course_title,
        context_chunks=[],
        history=history,
        user_message=user_message,
    )


def chat_with_context(
    course_title: str,
    context_chunks: List[str],
    history: list[dict],
    user_message: str,
) -> str:
    if not GEMINI_KEY:
        return "AI is not configured. Please add a gemini_api_key to the environment."

    genai.configure(api_key=GEMINI_KEY)

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


SUMMARY_MODEL = "gemini-3.1-flash-lite-preview"
# Gemini 3.x flash-lite has a generous context window, but we still cap input
# defensively — very large courses get truncated rather than rejected.
SUMMARY_MAX_INPUT_CHARS = 180_000


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
    if not GEMINI_KEY:
        raise RuntimeError("gemini_api_key is not set")

    genai.configure(api_key=GEMINI_KEY)

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

    system_text = (
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

    user_text = (
        "Below is the full content of the course. Produce the recap as specified.\n\n"
        f"{full_input}"
    )

    model = genai.GenerativeModel(SUMMARY_MODEL, system_instruction=system_text)
    response = model.generate_content(user_text)
    text = (response.text or "").strip()
    # Strip a wrapping ```markdown ... ``` fence if the model added one.
    text = re.sub(r"^```(?:markdown)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)
    return text.strip()
