import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from app.database import engine, SessionLocal
from app.models.region import Region            # noqa: F401 – must be before University
from app.models.university import University    # noqa: F401 – must be before User FK refs
from app.models.user import User                # noqa: F401
from app.models.category import Category        # noqa: F401
from app.models.courses import Course           # noqa: F401
from app.models.course_section import CourseSection  # noqa: F401
from app.models.course_material import CourseMaterial  # noqa: F401
from app.models.enrollment import Enrollment    # noqa: F401
from app.models.chat_request import ChatRequest  # noqa: F401
from app.models.message import Message          # noqa: F401
from app.models.university_join_request import UniversityJoinRequest  # noqa: F401
from app.models.professor_verification import ProfessorVerificationRequest  # noqa: F401
from app.controller.category_controller import seed_categories
from app.routes.auth_routes import router as auth_router
from app.routes.course_routes import router as course_router
from app.routes.category_routes import router as category_router
from app.routes.admin_routes import router as admin_router
from app.routes.chat_routes import router as chat_router
from app.routes.org_routes import router as org_router
from app.routes.prof_verification_routes import router as prof_verification_router
from app.routes.ai_routes import router as ai_router

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


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

    import sqlalchemy as sa

    with engine.connect() as conn:
        migrations = [
            # ── pgvector extension (must be first) ───────────────────────────
            "CREATE EXTENSION IF NOT EXISTS vector",
            # ── RAG: material chunks table ───────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS material_chunks (
                id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
                material_id     UUID    NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
                course_id       UUID    NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                section_title   VARCHAR(500),
                material_title  VARCHAR(500),
                chunk_index     INTEGER NOT NULL DEFAULT 0,
                content         TEXT    NOT NULL,
                embedding       vector(768)
            )
            """,
            "CREATE INDEX IF NOT EXISTS material_chunks_course_idx ON material_chunks (course_id)",
            # ── Legacy columns (pre-hierarchy) ──────────────────────────────
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_refuse_chat BOOLEAN NOT NULL DEFAULT FALSE",
            # ── If the role column is a PG enum, convert it to plain VARCHAR
            # so new role strings are accepted without altering the enum type.
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users'
                  AND column_name = 'role'
                  AND udt_name    = 'user_role'
              ) THEN
                ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::text;
              END IF;
            END $$;
            """,
            # ── Hierarchy columns ────────────────────────────────────────────
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE SET NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL",
# ── Data migration: admin → super_admin (idempotent) ─────────────
            "UPDATE users SET role = 'super_admin' WHERE role = 'admin'",
            # ── University join requests table ────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS university_join_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                note TEXT,
                reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            # ── Professor verification column + table ─────────────────────────
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE",
            """
            CREATE TABLE IF NOT EXISTS professor_verification_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
                birth_date DATE NOT NULL,
                first_name VARCHAR(255) NOT NULL,
                father_name VARCHAR(255) NOT NULL,
                grandfather_name VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                note TEXT,
                reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
        ]
        for sql in migrations:
            conn.execute(sa.text(sql))
        conn.commit()

    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()


# Register routers
app.include_router(auth_router,     prefix="/api")
app.include_router(course_router,   prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(admin_router,    prefix="/api")
app.include_router(chat_router,     prefix="/api")
app.include_router(org_router,               prefix="/api")
app.include_router(prof_verification_router, prefix="/api")
app.include_router(ai_router,                prefix="/api")


@app.get("/")
def root():
    return {"message": "API running"}
