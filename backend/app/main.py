import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from app.database import engine, SessionLocal
from app.models.user import User  # noqa: F401  – ensures the table is registered
from app.models.upgrade_request import UpgradeRequest  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.courses import Course  # noqa: F401
from app.models.course_section import CourseSection  # noqa: F401
from app.models.course_material import CourseMaterial  # noqa: F401
from app.models.enrollment import Enrollment  # noqa: F401
from app.models.chat_request import ChatRequest  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.controller.category_controller import seed_categories
from app.routes.auth_routes import router as auth_router
from app.routes.upgrade_routes import router as upgrade_router
from app.routes.course_routes import router as course_router
from app.routes.category_routes import router as category_router
from app.routes.admin_routes import router as admin_router
from app.routes.chat_routes import router as chat_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Create tables on startup and seed default categories
@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

    # Add columns that may be missing from tables created before these fields were added
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_refuse_chat BOOLEAN NOT NULL DEFAULT FALSE",
        ]
        for sql in migrations:
            conn.execute(__import__('sqlalchemy').text(sql))
        conn.commit()

    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()

# Register routers
app.include_router(auth_router, prefix="/api")
app.include_router(upgrade_router, prefix="/api")
app.include_router(course_router, prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "API running"}