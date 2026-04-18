import os
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
    if not GEMINI_KEY:
        return "AI is not configured. Please add a gemini_api_key to the environment."

    genai.configure(api_key=GEMINI_KEY)

    system_text = (
        f"You are an intelligent study assistant for the Hub4Learners platform.\n"
        f"You are helping a student learn from the course: \"{course_title}\".\n\n"
        f"Instructions:\n"
        f"- Be concise, clear, and pedagogically helpful.\n"
        f"- Use markdown: **bold** key terms, bullet lists, short `code` blocks when relevant.\n"
        f"- Answer the student's questions about the course topic to the best of your knowledge."
    )

    model = genai.GenerativeModel(MODEL, system_instruction=system_text)

    trimmed = history[-MAX_HISTORY:]
    gemini_history = []
    for turn in trimmed:
        role = "user" if turn["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [turn["content"]]})

    try:
        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(user_message)
        return response.text.strip()
    except Exception as e:
        return f"AI error: {str(e)}"
