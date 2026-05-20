from __future__ import annotations
import json
import os
import re
from datetime import datetime
from typing import List, Optional
from uuid import UUID

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy.orm import Session

load_dotenv()

from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.courses import Course
from app.models.lesson_block import LessonBlock
from app.models.qcm_attempt import QCMAttempt, PASS_THRESHOLD_PCT
from app.schemas.qcm import (
    QCMAttemptOut,
    QCMGenerateOut,
    QCMQuestion,
    QCMQuestionResult,
    QCMSubmitOut,
)
from app.utils.rag import _strip_html, search_course
from app.controller.gamification import xp_service

GEN_MODEL = "gemini-3.1-flash-lite"

DIFFICULTY_CONFIG = {
    "easy":   {"count": 5,  "style": "basic recall, definitions, and simple comprehension"},
    "medium": {"count": 8,  "style": "application of concepts and moderate comprehension"},
    "hard":   {"count": 10, "style": "analysis, synthesis, scenario-based reasoning, and edge cases"},
}


def _normalize_difficulty(d: str) -> str:
    d = (d or "").strip().lower()
    if d not in DIFFICULTY_CONFIG:
        raise HTTPException(status_code=400, detail="difficulty must be 'easy', 'medium', or 'hard'")
    return d


def _gather_context(db: Session, course_id: UUID, section_id: Optional[UUID]) -> str:
    """
    Pull text content for the QCM scope. Section-scoped uses LessonBlocks of that
    section's subsections + legacy section blocks. Course-wide pulls everything.
    """
    if section_id:
        rows_new = (
            db.query(LessonBlock.content)
            .join(CourseSubsection, LessonBlock.subsection_id == CourseSubsection.id)
            .filter(
                CourseSubsection.section_id == section_id,
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
            )
            .all()
        )
        rows_legacy = (
            db.query(LessonBlock.content)
            .filter(
                LessonBlock.section_id == section_id,
                LessonBlock.subsection_id.is_(None),
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
            )
            .all()
        )
    else:
        rows_new = (
            db.query(LessonBlock.content)
            .join(CourseSubsection, LessonBlock.subsection_id == CourseSubsection.id)
            .join(CourseSection, CourseSubsection.section_id == CourseSection.id)
            .filter(
                CourseSection.course_id == course_id,
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
            )
            .all()
        )
        rows_legacy = (
            db.query(LessonBlock.content)
            .join(CourseSection, LessonBlock.section_id == CourseSection.id)
            .filter(
                CourseSection.course_id == course_id,
                LessonBlock.subsection_id.is_(None),
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
            )
            .all()
        )

    chunks: List[str] = []
    for (raw,) in list(rows_new) + list(rows_legacy):
        if not raw:
            continue
        text = _strip_html(raw) if raw.lstrip().startswith("<") else raw
        text = text.strip()
        if text:
            chunks.append(text)

    # Cap at ~12k chars to stay well under model limits
    joined = "\n\n---\n\n".join(chunks)
    return joined[:12000]


