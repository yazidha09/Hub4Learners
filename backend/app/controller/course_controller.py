import os
import shutil
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.courses import Course
from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.course_material import CourseMaterial
from app.models.course_progress import CourseProgress
from app.models.enrollment import Enrollment
from app.models.lesson_block import LessonBlock
from app.models.user import User
from app.models.course_feedback import CourseFeedback
from app.schemas.course import (
    CourseOut, SectionOut, SectionCreate, MaterialOut, LessonBlockOut,
    SubsectionOut, SubsectionCreate,
    EnrollmentOut, StudentOut, CourseStudentsOut,
    CourseProgressOut, MarkProgressRequest, CourseAnalyticsItem, CourseAnalyticsOut,
    AnalyticsReviewItem, AnalyticsTrendPoint,
    FeedbackCreate, FeedbackOut,
)

THUMBNAILS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "thumbnails")
MATERIALS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")
BLOCKS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "blocks")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")

THUMBNAIL_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MATERIAL_EXTS = {
    "pdf":      {".pdf"},
    "video":    {".mp4", ".webm", ".mov", ".avi"},
    "audio":    {".mp3", ".wav", ".ogg", ".m4a"},
    "exercise": {".pdf", ".docx", ".zip", ".txt"},
}
BLOCK_EXTS = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "video": {".mp4", ".webm", ".mov"},
}


def _save_file(file: UploadFile, dest_dir: str, allowed_exts: set, prefix: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not allowed. Accepted: {', '.join(sorted(allowed_exts))}",
        )
    os.makedirs(dest_dir, exist_ok=True)
    filename = f"{prefix}_{uuid4().hex}{ext}"
    with open(os.path.join(dest_dir, filename), "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filename


def _build_block_out(b: LessonBlock) -> LessonBlockOut:
    return LessonBlockOut(
        id=b.id,
        subsection_id=b.subsection_id,
        section_id=b.section_id,
        block_type=b.block_type,
        content=b.content,
        file_url=b.file_url,
        caption=b.caption,
        order_index=b.order_index,
        created_at=b.created_at,
    )


def _build_section_out(section: CourseSection, db: Session) -> SectionOut:
    """Build a single SectionOut with all subsections and blocks."""
    materials = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.section_id == section.id)
        .order_by(CourseMaterial.order_index)
        .all()
    )
    legacy_blocks = (
        db.query(LessonBlock)
        .filter(LessonBlock.section_id == section.id, LessonBlock.subsection_id == None)  # noqa: E711
        .order_by(LessonBlock.order_index)
        .all()
    )
    subsections_raw = (
        db.query(CourseSubsection)
        .filter(CourseSubsection.section_id == section.id)
        .order_by(CourseSubsection.order_index)
        .all()
    )
    subsections_out = []
    for sub in subsections_raw:
        blocks = (
            db.query(LessonBlock)
            .filter(LessonBlock.subsection_id == sub.id)
            .order_by(LessonBlock.order_index)
            .all()
        )
        subsections_out.append(SubsectionOut(
            id=sub.id,
            section_id=sub.section_id,
            title=sub.title,
            order_index=sub.order_index,
            created_at=sub.created_at,
            blocks=[_build_block_out(b) for b in blocks],
        ))
    return SectionOut(
        id=section.id,
        course_id=section.course_id,
        title=section.title,
        order_index=section.order_index,
        created_at=section.created_at,
        materials=[
            MaterialOut(
                id=m.id, section_id=m.section_id, title=m.title,
                type=m.type, file_url=m.file_url, content_text=m.content_text,
                order_index=m.order_index, created_at=m.created_at,
            )
            for m in materials
        ],
        blocks=[_build_block_out(b) for b in legacy_blocks],
        subsections=subsections_out,
    )


def _build_course_out(course: Course, db: Session) -> CourseOut:
    """Build full CourseOut with all sections/subsections/blocks — use for single-course detail only."""
    professor = db.query(User).filter(User.id == course.professor_id).first()
    category = None
    if course.category_id:
        category = db.query(Category).filter(Category.id == course.category_id).first()

    sections_raw = (
        db.query(CourseSection)
        .filter(CourseSection.course_id == course.id)
        .order_by(CourseSection.order_index)
        .all()
    )
    enrolled_count = (
        db.query(func.count(Enrollment.id)).filter(Enrollment.course_id == course.id).scalar() or 0
    )

    section_ids = [s.id for s in sections_raw]
    sections = _build_sections_batched(section_ids, sections_raw, db)

    return CourseOut(
        id=course.id,
        title=course.title,
        description=course.description,
        thumbnail=course.thumbnail,
        is_free=course.is_free,
        professor_id=course.professor_id,
        professor_name=professor.full_name if professor else "Unknown",
        category_id=course.category_id,
        category_name=category.name if category else None,
        is_published=course.is_published,
        created_at=course.created_at,
        updated_at=course.updated_at,
        sections=sections,
        sections_count=len(sections),
        enrolled_count=enrolled_count,
    )


