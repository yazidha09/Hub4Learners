import os
import re
import traceback
from typing import List

import google.generativeai as genai
from pinecone import Pinecone, ServerlessSpec

GEMINI_KEY = os.getenv("gemini_api_key")
PINECONE_KEY = os.getenv("Pinecone_api_key")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "hub4learners")
EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768  # Gemini supports output_dimensionality to truncate from 3072

CHUNK_SIZE = 600
CHUNK_OVERLAP = 80
UPSERT_BATCH = 100   # Pinecone upsert batch
MIN_SCORE = 0.40     # cosine similarity threshold


# ── helpers ──────────────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    for ent, ch in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                    ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
        text = text.replace(ent, ch)
    return re.sub(r"\s+", " ", text).strip()


def _chunk(text: str) -> List[str]:
    chunks: List[str] = []
    start = 0
    while start < len(text):
        chunk = text[start : start + CHUNK_SIZE].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def _embed_one(text: str, task: str) -> List[float]:
    """Embed a single text — returns a 768-dim vector."""
    genai.configure(api_key=GEMINI_KEY)
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type=task,
        output_dimensionality=EMBED_DIM,
    )
    return result["embedding"]


def _embed_many(texts: List[str], task: str = "retrieval_document") -> List[List[float]]:
    """Embed many texts — one call per text (gemini-embedding-001 batches don't always work reliably)."""
    return [_embed_one(t, task) for t in texts]


def _index():
    """Get the Pinecone index, creating it if it doesn't exist yet."""
    pc = Pinecone(api_key=PINECONE_KEY)
    existing = [idx["name"] for idx in pc.list_indexes()]
    if PINECONE_INDEX not in existing:
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(PINECONE_INDEX).status["ready"]:
            pass
    return pc.Index(PINECONE_INDEX)


# ── public API ────────────────────────────────────────────────────────────────

def index_course(course_id: str, sections_data: List[dict]) -> int:
    """
    Chunk, embed, and upsert every text block of a course into Pinecone.

    sections_data items: {section_title, subsection_title, content_text}
    Returns the number of chunks stored.
    Raises on real errors (caller decides whether to swallow).
    """
    print(f"[RAG] Indexing course {course_id} — {len(sections_data)} content items received")

    if not GEMINI_KEY:
        raise RuntimeError("gemini_api_key is not set")
    if not PINECONE_KEY:
        raise RuntimeError("Pinecone_api_key is not set")

    idx = _index()

    # Best-effort delete of stale vectors for this course
    try:
        idx.delete(filter={"course_id": course_id})
        print(f"[RAG] Deleted existing vectors for course {course_id}")
    except Exception as e:
        print(f"[RAG] Delete-by-filter not supported or failed (continuing): {e}")

    chunks_meta: List[dict] = []
    for item in sections_data:
        raw = (item.get("content_text") or "").strip()
        if not raw:
            continue
        text = _strip_html(raw) if raw.startswith("<") else raw
        if not text:
            continue
        for chunk in _chunk(text):
            chunks_meta.append({
                "course_id": course_id,
                "section_title": item.get("section_title", ""),
                "subsection_title": item.get("subsection_title", ""),
                "text": chunk,
            })

    print(f"[RAG] Built {len(chunks_meta)} chunks")

    if not chunks_meta:
        print("[RAG] No chunks to index — course has no text content")
        return 0

    texts = [c["text"] for c in chunks_meta]
    print(f"[RAG] Embedding {len(texts)} chunks via {EMBED_MODEL}…")
    embeddings = _embed_many(texts, task="retrieval_document")
    print(f"[RAG] Embedded {len(embeddings)} chunks (dim={len(embeddings[0]) if embeddings else 0})")

    vectors = [
        {
            "id": f"{course_id}_{i:06d}",
            "values": emb,
            "metadata": meta,
        }
        for i, (meta, emb) in enumerate(zip(chunks_meta, embeddings))
    ]

    upserted = 0
    for i in range(0, len(vectors), UPSERT_BATCH):
        batch = vectors[i : i + UPSERT_BATCH]
        idx.upsert(vectors=batch)
        upserted += len(batch)

    print(f"[RAG] Upserted {upserted} vectors into Pinecone index '{PINECONE_INDEX}'")
    return upserted


def index_course_bg(course_id: str) -> None:
    """
    Background-safe wrapper: opens its own DB session, fetches every text
    LessonBlock, and indexes the course. Logs failures instead of raising.
    """
    from uuid import UUID
    from app.database import SessionLocal
    from app.models.course_section import CourseSection
    from app.models.course_subsection import CourseSubsection
    from app.models.lesson_block import LessonBlock

    print(f"[RAG-BG] Background indexing started for course {course_id}")
    db = SessionLocal()
    try:
        rows_new = (
            db.query(
                LessonBlock,
                CourseSubsection.title.label("ss_title"),
                CourseSection.title.label("s_title"),
            )
            .join(CourseSubsection, LessonBlock.subsection_id == CourseSubsection.id)
            .join(CourseSection, CourseSubsection.section_id == CourseSection.id)
            .filter(
                CourseSection.course_id == UUID(course_id),
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
            )
            .all()
        )

        rows_legacy = (
            db.query(LessonBlock, CourseSection.title.label("s_title"))
            .join(CourseSection, LessonBlock.section_id == CourseSection.id)
            .filter(
                CourseSection.course_id == UUID(course_id),
                LessonBlock.block_type == "text",
                LessonBlock.content.isnot(None),
                LessonBlock.subsection_id.is_(None),
            )
            .all()
        )

        print(f"[RAG-BG] Pulled {len(rows_new)} new-hierarchy + {len(rows_legacy)} legacy text blocks")

        sections_data: List[dict] = []
        for block, ss_title, s_title in rows_new:
            sections_data.append({
                "section_title": s_title,
                "subsection_title": ss_title,
                "content_text": block.content,
            })
        for block, s_title in rows_legacy:
            sections_data.append({
                "section_title": s_title,
                "subsection_title": "",
                "content_text": block.content,
            })

        index_course(course_id, sections_data)
    except Exception as e:
        print(f"[RAG-BG] FAILED for course {course_id}: {e}")
        traceback.print_exc()
    finally:
        db.close()


def search_course(course_id: str, query: str, top_k: int = 5) -> List[str]:
    """
    Embed the query, search Pinecone for the closest chunks, return formatted
    strings ready to be injected as LLM context.
    """
    print(f"[RAG] Searching course {course_id} for: {query[:80]!r}")
    idx = _index()
    query_vec = _embed_one(query, task="retrieval_query")

    response = idx.query(
        vector=query_vec,
        top_k=top_k,
        filter={"course_id": course_id},
        include_metadata=True,
    )

    matches = response.get("matches", []) if isinstance(response, dict) else response.matches
    chunks: List[str] = []
    for match in matches:
        m = match if isinstance(match, dict) else match.to_dict()
        score = m.get("score", 0)
        if score < MIN_SCORE:
            continue
        meta = m.get("metadata", {}) or {}
        s = meta.get("section_title", "")
        ss = meta.get("subsection_title", "")
        label = f"[{s} > {ss}]" if ss else f"[{s}]"
        chunks.append(f"{label}\n{meta.get('text', '')}")

    print(f"[RAG] Returning {len(chunks)} chunks (top scores: {[round(m.get('score', 0) if isinstance(m, dict) else m['score'], 3) for m in matches[:5]]})")
    return chunks
