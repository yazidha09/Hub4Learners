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
from app.models.friendship import Friendship          # noqa: F401
from app.models.friend_message import FriendMessage   # noqa: F401
from app.models.notification import Notification      # noqa: F401
from app.models.generated_course import GeneratedCourse  # noqa: F401
from app.controller.category_controller import seed_categories
from app.routes.auth_routes import router as auth_router
from app.routes.course_routes import router as course_router
from app.routes.category_routes import router as category_router
from app.routes.admin_routes import router as admin_router
from app.routes.chat_routes import router as chat_router
from app.routes.org_routes import router as org_router
from app.routes.prof_verification_routes import router as prof_verification_router
from app.routes.ai_routes import router as ai_router
from app.routes.friend_routes import router as friend_router
from app.routes.notification_routes import router as notification_router
from app.routes.ws_routes import router as ws_router
from app.routes.course_generation_routes import router as course_gen_router

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
            # ── Friendships + friend messages ─────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS friendships (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                requestee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_friendships_requester ON friendships(requester_id)",
            "CREATE INDEX IF NOT EXISTS ix_friendships_requestee ON friendships(requestee_id)",
            "CREATE INDEX IF NOT EXISTS ix_friendships_status ON friendships(status)",
            """
            CREATE TABLE IF NOT EXISTS friend_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                friendship_id UUID NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
                sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                media_url TEXT,
                media_type VARCHAR(20),
                media_name VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_friend_messages_friendship ON friend_messages(friendship_id)",
            "CREATE INDEX IF NOT EXISTS ix_friend_messages_sender ON friend_messages(sender_id)",
            # ── Notifications ─────────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                meta JSONB,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_read ON notifications(user_id, is_read)",
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
            # ── Convert material_type enum → VARCHAR so 'lesson' type is accepted
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'course_materials'
                  AND column_name = 'type'
                  AND udt_name    = 'material_type'
              ) THEN
                ALTER TABLE course_materials
                  ALTER COLUMN type TYPE VARCHAR(20) USING type::text;
              END IF;
            END $$;
            """,
            # ── AI course generation jobs ──────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS generated_courses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                pdf_filename VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'processing',
                difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate',
                result JSONB,
                error TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_generated_courses_user_id ON generated_courses(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_generated_courses_status ON generated_courses(status)",
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
app.include_router(friend_router,            prefix="/api")
app.include_router(notification_router,      prefix="/api")
app.include_router(course_gen_router,        prefix="/api")
app.include_router(ws_router)  # No /api prefix — WebSocket paths start with /ws


@app.get("/")
def root():
    return {"message": "API running"}