def _build_sections_batched(
    section_ids: list,
    sections_raw: list,
    db: Session,
) -> list:
    """Load all section data for a course using IN queries instead of N+1 per section."""
    if not section_ids:
        return []

    # Batch load materials, legacy blocks, subsections in 3 queries
    materials_by_section: dict = {}
    for m in (
        db.query(CourseMaterial)
        .filter(CourseMaterial.section_id.in_(section_ids))
        .order_by(CourseMaterial.order_index)
        .all()
    ):
        materials_by_section.setdefault(m.section_id, []).append(m)

    legacy_blocks_by_section: dict = {}
    for b in (
        db.query(LessonBlock)
        .filter(LessonBlock.section_id.in_(section_ids), LessonBlock.subsection_id == None)  # noqa: E711
        .order_by(LessonBlock.order_index)
        .all()
    ):
        legacy_blocks_by_section.setdefault(b.section_id, []).append(b)

    all_subsections = (
        db.query(CourseSubsection)
        .filter(CourseSubsection.section_id.in_(section_ids))
        .order_by(CourseSubsection.order_index)
        .all()
    )
    subsections_by_section: dict = {}
    for sub in all_subsections:
        subsections_by_section.setdefault(sub.section_id, []).append(sub)

    # Batch load all subsection blocks in 1 query
    sub_ids = [sub.id for sub in all_subsections]
    blocks_by_sub: dict = {}
    if sub_ids:
        for b in (
            db.query(LessonBlock)
            .filter(LessonBlock.subsection_id.in_(sub_ids))
            .order_by(LessonBlock.order_index)
            .all()
        ):
            blocks_by_sub.setdefault(b.subsection_id, []).append(b)

    sections_out = []
    needs_commit = False

    for section in sections_raw:
        subs_raw = subsections_by_section.get(section.id, [])
        subsections_out = []

        # Auto-migrate legacy CourseMaterial 'lesson' rows to subsection hierarchy on first load.
        if not subs_raw:
            legacy_lessons = [
                m for m in materials_by_section.get(section.id, [])
                if m.type == "lesson"
            ]
            if legacy_lessons:
                for lm in legacy_lessons:
                    content = lm.content_text or "<p>No content.</p>"
                    if not content.strip().startswith("<"):
                        content = f"<p>{content}</p>"
                    new_sub = CourseSubsection(
                        section_id=section.id,
                        title=lm.title,
                        order_index=lm.order_index,
                    )
                    db.add(new_sub)
                    db.flush()
                    new_block = LessonBlock(
                        subsection_id=new_sub.id,
                        block_type="text",
                        content=content,
                        order_index=0,
                    )
                    db.add(new_block)
                    db.flush()
                    db.delete(lm)
                    subsections_out.append(SubsectionOut(
                        id=new_sub.id,
                        section_id=new_sub.section_id,
                        title=new_sub.title,
                        order_index=new_sub.order_index,
                        created_at=new_sub.created_at,
                        blocks=[_build_block_out(new_block)],
                    ))
                    # Remove migrated material from local dict so it won't appear in materials list
                    sec_mats = materials_by_section.get(section.id, [])
                    materials_by_section[section.id] = [m2 for m2 in sec_mats if m2.id != lm.id]
                needs_commit = True
        else:
            for sub in subs_raw:
                subsections_out.append(SubsectionOut(
                    id=sub.id,
                    section_id=sub.section_id,
                    title=sub.title,
                    order_index=sub.order_index,
                    created_at=sub.created_at,
                    blocks=[_build_block_out(b) for b in blocks_by_sub.get(sub.id, [])],
                ))

        materials = [
            MaterialOut(
                id=m.id,
                section_id=m.section_id,
                title=m.title,
                type=m.type,
                file_url=m.file_url,
                content_text=m.content_text,
                order_index=m.order_index,
                created_at=m.created_at,
            )
            for m in materials_by_section.get(section.id, [])
        ]
        sections_out.append(SectionOut(
            id=section.id,
            course_id=section.course_id,
            title=section.title,
            order_index=section.order_index,
            created_at=section.created_at,
            materials=materials,
            blocks=[_build_block_out(b) for b in legacy_blocks_by_section.get(section.id, [])],
            subsections=subsections_out,
        ))

    if needs_commit:
        db.commit()

    return sections_out


