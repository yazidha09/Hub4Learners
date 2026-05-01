import os
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
            "\"I can only answer questions based on this course's material.\"\n"
        )
    else:
        context_block = ""
        instructions = (
            "- Answer the student's questions about the course topic to the best of your knowledge.\n"
            "- Note: this course has not been indexed yet, so you are answering from general knowledge.\n"
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
