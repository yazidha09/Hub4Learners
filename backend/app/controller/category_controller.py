from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.courses import Course
from app.schemas.category import CategoryOut

DEFAULT_CATEGORIES = [
    {"name": "Science", "description": "Physics, Chemistry, Biology and Natural Sciences", "icon": "🔬", "order_index": 0},
    {"name": "Mathematics", "description": "Algebra, Calculus, Statistics and Applied Mathematics", "icon": "📐", "order_index": 1},
    {"name": "Technology", "description": "Programming, Software Development and IT", "icon": "💻", "order_index": 2},
    {"name": "Engineering", "description": "Civil, Mechanical, Electrical and other Engineering fields", "icon": "⚙️", "order_index": 3},
    {"name": "Languages", "description": "English, French, Arabic, Spanish and Linguistics", "icon": "🌍", "order_index": 4},
    {"name": "Business", "description": "Management, Marketing, Finance and Entrepreneurship", "icon": "📊", "order_index": 5},
    {"name": "Arts & Design", "description": "Visual Arts, Graphic Design, Music and Creative Fields", "icon": "🎨", "order_index": 6},
    {"name": "Health & Medicine", "description": "Medical Sciences, Nursing, Pharmacy and Public Health", "icon": "🏥", "order_index": 7},
    {"name": "Social Sciences", "description": "Psychology, Sociology, History and Political Science", "icon": "📖", "order_index": 8},
    {"name": "Other", "description": "Courses that don't fit into the above categories", "icon": "📚", "order_index": 9},
]


def seed_categories(db: Session) -> None:
    existing = db.query(Category).count()
    if existing > 0:
        return
    for cat_data in DEFAULT_CATEGORIES:
        db.add(Category(**cat_data))
    db.commit()


def _build_category_out(cat: Category, db: Session) -> CategoryOut:
    course_count = (
        db.query(Course)
        .filter(Course.category_id == cat.id, Course.is_published == True)  # noqa: E712
        .count()
    )
    return CategoryOut(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        icon=cat.icon,
        order_index=cat.order_index,
        course_count=course_count,
        created_at=cat.created_at,
    )


def list_categories(db: Session) -> List[CategoryOut]:
    categories = db.query(Category).order_by(Category.order_index).all()
    return [_build_category_out(c, db) for c in categories]


def get_category(category_id: str, db: Session) -> CategoryOut:
    cat = db.query(Category).filter(Category.id == UUID(category_id)).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return _build_category_out(cat, db)


# ── Admin CRUD ────────────────────────────────────────────────────────────────

def create_category(
    name: str,
    description: Optional[str],
    icon: str,
    db: Session,
) -> CategoryOut:
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category name already exists")

    max_order = db.query(Category).count()
    cat = Category(name=name, description=description, icon=icon, order_index=max_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _build_category_out(cat, db)


def update_category(
    category_id: str,
    name: Optional[str],
    description: Optional[str],
    icon: Optional[str],
    db: Session,
) -> CategoryOut:
    cat = db.query(Category).filter(Category.id == UUID(category_id)).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if name and name != cat.name:
        dup = db.query(Category).filter(Category.name == name).first()
        if dup:
            raise HTTPException(status_code=409, detail="Category name already exists")
        cat.name = name
    if description is not None:
        cat.description = description
    if icon:
        cat.icon = icon

    db.commit()
    db.refresh(cat)
    return _build_category_out(cat, db)


def delete_category(category_id: str, db: Session) -> dict:
    cat = db.query(Category).filter(Category.id == UUID(category_id)).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # un-assign courses from this category
    db.query(Course).filter(Course.category_id == cat.id).update(
        {Course.category_id: None}, synchronize_session="fetch"
    )
    db.delete(cat)
    db.commit()
    return {"detail": "Category deleted"}