def _build_course_list(courses: list, db: Session) -> list:
    """Build lightweight CourseOut list (no sections) using batch queries — for list/browse endpoints."""
    if not courses:
        return []

    prof_ids = list({c.professor_id for c in courses})
    professors = {u.id: u for u in db.query(User).filter(User.id.in_(prof_ids)).all()}

    cat_ids = list({c.category_id for c in courses if c.category_id})
    categories: dict = {}
    if cat_ids:
        categories = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()}

    course_ids = [c.id for c in courses]
    counts_raw = (
        db.query(Enrollment.course_id, func.count(Enrollment.id))
        .filter(Enrollment.course_id.in_(course_ids))
        .group_by(Enrollment.course_id)
        .all()
    )
    enrolled_counts = {row[0]: row[1] for row in counts_raw}

    section_counts_raw = (
        db.query(CourseSection.course_id, func.count(CourseSection.id))
        .filter(CourseSection.course_id.in_(course_ids))
        .group_by(CourseSection.course_id)
        .all()
    )
    section_counts = {row[0]: row[1] for row in section_counts_raw}

    return [
        CourseOut(
            id=c.id,
            title=c.title,
            description=c.description,
            thumbnail=c.thumbnail,
            is_free=c.is_free,
            professor_id=c.professor_id,
            professor_name=professors[c.professor_id].full_name if c.professor_id in professors else "Unknown",
            category_id=c.category_id,
            category_name=categories[c.category_id].name if c.category_id and c.category_id in categories else None,
            is_published=c.is_published,
            created_at=c.created_at,
            updated_at=c.updated_at,
            sections=[],
            sections_count=section_counts.get(c.id, 0),
            enrolled_count=enrolled_counts.get(c.id, 0),
        )
        for c in courses
    ]