def _extract_json(text: str) -> str:
    """Strip ``` fences and trailing junk so json.loads can parse the model output."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t)
    # If there's leading prose, grab the first JSON array
    m = re.search(r"\[\s*\{[\s\S]*\}\s*\]", t)
    if m:
        return m.group(0)
    return t


def _validate_questions(raw: list, expected_count: int) -> List[QCMQuestion]:
    out: List[QCMQuestion] = []
    for q in raw:
        if not isinstance(q, dict):
            continue
        question = (q.get("question") or "").strip()
        options = q.get("options") or []
        correct = q.get("correct_index")
        explanation = (q.get("explanation") or "").strip()
        if not question or not isinstance(options, list) or len(options) != 4:
            continue
        if not all(isinstance(o, str) and o.strip() for o in options):
            continue
        if not isinstance(correct, int) or correct < 0 or correct > 3:
            continue
        out.append(QCMQuestion(
            question=question,
            options=[o.strip() for o in options],
            correct_index=correct,
            explanation=explanation or "No explanation provided.",
        ))
    if len(out) < max(3, expected_count - 2):
        raise HTTPException(
            status_code=502,
            detail=f"AI returned too few valid questions ({len(out)}/{expected_count}).",
        )
    return out[:expected_count]


def generate_qcm(
    course_id: str,
    section_id: Optional[str],
    difficulty: str,
    db: Session,
) -> QCMGenerateOut:
    diff = _normalize_difficulty(difficulty)
    cfg = DIFFICULTY_CONFIG[diff]
    cid = UUID(course_id)
    sid = UUID(section_id) if section_id else None

    course = db.query(Course).filter(Course.id == cid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    scope_label = "the entire course"
    if sid:
        section = db.query(CourseSection).filter(
            CourseSection.id == sid, CourseSection.course_id == cid,
        ).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        scope_label = f"the section \"{section.title}\""

    # Prefer RAG-retrieved chunks (more semantic), fall back to raw text dump
    context = ""
    try:
        rag_query = f"key concepts from {scope_label} of course {course.title}"
        rag_chunks = search_course(str(cid), rag_query, top_k=8)
        if rag_chunks:
            context = "\n\n".join(rag_chunks)
    except Exception:
        pass

    if not context:
        context = _gather_context(db, cid, sid)

    if not context.strip():
        raise HTTPException(
            status_code=400,
            detail="Not enough text content to generate a quiz from this course/section yet.",
        )

    gemini_key = os.getenv("gemini_api_key")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="AI is not configured.")

    genai.configure(api_key=gemini_key)

    system_text = (
        "You are an expert pedagogical quiz generator for the Hub4Learners platform.\n"
        "Output ONLY a JSON array — no prose, no markdown fences, no commentary.\n"
        "Each item is an object with exactly these keys: question, options, correct_index, explanation.\n"
        "- options must be an array of EXACTLY 4 distinct strings.\n"
        "- correct_index is the 0-based index (0..3) of the correct option.\n"
        "- explanation is a short, helpful 1-2 sentence rationale.\n"
        "- Questions must be answerable from the provided course excerpts only.\n"
        "- Distribute the correct_index roughly evenly across 0,1,2,3 — do not always put the answer at the same index."
    )

    user_text = (
        f"Course: \"{course.title}\"\n"
        f"Scope: {scope_label}\n"
        f"Difficulty: {diff} — {cfg['style']}\n"
        f"Generate exactly {cfg['count']} multiple-choice questions.\n\n"
        f"=== Course excerpts ===\n{context}\n=== End excerpts ===\n\n"
        f"Return only the JSON array."
    )

    model = genai.GenerativeModel(GEN_MODEL, system_instruction=system_text)
    try:
        response = model.generate_content(user_text)
        text = response.text or ""
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    cleaned = _extract_json(text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON.")

    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="AI did not return a list of questions.")

    questions = _validate_questions(parsed, cfg["count"])

    return QCMGenerateOut(
        course_id=course_id,
        section_id=section_id,
        difficulty=diff,
        questions=questions,
    )


def submit_qcm(
    student_id: str,
    course_id: str,
    section_id: Optional[str],
    difficulty: str,
    questions: List[QCMQuestion],
    answers: List[int],
    db: Session,
) -> QCMSubmitOut:
    diff = _normalize_difficulty(difficulty)
    if not questions:
        raise HTTPException(status_code=400, detail="No questions submitted.")
    if len(answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count does not match question count.")

    results: List[QCMQuestionResult] = []
    score = 0
    for q, chosen in zip(questions, answers):
        chosen_int = chosen if isinstance(chosen, int) and 0 <= chosen <= 3 else -1
        is_correct = chosen_int == q.correct_index
        if is_correct:
            score += 1
        results.append(QCMQuestionResult(
            question=q.question,
            options=q.options,
            correct_index=q.correct_index,
            chosen_index=chosen_int,
            is_correct=is_correct,
            explanation=q.explanation,
        ))

    total = len(questions)
    pct = round(score / total * 100, 1) if total else 0.0
    passed = pct >= PASS_THRESHOLD_PCT

    attempt = QCMAttempt(
        student_id=UUID(student_id),
        course_id=UUID(course_id),
        section_id=UUID(section_id) if section_id else None,
        difficulty=diff,
        score=score,
        total=total,
        passed=passed,
        questions_json=json.dumps([q.model_dump() for q in questions]),
        answers_json=json.dumps(answers),
        completed_at=datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Gamification — award XP on the FIRST passed attempt for a given scope.
    if passed:
        scope_key = f"{course_id}:{section_id or 'course'}"
        scope_filter = (
            QCMAttempt.section_id == UUID(section_id)
            if section_id else
            QCMAttempt.section_id.is_(None)
        )
        already = (
            db.query(QCMAttempt)
            .filter(
                QCMAttempt.student_id == UUID(student_id),
                QCMAttempt.course_id == UUID(course_id),
                scope_filter,
                QCMAttempt.passed.is_(True),
                QCMAttempt.id != attempt.id,
            )
            .first()
        )
        if not already:
            xp_service.award_xp(
                user_id=student_id,
                source_type="quiz_pass",
                source_id=scope_key,
                description=f"Passed quiz ({diff})",
                db=db,
            )
            if score == total and total > 0:
                xp_service.award_xp(
                    user_id=student_id,
                    source_type="quiz_perfect_bonus",
                    source_id=f"{scope_key}:perfect",
                    amount=25,
                    description="Perfect score bonus",
                    db=db,
                )

    return QCMSubmitOut(
        attempt_id=str(attempt.id),
        score=score,
        total=total,
        score_pct=pct,
        passed=passed,
        pass_threshold_pct=PASS_THRESHOLD_PCT,
        results=results,
        completed_at=attempt.completed_at,
    )


def list_attempts(
    student_id: str,
    course_id: str,
    db: Session,
) -> List[QCMAttemptOut]:
    rows = (
        db.query(QCMAttempt)
        .filter(
            QCMAttempt.student_id == UUID(student_id),
            QCMAttempt.course_id == UUID(course_id),
        )
        .order_by(QCMAttempt.completed_at.desc())
        .all()
    )
    out: List[QCMAttemptOut] = []
    for r in rows:
        pct = round(r.score / r.total * 100, 1) if r.total else 0.0
        out.append(QCMAttemptOut(
            id=str(r.id),
            course_id=str(r.course_id),
            section_id=str(r.section_id) if r.section_id else None,
            difficulty=r.difficulty,
            score=r.score,
            total=r.total,
            score_pct=pct,
            passed=r.passed,
            completed_at=r.completed_at,
        ))
    return out
