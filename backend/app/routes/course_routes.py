import os
import traceback
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.controller import course_controller, notification_controller
from app.controller.student_analytics_controller import get_student_analytics
from app.controller.learner_analytics_controller import get_learner_analytics
from app.database import get_db
from app.models.course_material import CourseMaterial
from app.models.courses import Course
from app.models.user import User
from app.schemas.course import (
    BlockUpdate, CourseOut, CourseStudentsOut, EnrollmentOut, LessonBlockOut,
    MaterialOut, SectionCreate, SectionOut, SubsectionOut, SubsectionCreate,
    CourseProgressOut, MarkProgressRequest, CourseAnalyticsOut,
    FeedbackCreate, FeedbackOut,
)
from app.schemas.student_analytics import StudentAnalyticsOut
from app.schemas.learner_analytics import LearnerAnalyticsOut
from app.utils.rag import index_course_bg, index_course_sync
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/courses", tags=["courses"])

_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")


@router.get("/materials/{material_id}/text")
def get_material_text(
    material_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Extract and return the text content of a PDF material as HTML."""
    mat = db.query(CourseMaterial).filter(CourseMaterial.id == UUID(material_id)).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    if mat.type != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF materials support text extraction")

    pdf_path = os.path.join(_UPLOADS_DIR, mat.file_url)
    if not os.path.isfile(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    try:
        import fitz
        html = _pdf_to_html(pdf_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {exc}")

    return {"html": html}


def _pdf_to_html(path: str) -> str:
    """Convert a PDF file to clean HTML using PyMuPDF font metadata."""
    import fitz

    doc = fitz.open(path)
    all_spans: list[dict] = []

    for page in doc:
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                line_spans = []
                for span in line["spans"]:
                    text = span["text"].strip()
                    if text:
                        line_spans.append({
                            "text": text,
                            "size": span["size"],
                            "bold": bool(span["flags"] & 16) or "Bold" in span.get("font", ""),
                        })
                if line_spans:
                    all_spans.append({"spans": line_spans, "is_line": True})

    doc.close()

    if not all_spans:
        return "<p>No readable text found in this PDF.</p>"

    # Compute median font size for heading detection
    sizes = sorted(s["size"] for line in all_spans for s in line["spans"])
    median = sizes[len(sizes) // 2] if sizes else 12.0

    html_parts: list[str] = []
    para_buf: list[str] = []

    def flush_para() -> None:
        text = " ".join(para_buf).strip()
        if text:
            html_parts.append(f"<p>{text}</p>")
        para_buf.clear()

    _BULLET_PREFIXES = ("•", "-", "–", "●", "*", "·")

    for line in all_spans:
        spans = line["spans"]
        line_text = " ".join(s["text"] for s in spans).strip()
        if not line_text:
            flush_para()
            continue

        first = spans[0]
        is_large = first["size"] >= median * 1.35
        is_medium = first["size"] >= median * 1.15
        is_bold = first["bold"]

        # Heading detection
        if is_large or (is_medium and is_bold):
            flush_para()
            tag = "h2" if is_large else "h3"
            html_parts.append(f"<{tag}>{line_text}</{tag}>")
            continue

        # Bullet list
        if any(line_text.startswith(p) for p in _BULLET_PREFIXES):
            flush_para()
            item = line_text.lstrip("•-–●*· ").strip()
            html_parts.append(f"<ul><li>{item}</li></ul>")
            continue

        # Numbered list (e.g. "1.", "2.")
        if len(line_text) > 2 and line_text[0].isdigit() and line_text[1] in (".", ")"):
            flush_para()
            item = line_text[2:].strip()
            html_parts.append(f"<ol><li>{item}</li></ol>")
            continue

        # Bold-only line → treat as subheading
        if is_bold and first["size"] >= median * 1.02:
            flush_para()
            html_parts.append(f"<h4>{line_text}</h4>")
            continue

        para_buf.append(line_text)

    flush_para()

    # Merge consecutive <ul> and <ol> blocks
    merged: list[str] = []
    for part in html_parts:
        if merged and merged[-1].endswith("</li></ul>") and part.startswith("<ul><li>"):
            merged[-1] = merged[-1][:-5] + "<li>" + part[8:-5] + "</li></ul>"
        elif merged and merged[-1].endswith("</li></ol>") and part.startswith("<ol><li>"):
            merged[-1] = merged[-1][:-5] + "<li>" + part[8:-5] + "</li></ol>"
        else:
            merged.append(part)

    return "\n".join(merged)


# ── Professor routes ──────────────────────────────────────────────────────────

@router.post("", response_model=CourseOut)
async def create_course(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    is_free: bool = Form(True),
    price: float = Form(0.0),
    category_id: Optional[str] = Form(None),
    thumbnail: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.create_course(
        professor_id=current_user["sub"],
        title=title,
        description=description,
        is_free=is_free,
        price=price,
        category_id=category_id,
        thumbnail_file=thumbnail,
        db=db,
    )


@router.get("/my", response_model=List[CourseOut])
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.get_my_courses(current_user["sub"], db)


@router.post("/{course_id}/sections", response_model=SectionOut)
def add_section(
    course_id: str,
    data: SectionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.add_section(current_user["sub"], course_id, data, db)
    index_course_bg(course_id)
    return result


@router.delete("/{course_id}/sections/{section_id}")
def delete_section(
    course_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.delete_section(current_user["sub"], course_id, section_id, db)
    index_course_bg(course_id)
    return result


@router.post("/{course_id}/sections/{section_id}/subsections", response_model=SubsectionOut)
def add_subsection(
    course_id: str,
    section_id: str,
    data: SubsectionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.add_subsection(current_user["sub"], course_id, section_id, data, db)
    index_course_bg(course_id)
    return result


@router.post("/{course_id}/subsections/{subsection_id}/blocks", response_model=LessonBlockOut)
async def add_block(
    course_id: str,
    subsection_id: str,
    block_type: str = Form(...),
    content: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    order_index: int = Form(0),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.add_block(
        professor_id=current_user["sub"],
        course_id=course_id,
        subsection_id=subsection_id,
        block_type=block_type,
        content=content,
        file=file,
        caption=caption,
        order_index=order_index,
        db=db,
    )
    if block_type == "text":
        index_course_bg(course_id)
    return result


@router.patch("/blocks/{block_id}", response_model=LessonBlockOut)
def update_block(
    block_id: str,
    body: BlockUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.update_block(current_user["sub"], block_id, body.content, body.caption, db)
    course_id = course_controller.get_course_id_for_block(block_id, db)
    if course_id:
        index_course_bg(course_id)
    return result


@router.delete("/blocks/{block_id}")
def delete_block(
    block_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    course_id = course_controller.get_course_id_for_block(block_id, db)
    result = course_controller.delete_block(current_user["sub"], block_id, db)
    if course_id:
        index_course_bg(course_id)
    return result


@router.post("/{course_id}/sections/{section_id}/materials", response_model=MaterialOut)
async def upload_material(
    course_id: str,
    section_id: str,
    title: str = Form(...),
    mat_type: str = Form(...),
    order_index: int = Form(0),
    content_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.upload_material(
        professor_id=current_user["sub"],
        course_id=course_id,
        section_id=section_id,
        title=title,
        mat_type=mat_type,
        order_index=order_index,
        content_text=content_text,
        file=file,
        db=db,
    )
    index_course_bg(course_id)
    return result


@router.get("/my/students", response_model=List[CourseStudentsOut])
def get_my_students(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.get_my_students(current_user["sub"], db)


@router.get("/my/analytics", response_model=CourseAnalyticsOut)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.get_professor_analytics(current_user["sub"], db)


@router.delete("/{course_id}")
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.delete_course(current_user["sub"], course_id, db)


@router.patch("/{course_id}/publish", response_model=CourseOut)
def toggle_publish(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    result = course_controller.toggle_publish(current_user["sub"], course_id, db)
    # Publish is the canonical "make AI ready" event — index synchronously so
    # we know whether it succeeded before returning. Failure logs but does not
    # roll back the publish (the professor can manually retry via /api/ai/reindex).
    if result.is_published:
        try:
            n = index_course_sync(course_id)
            print(f"[RAG] toggle_publish: indexed {n} chunks for course {course_id}")
        except Exception as exc:
            print(f"[RAG] toggle_publish indexing FAILED for course {course_id}: {exc}")
            traceback.print_exc()
    return result


# ── Student / public routes ───────────────────────────────────────────────────
# NOTE: specific paths (/enrolled) must come before the /{course_id} wildcard.

@router.get("/feedback-summaries")
def feedback_summaries(db: Session = Depends(get_db)):
    return course_controller.get_feedback_summaries(db)


@router.get("/enrolled", response_model=List[CourseOut])
def get_enrolled_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.get_enrolled_courses(current_user["sub"], db)


@router.get("/student/analytics", response_model=StudentAnalyticsOut)
def student_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_student_analytics(current_user["sub"], db)


@router.get("/professor/learners/analytics", response_model=LearnerAnalyticsOut)
def learner_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return get_learner_analytics(current_user["sub"], db)


@router.get("", response_model=List[CourseOut])
def list_courses(category_id: Optional[str] = None, db: Session = Depends(get_db)):
    return course_controller.list_published_courses(db, category_id=category_id)


@router.get("/{course_id}/progress", response_model=CourseProgressOut)
def get_progress(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.get_course_progress(current_user["sub"], course_id, db)


@router.post("/{course_id}/progress", response_model=CourseProgressOut)
def mark_progress(
    course_id: str,
    body: MarkProgressRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.mark_item_completed(
        current_user["sub"], course_id, body.subsection_id, body.material_id, db
    )


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: str, db: Session = Depends(get_db)):
    return course_controller.get_course_detail(course_id, db)


@router.post("/{course_id}/enroll", response_model=EnrollmentOut)
async def enroll(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    enrollment = course_controller.enroll_student(current_user["sub"], course_id, db)
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    student = db.query(User).filter(User.id == UUID(current_user["sub"])).first()
    if course and student:
        await notification_controller.push(
            user_id=str(course.professor_id),
            type="enrollment",
            title="New Enrollment",
            body=f"{student.full_name} enrolled in your course \"{course.title}\"",
            db=db,
            meta={"course_id": course_id, "student_id": current_user["sub"]},
        )
    return enrollment


@router.delete("/{course_id}/enroll")
def unenroll(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.unenroll_student(current_user["sub"], course_id, db)


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/{course_id}/feedback", response_model=List[FeedbackOut])
def get_feedback(course_id: str, db: Session = Depends(get_db)):
    return course_controller.get_course_feedback(course_id, db)


@router.post("/{course_id}/feedback", response_model=FeedbackOut)
def submit_feedback(
    course_id: str,
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.create_feedback(current_user["sub"], course_id, body.rating, body.comment, db)