def create_course(
    professor_id: str,
    title: str,
    description: Optional[str],
    is_free: bool,
    category_id: Optional[str],
    thumbnail_file: Optional[UploadFile],
    db: Session,
) -> CourseOut:
    thumbnail_path: Optional[str] = None
    if thumbnail_file and thumbnail_file.filename:
        filename = _save_file(thumbnail_file, THUMBNAILS_DIR, THUMBNAIL_EXTS, professor_id)
        thumbnail_path = f"thumbnails/{filename}"

    if category_id:
        cat = db.query(Category).filter(Category.id == UUID(category_id)).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category")

    course = Course(
        title=title,
        description=description,
        is_free=is_free,
        is_subscription=False,
        professor_id=UUID(professor_id),
        category_id=UUID(category_id) if category_id else None,
        is_published=False,
        thumbnail=thumbnail_path,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _build_course_out(course, db)


def get_my_courses(professor_id: str, db: Session) -> List[CourseOut]:
    courses = (
        db.query(Course)
        .filter(Course.professor_id == UUID(professor_id))
        .order_by(Course.created_at.desc())
        .all()
    )
    return _build_course_list(courses, db)


def add_section(
    professor_id: str,
    course_id: str,
    data: SectionCreate,
    db: Session,
) -> SectionOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = CourseSection(
        course_id=UUID(course_id),
        title=data.title,
        order_index=data.order_index,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return _build_section_out(section, db)


def delete_section(professor_id: str, course_id: str, section_id: str, db: Session) -> dict:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = db.query(CourseSection).filter(
        CourseSection.id == UUID(section_id),
        CourseSection.course_id == UUID(course_id),
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Delete progress records that reference materials or subsections in this section
    material_ids = [
        m.id for m in db.query(CourseMaterial).filter(CourseMaterial.section_id == section.id).all()
    ]
    subsections = db.query(CourseSubsection).filter(CourseSubsection.section_id == section.id).all()
    sub_ids = [s.id for s in subsections]

    if material_ids:
        db.query(CourseProgress).filter(CourseProgress.material_id.in_(material_ids)).delete(synchronize_session=False)
    if sub_ids:
        db.query(CourseProgress).filter(CourseProgress.subsection_id.in_(sub_ids)).delete(synchronize_session=False)

    db.query(CourseMaterial).filter(CourseMaterial.section_id == section.id).delete()
    db.query(LessonBlock).filter(LessonBlock.section_id == section.id, LessonBlock.subsection_id == None).delete()  # noqa: E711
    for sub in subsections:
        db.query(LessonBlock).filter(LessonBlock.subsection_id == sub.id).delete()
    db.query(CourseSubsection).filter(CourseSubsection.section_id == section.id).delete()
    db.delete(section)
    db.commit()
    return {"detail": "Section deleted"}


def add_subsection(
    professor_id: str,
    course_id: str,
    section_id: str,
    data: SubsectionCreate,
    db: Session,
) -> SubsectionOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = db.query(CourseSection).filter(CourseSection.id == UUID(section_id)).first()
    if not section or str(section.course_id) != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    subsection = CourseSubsection(
        section_id=UUID(section_id),
        title=data.title,
        order_index=data.order_index,
    )
    db.add(subsection)
    db.commit()
    db.refresh(subsection)
    return SubsectionOut(
        id=subsection.id,
        section_id=subsection.section_id,
        title=subsection.title,
        order_index=subsection.order_index,
        created_at=subsection.created_at,
        blocks=[],
    )


def upload_material(
    professor_id: str,
    course_id: str,
    section_id: str,
    title: str,
    mat_type: str,
    order_index: int,
    content_text: Optional[str],
    file: UploadFile,
    db: Session,
) -> MaterialOut:
    if mat_type not in MATERIAL_EXTS:
        raise HTTPException(status_code=400, detail=f"Invalid type '{mat_type}'")

    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = db.query(CourseSection).filter(CourseSection.id == UUID(section_id)).first()
    if not section or str(section.course_id) != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    filename = _save_file(file, MATERIALS_DIR, MATERIAL_EXTS[mat_type], f"{section_id}_{mat_type}")
    file_url = f"materials/{filename}"

    material = CourseMaterial(
        section_id=UUID(section_id),
        title=title,
        type=mat_type,
        file_url=file_url,
        content_text=content_text,
        order_index=order_index,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    return MaterialOut(
        id=material.id,
        section_id=material.section_id,
        title=material.title,
        type=material.type,
        file_url=material.file_url,
        content_text=material.content_text,
        order_index=material.order_index,
        created_at=material.created_at,
    )


def add_block(
    professor_id: str,
    course_id: str,
    subsection_id: str,
    block_type: str,
    content: Optional[str],
    file: Optional[UploadFile],
    caption: Optional[str],
    order_index: int,
    db: Session,
) -> LessonBlockOut:
    if block_type not in ("text", "image", "video"):
        raise HTTPException(status_code=400, detail=f"Invalid block type '{block_type}'")

    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    subsection = db.query(CourseSubsection).filter(CourseSubsection.id == UUID(subsection_id)).first()
    if not subsection:
        raise HTTPException(status_code=404, detail="Subsection not found")
    section = db.query(CourseSection).filter(CourseSection.id == subsection.section_id).first()
    if not section or str(section.course_id) != course_id:
        raise HTTPException(status_code=404, detail="Subsection not in this course")

    file_url = None
    if block_type in ("image", "video") and file and file.filename:
        filename = _save_file(file, BLOCKS_DIR, BLOCK_EXTS[block_type], f"{subsection_id}_{block_type}")
        file_url = f"blocks/{filename}"

    block = LessonBlock(
        subsection_id=UUID(subsection_id),
        section_id=None,
        block_type=block_type,
        content=content if block_type == "text" else None,
        file_url=file_url,
        caption=caption,
        order_index=order_index,
    )
    db.add(block)
    db.commit()
    db.refresh(block)

    return _build_block_out(block)


def update_block(professor_id: str, block_id: str, content: str, caption: Optional[str], db: Session) -> LessonBlockOut:
    block = db.query(LessonBlock).filter(LessonBlock.id == UUID(block_id)).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if block.subsection_id:
        subsection = db.query(CourseSubsection).filter(CourseSubsection.id == block.subsection_id).first()
        section = db.query(CourseSection).filter(CourseSection.id == subsection.section_id).first() if subsection else None
    else:
        section = db.query(CourseSection).filter(CourseSection.id == block.section_id).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    course = db.query(Course).filter(Course.id == section.course_id).first()
    if not course or str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    if block.block_type == "text":
        block.content = content
    if caption is not None:
        block.caption = caption

    db.add(block)
    db.commit()
    db.refresh(block)
    return _build_block_out(block)


def delete_block(professor_id: str, block_id: str, db: Session) -> dict:
    block = db.query(LessonBlock).filter(LessonBlock.id == UUID(block_id)).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    # Resolve course ownership through subsection or legacy section_id
    if block.subsection_id:
        subsection = db.query(CourseSubsection).filter(CourseSubsection.id == block.subsection_id).first()
        if not subsection:
            raise HTTPException(status_code=404, detail="Subsection not found")
        section = db.query(CourseSection).filter(CourseSection.id == subsection.section_id).first()
    else:
        section = db.query(CourseSection).filter(CourseSection.id == block.section_id).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    course = db.query(Course).filter(Course.id == section.course_id).first()
    if not course or str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    if block.file_url:
        file_path = os.path.join(UPLOADS_DIR, block.file_url)
        if os.path.isfile(file_path):
            os.remove(file_path)

    db.delete(block)
    db.commit()
    return {"detail": "Block deleted"}


def _count_course_items(course_id: UUID, db: Session):
    """Return (subsection_count, legacy_material_count) for progress tracking."""
    section_ids = [
        row[0] for row in db.query(CourseSection.id).filter(CourseSection.course_id == course_id).all()
    ]
    if not section_ids:
        return 0, 0

    sub_count = (
        db.query(func.count(CourseSubsection.id))
        .filter(CourseSubsection.section_id.in_(section_ids))
        .scalar()
    ) or 0

    sections_with_subs = {
        row[0] for row in db.query(CourseSubsection.section_id)
        .filter(CourseSubsection.section_id.in_(section_ids))
        .distinct()
        .all()
    }
    legacy_section_ids = [sid for sid in section_ids if sid not in sections_with_subs]

    mat_count = 0
    if legacy_section_ids:
        mat_count = (
            db.query(func.count(CourseMaterial.id))
            .filter(CourseMaterial.section_id.in_(legacy_section_ids))
            .scalar()
        ) or 0

    return sub_count, mat_count


def get_course_progress(student_id: str, course_id: str, db: Session) -> CourseProgressOut:
    cid = UUID(course_id)
    sid = UUID(student_id)

    sub_count, mat_count = _count_course_items(cid, db)
    total = sub_count + mat_count

    completed_subs = (
        db.query(CourseProgress)
        .filter(
            CourseProgress.student_id == sid,
            CourseProgress.course_id == cid,
            CourseProgress.subsection_id != None,  # noqa: E711
        )
        .all()
    )
    completed_mats = (
        db.query(CourseProgress)
        .filter(
            CourseProgress.student_id == sid,
            CourseProgress.course_id == cid,
            CourseProgress.material_id != None,  # noqa: E711
        )
        .all()
    )

    completed = len(completed_subs) + len(completed_mats)
    pct = round(completed / total * 100, 1) if total > 0 else 0.0

    return CourseProgressOut(
        course_id=course_id,
        completed_subsection_ids=[str(p.subsection_id) for p in completed_subs],
        completed_material_ids=[str(p.material_id) for p in completed_mats],
        total_items=total,
        completed_items=completed,
        progress_pct=pct,
    )


def mark_item_completed(
    student_id: str,
    course_id: str,
    subsection_id: Optional[str],
    material_id: Optional[str],
    db: Session,
) -> CourseProgressOut:
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this course")

    if subsection_id:
        existing = (
            db.query(CourseProgress)
            .filter(CourseProgress.student_id == UUID(student_id), CourseProgress.subsection_id == UUID(subsection_id))
            .first()
        )
        if not existing:
            db.add(CourseProgress(
                student_id=UUID(student_id),
                course_id=UUID(course_id),
                subsection_id=UUID(subsection_id),
            ))
            db.commit()
    elif material_id:
        existing = (
            db.query(CourseProgress)
            .filter(CourseProgress.student_id == UUID(student_id), CourseProgress.material_id == UUID(material_id))
            .first()
        )
        if not existing:
            db.add(CourseProgress(
                student_id=UUID(student_id),
                course_id=UUID(course_id),
                material_id=UUID(material_id),
            ))
            db.commit()
    else:
        raise HTTPException(status_code=400, detail="Provide subsection_id or material_id")

    result = get_course_progress(student_id, course_id, db)

    if result.progress_pct >= 100.0 and enrollment.status != "completed":
        enrollment.status = "completed"
        db.commit()

    return result


def get_professor_analytics(professor_id: str, db: Session) -> CourseAnalyticsOut:
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)
    since_30d = now - timedelta(days=30)

    courses = (
        db.query(Course)
        .filter(Course.professor_id == UUID(professor_id))
        .order_by(Course.created_at.desc())
        .all()
    )

    if not courses:
        return CourseAnalyticsOut()

    course_ids = [c.id for c in courses]

    # Pre-fetch categories
    cat_ids = [c.category_id for c in courses if c.category_id]
    categories = {}
    if cat_ids:
        categories = {
            cat.id: cat.name
            for cat in db.query(Category).filter(Category.id.in_(cat_ids)).all()
        }

    # Pre-fetch all enrollments grouped by course
    all_enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id.in_(course_ids))
        .all()
    )
    enrollments_by_course = defaultdict(list)
    for e in all_enrollments:
        enrollments_by_course[e.course_id].append(e)

    # Pre-fetch all feedback grouped by course
    all_feedback = (
        db.query(CourseFeedback)
        .filter(CourseFeedback.course_id.in_(course_ids))
        .order_by(CourseFeedback.created_at.desc())
        .all()
    )
    feedback_by_course = defaultdict(list)
    for fb in all_feedback:
        feedback_by_course[fb.course_id].append(fb)

    # Lookup user names referenced in feedback (single query)
    fb_user_ids = list({fb.user_id for fb in all_feedback})
    user_names = {}
    if fb_user_ids:
        user_names = {
            u.id: u.full_name
            for u in db.query(User).filter(User.id.in_(fb_user_ids)).all()
        }

    # Pre-fetch progress rows for avg_progress per course
    all_progress = (
        db.query(CourseProgress)
        .filter(CourseProgress.course_id.in_(course_ids))
        .all()
    )
    progress_by_course_student = defaultdict(lambda: defaultdict(int))
    for p in all_progress:
        progress_by_course_student[p.course_id][p.student_id] += 1

    items: List[CourseAnalyticsItem] = []
    overall_rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    total_rating_sum = 0
    total_rating_count = 0
    enrollments_last_7d_total = 0
    enrollments_last_30d_total = 0
    completions_last_30d_total = 0

    # Build trend (last 30 days) — enrollments + completions per day
    trend_enroll = defaultdict(int)
    trend_complete = defaultdict(int)

    for course in courses:
        enrollments = enrollments_by_course.get(course.id, [])
        enrolled_count = len(enrollments)
        completed_count = sum(1 for e in enrollments if e.status == "completed")
        in_progress_count = enrolled_count - completed_count
        completion_rate = round(completed_count / enrolled_count * 100, 1) if enrolled_count > 0 else 0.0

        # Trends per course
        course_enroll_7d = sum(1 for e in enrollments if e.enrolled_at and e.enrolled_at >= since_7d)
        course_enroll_30d = sum(1 for e in enrollments if e.enrolled_at and e.enrolled_at >= since_30d)
        enrollments_last_7d_total += course_enroll_7d
        enrollments_last_30d_total += course_enroll_30d

        last_enrollment_at = max(
            (e.enrolled_at for e in enrollments if e.enrolled_at),
            default=None,
        )

        # Add to trend buckets (last 30 days only)
        for e in enrollments:
            if e.enrolled_at and e.enrolled_at >= since_30d:
                day_key = e.enrolled_at.date().isoformat()
                trend_enroll[day_key] += 1
        # Approximate completions trend: count completed enrollments updated in 30d
        # (we have no separate completed_at, so use enrolled_at as a proxy when status=completed)
        for e in enrollments:
            if e.status == "completed" and e.enrolled_at and e.enrolled_at >= since_30d:
                day_key = e.enrolled_at.date().isoformat()
                trend_complete[day_key] += 1
                completions_last_30d_total += 1

        # Ratings
        feedback_rows = feedback_by_course.get(course.id, [])
        rating_count = len(feedback_rows)
        rating_sum = sum(fb.rating for fb in feedback_rows)
        avg_rating = round(rating_sum / rating_count, 2) if rating_count > 0 else 0.0
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for fb in feedback_rows:
            star = max(1, min(5, fb.rating))
            rating_distribution[star] += 1
            overall_rating_distribution[star] += 1
        total_rating_sum += rating_sum
        total_rating_count += rating_count

        recent_reviews = [
            AnalyticsReviewItem(
                user_name=user_names.get(fb.user_id, "Unknown"),
                rating=fb.rating,
                comment=fb.comment,
                created_at=fb.created_at,
            )
            for fb in feedback_rows[:5]
        ]

        # Avg progress across non-completed enrolled students
        sub_count, mat_count = _count_course_items(course.id, db)
        total_items = sub_count + mat_count
        if enrolled_count > 0 and total_items > 0:
            student_progress = progress_by_course_student.get(course.id, {})
            student_pcts = []
            for e in enrollments:
                if e.status == "completed":
                    student_pcts.append(100.0)
                else:
                    completed_items = student_progress.get(e.student_id, 0)
                    student_pcts.append(min(100.0, completed_items / total_items * 100.0))
            avg_progress = round(sum(student_pcts) / len(student_pcts), 1) if student_pcts else 0.0
        else:
            avg_progress = 0.0

        items.append(CourseAnalyticsItem(
            course_id=str(course.id),
            course_title=course.title,
            thumbnail=course.thumbnail,
            category_name=categories.get(course.category_id) if course.category_id else None,
            is_published=course.is_published,
            created_at=course.created_at,
            enrolled_count=enrolled_count,
            completed_count=completed_count,
            in_progress_count=in_progress_count,
            completion_rate=completion_rate,
            avg_progress=avg_progress,
            avg_rating=avg_rating,
            rating_count=rating_count,
            rating_distribution=rating_distribution,
            recent_reviews=recent_reviews,
            enrollments_last_7d=course_enroll_7d,
            enrollments_last_30d=course_enroll_30d,
            last_enrollment_at=last_enrollment_at,
            total_lessons=total_items,
        ))

    # Top-level aggregates
    total_enrolled = sum(i.enrolled_count for i in items)
    total_completed = sum(i.completed_count for i in items)
    total_in_progress = sum(i.in_progress_count for i in items)
    overall_completion_rate = round(total_completed / total_enrolled * 100, 1) if total_enrolled > 0 else 0.0
    overall_avg_rating = round(total_rating_sum / total_rating_count, 2) if total_rating_count > 0 else 0.0
    total_published = sum(1 for i in items if i.is_published)
    total_drafts = len(items) - total_published

    # Build a contiguous 30-day trend (fills empty days)
    trend: List[AnalyticsTrendPoint] = []
    for offset in range(29, -1, -1):
        d = (now - timedelta(days=offset)).date().isoformat()
        trend.append(AnalyticsTrendPoint(
            date=d,
            enrollments=trend_enroll.get(d, 0),
            completions=trend_complete.get(d, 0),
        ))

    top_enroll = sorted(items, key=lambda i: i.enrolled_count, reverse=True)[:3]
    top_rated = sorted(
        [i for i in items if i.rating_count > 0],
        key=lambda i: (i.avg_rating, i.rating_count),
        reverse=True,
    )[:3]

    return CourseAnalyticsOut(
        courses=items,
        total_courses=len(items),
        total_published=total_published,
        total_drafts=total_drafts,
        total_enrolled=total_enrolled,
        total_completed=total_completed,
        total_in_progress=total_in_progress,
        overall_completion_rate=overall_completion_rate,
        overall_avg_rating=overall_avg_rating,
        total_reviews=total_rating_count,
        overall_rating_distribution=overall_rating_distribution,
        enrollments_last_7d=enrollments_last_7d_total,
        enrollments_last_30d=enrollments_last_30d_total,
        completions_last_30d=completions_last_30d_total,
        trend=trend,
        top_courses_by_enrollment=top_enroll,
        top_courses_by_rating=top_rated,
    )


def delete_course(professor_id: str, course_id: str, db: Session) -> dict:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    cid = str(course.id)

    # Must delete progress first — it has FKs to subsections and materials
    db.query(CourseProgress).filter(CourseProgress.course_id == UUID(cid)).delete()

    sections = db.query(CourseSection).filter(CourseSection.course_id == UUID(cid)).all()
    for section in sections:
        db.query(CourseMaterial).filter(CourseMaterial.section_id == section.id).delete()
        db.query(LessonBlock).filter(LessonBlock.section_id == section.id, LessonBlock.subsection_id == None).delete()
        subsections = db.query(CourseSubsection).filter(CourseSubsection.section_id == section.id).all()
        for sub in subsections:
            db.query(LessonBlock).filter(LessonBlock.subsection_id == sub.id).delete()
        db.query(CourseSubsection).filter(CourseSubsection.section_id == section.id).delete()

    db.query(CourseSection).filter(CourseSection.course_id == UUID(cid)).delete()
    db.query(CourseFeedback).filter(CourseFeedback.course_id == UUID(cid)).delete()
    db.query(Enrollment).filter(Enrollment.course_id == UUID(cid)).delete()
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted successfully"}


def toggle_publish(professor_id: str, course_id: str, db: Session) -> CourseOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    if not course.is_published:
        prof = db.query(User).filter(User.id == UUID(professor_id)).first()
        if prof and not prof.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Your account must be verified before you can publish courses. Submit a verification request to your region admin.",
            )

    course.is_published = not course.is_published
    db.commit()
    db.refresh(course)
    return _build_course_out(course, db)


