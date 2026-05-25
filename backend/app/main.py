import os

from dotenv import load_dotenv

# Load .env BEFORE importing any submodules that capture env vars at import
# time (e.g. app.utils.rag reads gemini_api_key / Pinecone_api_key at module
# scope). Without this, those modules see None and silently fail.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from sqlmodel import SQLModel

from app.database import engine, SessionLocal
from app.models.university import University    # noqa: F401 – must be before User FK refs
from app.models.user import User                # noqa: F401
from app.models.category import Category        # noqa: F401
from app.models.courses import Course           # noqa: F401
from app.models.course_section import CourseSection  # noqa: F401
from app.models.course_material import CourseMaterial  # noqa: F401
from app.models.enrollment import Enrollment    # noqa: F401
from app.models.university_join_request import UniversityJoinRequest  # noqa: F401
from app.models.friendship import Friendship          # noqa: F401
from app.models.friend_message import FriendMessage   # noqa: F401
from app.models.notification import Notification      # noqa: F401
from app.models.generated_course import GeneratedCourse  # noqa: F401
from app.models.lesson_block import LessonBlock          # noqa: F401
from app.models.course_subsection import CourseSubsection  # noqa: F401
from app.models.announcement import Announcement            # noqa: F401
from app.models.course_progress import CourseProgress      # noqa: F401
from app.models.course_feedback import CourseFeedback      # noqa: F401
from app.models.qcm_attempt import QCMAttempt              # noqa: F401
from app.models.gamification import (                       # noqa: F401
    UserGamification, XPLog, Achievement, UserAchievement, Badge, UserBadge,
)
from app.models.discussion import (                         # noqa: F401
    DiscussionPost, DiscussionVote, DiscussionReport, DiscussionSummary,
)
from app.controller.category_controller import seed_categories
from app.controller.gamification.seed import seed_gamification
from app.routes.auth_routes import router as auth_router
from app.routes.course_routes import router as course_router
from app.routes.category_routes import router as category_router
from app.routes.admin_routes import router as admin_router
from app.routes.org_routes import router as org_router
from app.routes.ai_routes import router as ai_router
from app.routes.friend_routes import router as friend_router
from app.routes.notification_routes import router as notification_router
from app.routes.ws_routes import router as ws_router
from app.routes.course_generation_routes import router as course_gen_router
from app.routes.announcement_routes import router as announcement_router
from app.routes.payment_routes import router as payment_router
from app.routes.gamification_routes import router as gamification_router
from app.routes.discussion_routes import router as discussion_router
from app.routes.public_routes import router as public_router

app = FastAPI()

# Compress responses >1KB — drops JSON payloads by 70-90% on the wire.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Long-cache static uploads. Browsers and CDNs can hold them for a year;
# files have content-addressed names so cache invalidation isn't a concern.
class _CacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/uploads/"):
            response.headers.setdefault(
                "Cache-Control", "public, max-age=31536000, immutable"
            )
        return response


app.add_middleware(_CacheStaticMiddleware)

