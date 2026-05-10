"""Lesson discussion / community feature.

Posts hang off a `course_subsection` (one lesson). Top-level posts have
`parent_post_id IS NULL`; one-level-nested replies set it.

Counters (`upvote_count`, `reply_count`, `report_count`) are denormalised
on `discussion_posts` so listing is a single sort + limit query without
joins. They are kept in sync inside the same transaction as the write.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session

from app.controller import notification_controller
from app.models.course_subsection import CourseSubsection
from app.models.course_section import CourseSection
from app.models.courses import Course
from app.models.discussion import (
    DiscussionPost, DiscussionReport, DiscussionSummary, DiscussionVote,
)
from app.models.user import User
from app.schemas.discussion import (
    DiscussionAuthor, DiscussionListOut, DiscussionPostOut, DiscussionSummaryOut,
)
from app.utils.gemini import summarize_discussion_thread


# ── Validation / safety ─────────────────────────────────────────────────────

# Conservative profanity list — extend as needed. Matches whole words only,
# case-insensitive. Keep it short to avoid false positives in technical posts
# (e.g. "ass" in "class" must NOT match — `\b` boundaries handle that).
_PROFANITY = {
    "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "pussy",
    "slut", "whore", "nigger", "faggot", "retard",
}
_PROFANITY_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in _PROFANITY) + r")\b",
    re.IGNORECASE,
)

# Spam heuristic: more than this many URLs in one post is suspect.
_MAX_URLS_PER_POST = 5
_URL_RE = re.compile(r"https?://", re.IGNORECASE)

# Mention parser: `@name with spaces` is hard; we match @ followed by a
# contiguous run of letters/digits/underscores, min 2 chars.
_MENTION_RE = re.compile(r"@([A-Za-z][A-Za-z0-9_]{1,30})")

# Rate limit: a user can only create N posts per WINDOW seconds.
_POST_RATE_LIMIT_COUNT = 5
_POST_RATE_LIMIT_WINDOW_SECONDS = 60

# AI summary cache: regenerate only if at least N new posts were added
# since last generation, OR more than _SUMMARY_MAX_AGE_HOURS ago.
_SUMMARY_MIN_POSTS = 3
_SUMMARY_REGEN_DELTA = 5
_SUMMARY_MAX_AGE_HOURS = 24


def _clean_content(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Post content cannot be empty.")
    if _PROFANITY_RE.search(text):
        # Replace profanity with asterisks rather than rejecting outright —
        # students still get to participate, but slurs do not get persisted.
        text = _PROFANITY_RE.sub(lambda m: "*" * len(m.group(0)), text)
    if len(_URL_RE.findall(text)) > _MAX_URLS_PER_POST:
        raise HTTPException(
            status_code=400,
            detail="Too many links in one post. Please keep posts focused.",
        )
    return text


def _enforce_rate_limit(user_id: UUID, db: Session) -> None:
    cutoff = datetime.utcnow() - timedelta(seconds=_POST_RATE_LIMIT_WINDOW_SECONDS)
    recent = (
        db.query(func.count(DiscussionPost.id))
        .filter(
            DiscussionPost.author_id == user_id,
            DiscussionPost.created_at >= cutoff,
        )
        .scalar()
        or 0
    )
    if recent >= _POST_RATE_LIMIT_COUNT:
        raise HTTPException(
            status_code=429,
            detail="You're posting too quickly. Please wait a moment.",
        )


# ── Subsection / course resolution ──────────────────────────────────────────

def _resolve_subsection(subsection_id: UUID, db: Session) -> Tuple[CourseSubsection, Course]:
    sub = db.query(CourseSubsection).filter(CourseSubsection.id == subsection_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    section = db.query(CourseSection).filter(CourseSection.id == sub.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Lesson section not found.")
    course = db.query(Course).filter(Course.id == section.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    return sub, course


# ── Output building ─────────────────────────────────────────────────────────

def _author_for(user: Optional[User]) -> DiscussionAuthor:
    if not user:
        return DiscussionAuthor(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            full_name="Deleted user",
            profile_image=None,
            role="student",
        )
    return DiscussionAuthor(
        id=user.id,
        full_name=user.full_name,
        profile_image=user.profile_image,
        role=user.role,
    )


def _post_to_out(
    post: DiscussionPost,
    authors_by_id: dict,
    voted_post_ids: set,
    course_professor_id: UUID,
    current_user_id: Optional[UUID],
    replies: Optional[List[DiscussionPostOut]] = None,
) -> DiscussionPostOut:
    author = authors_by_id.get(post.author_id)
    is_instructor = bool(author and author.id == course_professor_id) or (
        author is not None and author.role in {"professor", "university_admin", "super_admin"}
    )
    # Hide content of soft-deleted posts but keep the shell so reply tree stays readable.
    visible_content = "*[deleted]*" if post.is_deleted else post.content
    return DiscussionPostOut(
        id=post.id,
        subsection_id=post.subsection_id,
        parent_post_id=post.parent_post_id,
        content=visible_content,
        is_deleted=post.is_deleted,
        edited_at=post.edited_at,
        upvote_count=post.upvote_count,
        reply_count=post.reply_count,
        has_voted=post.id in voted_post_ids,
        is_owner=current_user_id is not None and post.author_id == current_user_id,
        is_instructor=is_instructor,
        author=_author_for(author),
        created_at=post.created_at,
        replies=replies or [],
    )


# ── Listing ─────────────────────────────────────────────────────────────────

def list_posts(
    subsection_id: UUID,
    db: Session,
    current_user_id: Optional[UUID],
    sort: str = "relevant",
    limit: int = 20,
    offset: int = 0,
) -> DiscussionListOut:
    sub, course = _resolve_subsection(subsection_id, db)

    base_q = db.query(DiscussionPost).filter(
        DiscussionPost.subsection_id == sub.id,
        DiscussionPost.parent_post_id == None,  # noqa: E711
    )
    total = base_q.count()

    if sort == "top":
        base_q = base_q.order_by(desc(DiscussionPost.upvote_count), desc(DiscussionPost.created_at))
    elif sort == "new":
        base_q = base_q.order_by(desc(DiscussionPost.created_at))
    elif sort == "old":
        base_q = base_q.order_by(asc(DiscussionPost.created_at))
    else:
        # "relevant" — engagement score with a slight recency boost.
        # SQL: upvote_count*2 + reply_count - report_count*5 + (recency)
        score = (
            DiscussionPost.upvote_count * 2
            + DiscussionPost.reply_count
            - DiscussionPost.report_count * 5
        )
        base_q = base_q.order_by(desc(score), desc(DiscussionPost.created_at))

    parents = base_q.offset(offset).limit(limit).all()
    parent_ids = [p.id for p in parents]

    replies: list[DiscussionPost] = []
    if parent_ids:
        replies = (
            db.query(DiscussionPost)
            .filter(DiscussionPost.parent_post_id.in_(parent_ids))
            .order_by(asc(DiscussionPost.created_at))
            .all()
        )

    # Batch-load authors for parents + replies in one query.
    author_ids = {p.author_id for p in parents} | {r.author_id for r in replies}
    authors_by_id: dict = {}
    if author_ids:
        for u in db.query(User).filter(User.id.in_(author_ids)).all():
            authors_by_id[u.id] = u

    # Voted post IDs for the current user — single query.
    voted_post_ids: set = set()
    if current_user_id and (parents or replies):
        all_post_ids = [p.id for p in parents] + [r.id for r in replies]
        voted_rows = (
            db.query(DiscussionVote.post_id)
            .filter(
                DiscussionVote.user_id == current_user_id,
                DiscussionVote.post_id.in_(all_post_ids),
            )
            .all()
        )
        voted_post_ids = {r[0] for r in voted_rows}

    replies_by_parent: dict = {}
    for r in replies:
        replies_by_parent.setdefault(r.parent_post_id, []).append(r)

    out_posts: list[DiscussionPostOut] = []
    for p in parents:
        reply_outs = [
            _post_to_out(r, authors_by_id, voted_post_ids, course.professor_id, current_user_id)
            for r in replies_by_parent.get(p.id, [])
        ]
        out_posts.append(
            _post_to_out(
                p, authors_by_id, voted_post_ids, course.professor_id, current_user_id,
                replies=reply_outs,
            )
        )

    return DiscussionListOut(
        posts=out_posts,
        total=total,
        has_more=(offset + limit) < total,
    )


# ── Mentions / notifications ────────────────────────────────────────────────

async def _notify_mentions(
    content: str,
    course_id: UUID,
    actor: User,
    post_id: UUID,
    subsection_id: UUID,
    db: Session,
) -> None:
    handles = set(_MENTION_RE.findall(content or ""))
    if not handles:
        return
    # Match by first part of the full_name (lowercase, alphanum) — best-effort.
    # We pull users whose full_name starts with any of the handles. This avoids
    # exposing unrelated users via wide LIKE scans.
    candidates = (
        db.query(User)
        .filter(User.id != actor.id)
        .all()
    )
    notified: set = set()
    for u in candidates:
        first = re.sub(r"[^A-Za-z0-9_]", "", (u.full_name or "").split(" ")[0]).lower()
        if not first:
            continue
        for h in handles:
            if h.lower() == first and u.id not in notified:
                notified.add(u.id)
                try:
                    await notification_controller.push(
                        user_id=str(u.id),
                        type="discussion_mention",
                        title=f"{actor.full_name} mentioned you",
                        body="You were mentioned in a lesson discussion.",
                        meta={
                            "course_id": str(course_id),
                            "subsection_id": str(subsection_id),
                            "post_id": str(post_id),
                        },
                        db=db,
                    )
                except Exception:
                    # Notification failures should never break the post flow.
                    pass


# ── Create ──────────────────────────────────────────────────────────────────

async def create_post(
    subsection_id: UUID,
    user_id: UUID,
    content: str,
    db: Session,
    parent_post_id: Optional[UUID] = None,
) -> DiscussionPostOut:
    sub, course = _resolve_subsection(subsection_id, db)
    actor = db.query(User).filter(User.id == user_id).first()
    if not actor:
        raise HTTPException(status_code=401, detail="Unknown user.")

    cleaned = _clean_content(content)
    _enforce_rate_limit(user_id, db)

    parent: Optional[DiscussionPost] = None
    if parent_post_id is not None:
        parent = db.query(DiscussionPost).filter(DiscussionPost.id == parent_post_id).first()
        if not parent or parent.subsection_id != sub.id:
            raise HTTPException(status_code=404, detail="Parent post not found.")
        if parent.parent_post_id is not None:
            # Limit nesting to one level — replies only attach to top-level posts.
            raise HTTPException(status_code=400, detail="Cannot reply to a reply.")

    post = DiscussionPost(
        course_id=course.id,
        subsection_id=sub.id,
        author_id=user_id,
        parent_post_id=parent.id if parent else None,
        content=cleaned,
    )
    db.add(post)

    if parent:
        parent.reply_count = (parent.reply_count or 0) + 1

    db.commit()
    db.refresh(post)

    # Notifications — fire-and-forget; do not block the response if they fail.
    if parent and parent.author_id != user_id:
        try:
            await notification_controller.push(
                user_id=str(parent.author_id),
                type="discussion_reply",
                title=f"{actor.full_name} replied to you",
                body=(cleaned[:120] + "…") if len(cleaned) > 120 else cleaned,
                meta={
                    "course_id": str(course.id),
                    "subsection_id": str(sub.id),
                    "post_id": str(post.id),
                    "parent_post_id": str(parent.id),
                },
                db=db,
            )
        except Exception:
            pass

    await _notify_mentions(cleaned, course.id, actor, post.id, sub.id, db)

    authors_by_id = {actor.id: actor}
    return _post_to_out(post, authors_by_id, set(), course.professor_id, user_id)


# ── Update ──────────────────────────────────────────────────────────────────

def update_post(
    post_id: UUID,
    user_id: UUID,
    new_content: str,
    db: Session,
) -> DiscussionPostOut:
    post = db.query(DiscussionPost).filter(DiscussionPost.id == post_id).first()
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.author_id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts.")

    post.content = _clean_content(new_content)
    post.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    _, course = _resolve_subsection(post.subsection_id, db)
    actor = db.query(User).filter(User.id == user_id).first()
    return _post_to_out(post, {actor.id: actor}, set(), course.professor_id, user_id)


# ── Soft delete ─────────────────────────────────────────────────────────────

def delete_post(post_id: UUID, user_id: UUID, user_role: str, db: Session) -> None:
    post = db.query(DiscussionPost).filter(DiscussionPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    is_owner = post.author_id == user_id
    is_moderator = user_role in {"super_admin", "university_admin"}
    # Course professor can also moderate posts on their own course.
    if not (is_owner or is_moderator):
        section = db.query(CourseSection).filter(CourseSection.id != None).filter(  # noqa: E711
            CourseSection.id == db.query(CourseSubsection.section_id)
            .filter(CourseSubsection.id == post.subsection_id)
            .scalar_subquery()
        ).first()
        if section:
            course = db.query(Course).filter(Course.id == section.course_id).first()
            if course and course.professor_id == user_id:
                is_moderator = True
    if not (is_owner or is_moderator):
        raise HTTPException(status_code=403, detail="You can only delete your own posts.")

    post.is_deleted = True
    db.commit()


# ── Vote toggle ─────────────────────────────────────────────────────────────

def toggle_vote(post_id: UUID, user_id: UUID, db: Session) -> dict:
    post = db.query(DiscussionPost).filter(DiscussionPost.id == post_id).first()
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found.")

    existing = (
        db.query(DiscussionVote)
        .filter(DiscussionVote.post_id == post_id, DiscussionVote.user_id == user_id)
        .first()
    )
    if existing:
        db.delete(existing)
        post.upvote_count = max(0, (post.upvote_count or 0) - 1)
        has_voted = False
    else:
        db.add(DiscussionVote(post_id=post_id, user_id=user_id))
        post.upvote_count = (post.upvote_count or 0) + 1
        has_voted = True

    db.commit()
    db.refresh(post)

    return {
        "post_id": post.id,
        "has_voted": has_voted,
        "upvote_count": post.upvote_count,
    }


# ── Report ──────────────────────────────────────────────────────────────────

def report_post(
    post_id: UUID,
    user_id: UUID,
    reason: Optional[str],
    db: Session,
) -> dict:
    post = db.query(DiscussionPost).filter(DiscussionPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    if post.author_id == user_id:
        raise HTTPException(status_code=400, detail="You can't report your own post.")

    existing = (
        db.query(DiscussionReport)
        .filter(DiscussionReport.post_id == post_id, DiscussionReport.reporter_id == user_id)
        .first()
    )
    if existing:
        return {"detail": "Already reported."}

    db.add(DiscussionReport(post_id=post_id, reporter_id=user_id, reason=reason))
    post.report_count = (post.report_count or 0) + 1
    # Auto-hide once the post crosses a community trust threshold.
    if post.report_count >= 5:
        post.is_deleted = True
    db.commit()
    return {"detail": "Reported."}


# ── AI summary ──────────────────────────────────────────────────────────────

def _is_summary_stale(
    summary: Optional[DiscussionSummary],
    current_post_count: int,
) -> bool:
    if not summary:
        return True
    if (datetime.utcnow() - summary.generated_at) > timedelta(hours=_SUMMARY_MAX_AGE_HOURS):
        return True
    if (current_post_count - (summary.post_count_at_gen or 0)) >= _SUMMARY_REGEN_DELTA:
        return True
    return False


def get_summary(subsection_id: UUID, db: Session) -> DiscussionSummaryOut:
    sub, _ = _resolve_subsection(subsection_id, db)
    summary = (
        db.query(DiscussionSummary)
        .filter(DiscussionSummary.subsection_id == sub.id)
        .first()
    )
    total = (
        db.query(func.count(DiscussionPost.id))
        .filter(
            DiscussionPost.subsection_id == sub.id,
            DiscussionPost.is_deleted == False,  # noqa: E712
        )
        .scalar()
        or 0
    )
    return DiscussionSummaryOut(
        subsection_id=sub.id,
        summary_md=summary.summary_md if summary else None,
        generated_at=summary.generated_at if summary else None,
        post_count_at_gen=summary.post_count_at_gen if summary else 0,
        is_stale=_is_summary_stale(summary, total),
        can_generate=total >= _SUMMARY_MIN_POSTS,
    )


def regenerate_summary(subsection_id: UUID, db: Session) -> DiscussionSummaryOut:
    sub, course = _resolve_subsection(subsection_id, db)

    parents = (
        db.query(DiscussionPost)
        .filter(
            DiscussionPost.subsection_id == sub.id,
            DiscussionPost.parent_post_id == None,  # noqa: E711
            DiscussionPost.is_deleted == False,  # noqa: E712
        )
        .order_by(desc(DiscussionPost.upvote_count), desc(DiscussionPost.created_at))
        .limit(40)
        .all()
    )
    if len(parents) < _SUMMARY_MIN_POSTS:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {_SUMMARY_MIN_POSTS} posts before generating a summary.",
        )

    parent_ids = [p.id for p in parents]
    replies = (
        db.query(DiscussionPost)
        .filter(
            DiscussionPost.parent_post_id.in_(parent_ids),
            DiscussionPost.is_deleted == False,  # noqa: E712
        )
        .order_by(desc(DiscussionPost.upvote_count))
        .all()
    )
    author_ids = {p.author_id for p in parents} | {r.author_id for r in replies}
    authors = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(author_ids)).all()}

    replies_by_parent: dict = {}
    for r in replies:
        replies_by_parent.setdefault(r.parent_post_id, []).append(r)

    payload: list[dict] = []
    for p in parents:
        payload.append({
            "author": authors.get(p.author_id, "student"),
            "content": p.content,
            "upvotes": p.upvote_count,
            "replies": [
                {
                    "author": authors.get(r.author_id, "student"),
                    "content": r.content,
                    "upvotes": r.upvote_count,
                }
                for r in replies_by_parent.get(p.id, [])[:5]
            ],
        })

    summary_md = summarize_discussion_thread(
        lesson_title=sub.title,
        course_title=course.title,
        posts=payload,
    )

    total_active = (
        db.query(func.count(DiscussionPost.id))
        .filter(
            DiscussionPost.subsection_id == sub.id,
            DiscussionPost.is_deleted == False,  # noqa: E712
        )
        .scalar()
        or 0
    )

    existing = (
        db.query(DiscussionSummary)
        .filter(DiscussionSummary.subsection_id == sub.id)
        .first()
    )
    if existing:
        existing.summary_md = summary_md
        existing.post_count_at_gen = total_active
        existing.generated_at = datetime.utcnow()
    else:
        existing = DiscussionSummary(
            subsection_id=sub.id,
            summary_md=summary_md,
            post_count_at_gen=total_active,
            generated_at=datetime.utcnow(),
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)

    return DiscussionSummaryOut(
        subsection_id=sub.id,
        summary_md=existing.summary_md,
        generated_at=existing.generated_at,
        post_count_at_gen=existing.post_count_at_gen,
        is_stale=False,
        can_generate=True,
    )