def list_published_courses(db: Session, category_id: Optional[str] = None) -> List[CourseOut]:
    query = db.query(Course).filter(
        Course.is_published == True, Course.is_free == True  # noqa: E712
    )
    if category_id:
        query = query.filter(Course.category_id == UUID(category_id))
    courses = query.order_by(Course.created_at.desc()).all()
    return _build_course_list(courses, db)


def get_course_detail(course_id: str, db: Session) -> CourseOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _build_course_out(course, db)


def enroll_student(student_id: str, course_id: str, db: Session) -> EnrollmentOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.is_published:
        raise HTTPException(status_code=400, detail="Course is not published")
    if not course.is_free:
        raise HTTPException(status_code=400, detail="Paid courses are not available yet")
    if str(course.professor_id) == student_id:
        raise HTTPException(status_code=400, detail="You cannot enroll in your own course")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = Enrollment(
        student_id=UUID(student_id),
        course_id=UUID(course_id),
        status="active",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return EnrollmentOut(
        id=enrollment.id,
        student_id=enrollment.student_id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        enrolled_at=enrollment.enrolled_at,
    )


def get_my_students(professor_id: str, db: Session) -> List[CourseStudentsOut]:
    courses = (
        db.query(Course)
        .filter(Course.professor_id == UUID(professor_id))
        .order_by(Course.created_at.desc())
        .all()
    )
    if not courses:
        return []

    course_ids = [c.id for c in courses]
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id.in_(course_ids))
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    # Batch load all students
    student_ids = list({e.student_id for e in enrollments})
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}

    enrollments_by_course: dict = {}
    for e in enrollments:
        enrollments_by_course.setdefault(e.course_id, []).append(e)

    return [
        CourseStudentsOut(
            course_id=course.id,
            course_title=course.title,
            is_published=course.is_published,
            students=[
                StudentOut(
                    id=users[e.student_id].id,
                    full_name=users[e.student_id].full_name,
                    email=users[e.student_id].email,
                    enrolled_at=e.enrolled_at,
                    status=e.status,
                )
                for e in enrollments_by_course.get(course.id, [])
                if e.student_id in users
            ],
        )
        for course in courses
    ]