# Serve uploaded files
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def on_startup():
    # Sanity-check RAG config so misconfigured envs surface in the boot log
    # instead of failing silently inside a daemon thread.
    gem = os.getenv("gemini_api_key")
    pc = os.getenv("Pinecone_api_key")
    print(
        f"[BOOT] RAG config: gemini_api_key={'SET' if gem else 'MISSING'}, "
        f"Pinecone_api_key={'SET' if pc else 'MISSING'}, "
        f"PINECONE_INDEX={os.getenv('PINECONE_INDEX', 'hub4learners')}"
    )
    if not (gem and pc):
        print("[BOOT] ⚠ RAG indexing/search will NOT work until both keys are set in backend/.env")

    sk = os.getenv("Stripe_secret_key")
    pk = os.getenv("Stripe_publishable_key")
    print(
        f"[BOOT] Stripe config: secret={'SET' if sk else 'MISSING'}, "
        f"publishable={'SET' if pk else 'MISSING'}"
    )
    if not (sk and pk):
        print("[BOOT] ⚠ Paid course checkout will NOT work until both Stripe keys are set in backend/.env")

    SQLModel.metadata.create_all(engine)

    import sqlalchemy as sa

    with engine.connect() as conn:
        migrations = [
            # ── Legacy columns (pre-hierarchy) ──────────────────────────────
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_summary TEXT",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMP",
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
            # ── Region removal: drop the region_id FKs and the regions table ─
            "ALTER TABLE users DROP COLUMN IF EXISTS region_id CASCADE",
            "ALTER TABLE universities DROP COLUMN IF EXISTS region_id CASCADE",
            "DROP TABLE IF EXISTS regions CASCADE",
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
            # ── is_verified column kept (always defaults true; no admin gate)
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
            # ── Demote any leftover regional_admin rows to university_admin ───
            "UPDATE users SET role = 'university_admin' WHERE role = 'regional_admin'",
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
            # ── Lesson blocks (block-based lesson builder) ────────────────────
            """
            CREATE TABLE IF NOT EXISTS lesson_blocks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE,
                block_type VARCHAR(20) NOT NULL,
                content TEXT,
                file_url TEXT,
                caption VARCHAR(500),
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_lesson_blocks_section ON lesson_blocks(section_id)",
            # ── Subsections (Section → Subsection → Blocks hierarchy) ─────────
            """
            CREATE TABLE IF NOT EXISTS course_subsections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_course_subsections_section ON course_subsections(section_id)",
            # Add subsection_id to lesson_blocks for new hierarchy
            "ALTER TABLE lesson_blocks ADD COLUMN IF NOT EXISTS subsection_id UUID REFERENCES course_subsections(id) ON DELETE CASCADE",
            "CREATE INDEX IF NOT EXISTS ix_lesson_blocks_subsection ON lesson_blocks(subsection_id)",
            # Make section_id nullable on lesson_blocks (new blocks use subsection_id)
            "ALTER TABLE lesson_blocks ALTER COLUMN section_id DROP NOT NULL",
            # ── Announcements ─────────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
                created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_announcements_university ON announcements(university_id)",
            # ── Course progress tracking ───────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS course_progress (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                subsection_id UUID REFERENCES course_subsections(id) ON DELETE CASCADE,
                material_id UUID REFERENCES course_materials(id) ON DELETE CASCADE,
                completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_course_progress_student ON course_progress(student_id)",
            "CREATE INDEX IF NOT EXISTS ix_course_progress_course ON course_progress(course_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_subsection ON course_progress(student_id, subsection_id) WHERE subsection_id IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_material ON course_progress(student_id, material_id) WHERE material_id IS NOT NULL",
            # ── Course feedback ───────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS course_feedback (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (course_id, user_id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_course_feedback_course ON course_feedback(course_id)",
            # ── QCM attempts ──────────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS qcm_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL,
                difficulty VARCHAR(16) NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                passed BOOLEAN NOT NULL DEFAULT FALSE,
                questions_json TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_qcm_attempts_student ON qcm_attempts(student_id)",
            "CREATE INDEX IF NOT EXISTS ix_qcm_attempts_course ON qcm_attempts(course_id)",
            "CREATE INDEX IF NOT EXISTS ix_qcm_attempts_section ON qcm_attempts(section_id)",
            # ── Gamification ──────────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS achievements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(64) NOT NULL UNIQUE,
                title VARCHAR(120) NOT NULL,
                description TEXT NOT NULL,
                icon VARCHAR(40) NOT NULL DEFAULT 'trophy',
                xp_reward INTEGER NOT NULL DEFAULT 0,
                category VARCHAR(40) NOT NULL DEFAULT 'general',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS badges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(64) NOT NULL UNIQUE,
                title VARCHAR(120) NOT NULL,
                description TEXT NOT NULL,
                icon VARCHAR(40) NOT NULL DEFAULT 'shield',
                rarity VARCHAR(20) NOT NULL DEFAULT 'common',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS user_gamification (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                total_xp INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1,
                current_streak INTEGER NOT NULL DEFAULT 0,
                longest_streak INTEGER NOT NULL DEFAULT 0,
                last_activity_date DATE,
                streak_freeze_used_on DATE,
                equipped_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS xp_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                source_type VARCHAR(40) NOT NULL,
                source_id VARCHAR(64),
                description VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_xp_logs_user ON xp_logs(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_xp_logs_source_type ON xp_logs(source_type)",
            "CREATE INDEX IF NOT EXISTS ix_xp_logs_source_id ON xp_logs(source_id)",
            "CREATE INDEX IF NOT EXISTS ix_xp_logs_created ON xp_logs(created_at)",
            """
            CREATE TABLE IF NOT EXISTS user_achievements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
                unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                seen BOOLEAN NOT NULL DEFAULT FALSE,
                CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_user_achievements_user ON user_achievements(user_id)",
            """
            CREATE TABLE IF NOT EXISTS user_badges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
                unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_user_badges_user ON user_badges(user_id)",
            # ── Lesson discussions ────────────────────────────────────────────
            """
            CREATE TABLE IF NOT EXISTS discussion_posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                subsection_id UUID NOT NULL REFERENCES course_subsections(id) ON DELETE CASCADE,
                author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_post_id UUID REFERENCES discussion_posts(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                edited_at TIMESTAMP,
                upvote_count INTEGER NOT NULL DEFAULT 0,
                reply_count INTEGER NOT NULL DEFAULT 0,
                report_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_subsection ON discussion_posts(subsection_id)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_parent ON discussion_posts(parent_post_id)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_author ON discussion_posts(author_id)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_course ON discussion_posts(course_id)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_sub_top ON discussion_posts(subsection_id, parent_post_id)",
            """
            CREATE TABLE IF NOT EXISTS discussion_votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id UUID NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_discussion_vote UNIQUE (post_id, user_id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_discussion_votes_post ON discussion_votes(post_id)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_votes_user ON discussion_votes(user_id)",
            """
            CREATE TABLE IF NOT EXISTS discussion_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id UUID NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
                reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reason VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_discussion_report UNIQUE (post_id, reporter_id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_discussion_reports_post ON discussion_reports(post_id)",
            """
            CREATE TABLE IF NOT EXISTS discussion_summaries (
                subsection_id UUID PRIMARY KEY REFERENCES course_subsections(id) ON DELETE CASCADE,
                summary_md TEXT NOT NULL,
                post_count_at_gen INTEGER NOT NULL DEFAULT 0,
                generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            # ── Performance indexes (idempotent) ──────────────────────────────
            # Hot-path filters that previously triggered full scans on Neon.
            "CREATE INDEX IF NOT EXISTS ix_enrollments_status ON enrollments(status)",
            "CREATE INDEX IF NOT EXISTS ix_enrollments_student_status ON enrollments(student_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_enrollments_course_status ON enrollments(course_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_is_deleted ON discussion_posts(subsection_id, is_deleted)",
            "CREATE INDEX IF NOT EXISTS ix_discussion_posts_author_created ON discussion_posts(author_id, created_at)",
            "CREATE INDEX IF NOT EXISTS ix_course_progress_student_course ON course_progress(student_id, course_id)",
            "CREATE INDEX IF NOT EXISTS ix_qcm_attempts_student_course ON qcm_attempts(student_id, course_id)",
            "CREATE INDEX IF NOT EXISTS ix_courses_published ON courses(is_published)",
            "CREATE INDEX IF NOT EXISTS ix_courses_professor ON courses(professor_id)",
            "CREATE INDEX IF NOT EXISTS ix_course_feedback_user ON course_feedback(user_id)",
        ]
        for sql in migrations:
            conn.execute(sa.text(sql))
        conn.commit()

    db = SessionLocal()
    try:
        seed_categories(db)
        seed_gamification(db)
    finally:
        db.close()


# Register routers
app.include_router(auth_router,     prefix="/api")
app.include_router(course_router,   prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(admin_router,    prefix="/api")
app.include_router(org_router,               prefix="/api")
app.include_router(ai_router,                prefix="/api")
app.include_router(friend_router,            prefix="/api")
app.include_router(notification_router,      prefix="/api")
app.include_router(course_gen_router,        prefix="/api")
app.include_router(announcement_router,      prefix="/api")
app.include_router(payment_router,           prefix="/api")
app.include_router(gamification_router,      prefix="/api")
app.include_router(discussion_router,        prefix="/api")
app.include_router(public_router,            prefix="/api")
app.include_router(ws_router)  # No /api prefix — WebSocket paths start with /ws


@app.get("/")
def root():
    return {"message": "API running"}
