from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.controller import discussion_controller
from app.database import get_db
from app.schemas.discussion import (
    DiscussionListOut, DiscussionPostCreate, DiscussionPostOut,
    DiscussionPostUpdate, DiscussionReportCreate, DiscussionSummaryOut,
    DiscussionVoteOut,
)
from app.utils.pro import is_pro_user_id
from app.utils.security import get_current_user

router = APIRouter(prefix="/discussions", tags=["Discussions"])


@router.get("/subsections/{subsection_id}", response_model=DiscussionListOut)
def list_discussion_posts(
    subsection_id: UUID,
    sort: str = Query("relevant", pattern="^(relevant|top|new|old)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return discussion_controller.list_posts(
        subsection_id=subsection_id,
        db=db,
        current_user_id=UUID(current_user["sub"]),
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.post("/subsections/{subsection_id}", response_model=DiscussionPostOut, status_code=201)
async def create_discussion_post(
    subsection_id: UUID,
    payload: DiscussionPostCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await discussion_controller.create_post(
        subsection_id=subsection_id,
        user_id=UUID(current_user["sub"]),
        content=payload.content,
        db=db,
    )


@router.post("/{post_id}/replies", response_model=DiscussionPostOut, status_code=201)
async def reply_to_post(
    post_id: UUID,
    payload: DiscussionPostCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Resolve subsection from the parent post itself so a reply can't be misrouted.
    from app.models.discussion import DiscussionPost
    parent = db.query(DiscussionPost).filter(DiscussionPost.id == post_id).first()
    if not parent:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Post not found.")

    return await discussion_controller.create_post(
        subsection_id=parent.subsection_id,
        user_id=UUID(current_user["sub"]),
        content=payload.content,
        db=db,
        parent_post_id=post_id,
    )


@router.patch("/{post_id}", response_model=DiscussionPostOut)
def edit_discussion_post(
    post_id: UUID,
    payload: DiscussionPostUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return discussion_controller.update_post(
        post_id=post_id,
        user_id=UUID(current_user["sub"]),
        new_content=payload.content,
        db=db,
    )


@router.delete("/{post_id}", status_code=204)
def delete_discussion_post(
    post_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    discussion_controller.delete_post(
        post_id=post_id,
        user_id=UUID(current_user["sub"]),
        user_role=current_user.get("role", ""),
        db=db,
    )


@router.post("/{post_id}/vote", response_model=DiscussionVoteOut)
def toggle_post_vote(
    post_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return discussion_controller.toggle_vote(
        post_id=post_id,
        user_id=UUID(current_user["sub"]),
        db=db,
    )


@router.post("/{post_id}/report")
def report_discussion_post(
    post_id: UUID,
    payload: DiscussionReportCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return discussion_controller.report_post(
        post_id=post_id,
        user_id=UUID(current_user["sub"]),
        reason=payload.reason,
        db=db,
    )


@router.get("/subsections/{subsection_id}/summary", response_model=DiscussionSummaryOut)
def get_discussion_summary(
    subsection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_pro = is_pro_user_id(current_user["sub"], db)
    return discussion_controller.get_summary(subsection_id=subsection_id, db=db, is_pro=is_pro)


@router.post("/subsections/{subsection_id}/summary/regenerate", response_model=DiscussionSummaryOut)
def regenerate_discussion_summary(
    subsection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_pro = is_pro_user_id(current_user["sub"], db)
    return discussion_controller.regenerate_summary(subsection_id=subsection_id, db=db, is_pro=is_pro)