def unenroll_student(student_id: str, course_id: str, db: Session) -> dict:
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this course")
    db.delete(enrollment)
    db.commit()
    return {"detail": "Unenrolled successfully"}


def _batch_progress_pct(student_id: UUID, course_ids: list, db: Session) -> dict:
    """Return {course_id: progress_pct} for multiple courses in ~5 queries total."""
    if not course_ids:
        return {}

    section_rows = (
        db.query(CourseSection.id, CourseSection.course_id)
        .filter(CourseSection.course_id.in_(course_ids))
        .all()
    )
    section_ids_by_course: dict = {}
    all_section_ids = []
    for sec_id, cid in section_rows:
        section_ids_by_course.setdefault(cid, []).append(sec_id)
        all_section_ids.append(sec_id)

    if not all_section_ids:
        return {cid: 0.0 for cid in course_ids}

    sub_counts = dict(
        db.query(CourseSubsection.section_id, func.count(CourseSubsection.id))
        .filter(CourseSubsection.section_id.in_(all_section_ids))
        .group_by(CourseSubsection.section_id)
        .all()
    )
    sections_with_subs = set(sub_counts.keys())

    legacy_mat_counts: dict = {}
    legacy_sec_ids = [sid for sid in all_section_ids if sid not in sections_with_subs]
    if legacy_sec_ids:
        legacy_mat_counts = dict(
            db.query(CourseMaterial.section_id, func.count(CourseMaterial.id))
            .filter(CourseMaterial.section_id.in_(legacy_sec_ids))
            .group_by(CourseMaterial.section_id)
            .all()
        )

    completed_by_course = dict(
        db.query(CourseProgress.course_id, func.count(CourseProgress.id))
        .filter(
            CourseProgress.student_id == student_id,
            CourseProgress.course_id.in_(course_ids),
        )
        .group_by(CourseProgress.course_id)
        .all()
    )

    result = {}
    for cid in course_ids:
        sec_ids = section_ids_by_course.get(cid, [])
        total_subs = sum(sub_counts.get(sid, 0) for sid in sec_ids)
        total_mats = sum(legacy_mat_counts.get(sid, 0) for sid in sec_ids if sid not in sections_with_subs)
        total = total_subs + total_mats
        completed = completed_by_course.get(cid, 0)
        result[cid] = round(completed / total * 100, 1) if total > 0 else 0.0
    return result


def get_enrolled_courses(student_id: str, db: Session) -> List[CourseOut]:
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id))
        .all()
    )
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]
    enrollment_by_course = {e.course_id: e for e in enrollments}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    summaries = _build_course_list(courses, db)

    progress_map = _batch_progress_pct(UUID(student_id), course_ids, db)

    for summary in summaries:
        e = enrollment_by_course.get(summary.id)
        if e:
            summary.enrollment_status = e.status
        summary.progress_pct = progress_map.get(summary.id, 0.0)

    return summaries


# ── Course feedback ───────────────────────────────────────────────────────────

def create_feedback(user_id: str, course_id: str, rating: int, comment, db: Session) -> FeedbackOut:
    if not 1 <= rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == UUID(user_id),
            Enrollment.course_id == UUID(course_id),
            Enrollment.status == "completed",
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="You must complete this course before leaving feedback.",
        )

    existing = (
        db.query(CourseFeedback)
        .filter(
            CourseFeedback.user_id == UUID(user_id),
            CourseFeedback.course_id == UUID(course_id),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already submitted feedback for this course.")

    fb = CourseFeedback(course_id=UUID(course_id), user_id=UUID(user_id), rating=rating, comment=comment)
    db.add(fb)
    db.commit()
    db.refresh(fb)

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    return FeedbackOut(
        id=fb.id,
        course_id=fb.course_id,
        user_id=fb.user_id,
        user_name=user.full_name if user else "Unknown",
        rating=fb.rating,
        comment=fb.comment,
        created_at=fb.created_at,
    )


def get_course_feedback(course_id: str, db: Session) -> List[FeedbackOut]:
    rows = (
        db.query(CourseFeedback)
        .filter(CourseFeedback.course_id == UUID(course_id))
        .order_by(CourseFeedback.created_at.desc())
        .all()
    )
    result = []
    for fb in rows:
        user = db.query(User).filter(User.id == fb.user_id).first()
        result.append(FeedbackOut(
            id=fb.id,
            course_id=fb.course_id,
            user_id=fb.user_id,
            user_name=user.full_name if user else "Unknown",
            rating=fb.rating,
            comment=fb.comment,
            created_at=fb.created_at,
        ))
    return result


def get_feedback_summaries(db: Session) -> dict:
    """Return {course_id: {avg_rating, count}} for all courses that have feedback."""
    rows = (
        db.query(
            CourseFeedback.course_id,
            func.avg(CourseFeedback.rating).label("avg_rating"),
            func.count(CourseFeedback.id).label("count"),
        )
        .group_by(CourseFeedback.course_id)
        .all()
    )
    return {
        str(r.course_id): {"avg_rating": round(float(r.avg_rating), 1), "count": r.count}
        for r in rows
    }
