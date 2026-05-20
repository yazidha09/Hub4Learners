import os
import re
import threading
import time
import traceback
from typing import List

import google.generativeai as genai
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

# Idempotent — main.py loads .env first, but if this module gets imported
# via a script or test that bypasses main.py, we still want valid env vars.
load_dotenv()

GEMINI_KEY = os.getenv("gemini_api_key")
PINECONE_KEY = os.getenv("Pinecone_api_key")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "hub4learners")
EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768  # Gemini supports output_dimensionality to truncate from 3072

CHUNK_TARGET = 1500       # Aim for chunks around this many chars (~400 tokens)
CHUNK_MAX = 2500          # Hard cap per chunk (~650 tokens)
CHUNK_MIN = 200           # Below this, merge with previous chunk on the way out
UPSERT_BATCH = 100        # Pinecone upsert batch
MIN_SCORE = 0.40          # cosine similarity threshold
INDEX_READY_TIMEOUT_S = 90

# Sentence terminators across languages we care about (Latin, Arabic, Devanagari).
# A "sentence ender" followed by whitespace marks a candidate split point.
_SENTENCE_RE = re.compile(r'(?<=[.!?؟।])\s+')

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

# Cached Pinecone index handle — avoids list_indexes() on every chat message.
_index_handle = None
_index_lock = threading.Lock()


# ── helpers ──────────────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    for ent, ch in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                    ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
        text = text.replace(ent, ch)
    return re.sub(r"\s+", " ", text).strip()


def _chunk_text(text: str) -> List[str]:
    """Sentence-aware chunker. Greedily packs sentences up to CHUNK_TARGET,
    never exceeds CHUNK_MAX, and never breaks a sentence mid-way (unless a
    single sentence is itself larger than CHUNK_MAX, in which case we hard-
    split as a last resort). Tiny trailing chunks are merged into the
    previous chunk so we never emit fragments below CHUNK_MIN."""
    text = (text or "").strip()
    if not text:
        return []

    parts = _SENTENCE_RE.split(text)
    parts = [p.strip() for p in parts if p and p.strip()]
    if not parts:
        return []

    chunks: List[str] = []
    buf = ""

    for part in parts:
        # Pathologically long sentence — hard-split as a fallback.
        if len(part) > CHUNK_MAX:
            if buf:
                chunks.append(buf)
                buf = ""
            for i in range(0, len(part), CHUNK_MAX):
                chunks.append(part[i : i + CHUNK_MAX])
            continue

        # Would adding this sentence overflow the cap? Flush and start fresh.
        if buf and len(buf) + 1 + len(part) > CHUNK_MAX:
            chunks.append(buf)
            buf = part
        else:
            buf = (buf + " " + part).strip() if buf else part

        # Hit the target — emit and reset.
        if len(buf) >= CHUNK_TARGET:
            chunks.append(buf)
            buf = ""

    if buf:
        if chunks and len(buf) < CHUNK_MIN:
            chunks[-1] = chunks[-1] + " " + buf
        else:
            chunks.append(buf)

    return chunks


def _embed_one(text: str, task: str) -> List[float]:
    """Embed a single text — returns a 768-dim vector."""
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
    """Return the Pinecone index handle; create the index on first call."""
    global _index_handle
    if _index_handle is not None:
        return _index_handle
    with _index_lock:
        if _index_handle is not None:
            return _index_handle
        if not PINECONE_KEY:
            raise RuntimeError("Pinecone_api_key is not set")
        pc = Pinecone(api_key=PINECONE_KEY)
        existing = [idx["name"] for idx in pc.list_indexes()]
        if PINECONE_INDEX not in existing:
            print(f"[RAG] Creating Pinecone index '{PINECONE_INDEX}' (dim={EMBED_DIM})")
            pc.create_index(
                name=PINECONE_INDEX,
                dimension=EMBED_DIM,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            deadline = time.monotonic() + INDEX_READY_TIMEOUT_S
            while time.monotonic() < deadline:
                if pc.describe_index(PINECONE_INDEX).status["ready"]:
                    break
                time.sleep(1)
            else:
                raise RuntimeError(
                    f"Pinecone index '{PINECONE_INDEX}' not ready after {INDEX_READY_TIMEOUT_S}s"
                )
        _index_handle = pc.Index(PINECONE_INDEX)
        return _index_handle


# ── public API ────────────────────────────────────────────────────────────────

_DETECT_MODEL = "gemini-3.1-flash-lite"
_VALID_DOMAINS = {
    "computer_science", "math", "physics", "chemistry", "biology",
    "english", "arabic", "french", "spanish",
    "business", "history", "art", "engineering", "medicine",
    "law", "psychology", "philosophy", "other",
}


def _detect_domain_language(course_name: str, description: str, sample: str) -> tuple:
    """One Gemini call — classifies a course into a coarse domain and
    language code. Falls back to ('other', 'en') on any error so indexing
    never fails because of classification."""
    import json

    if not GEMINI_KEY:
        return "other", "en"

    prompt = (
        "Classify this course. Return ONLY a JSON object — no prose, no fences — with keys:\n"
        '- "domain": one of ' + ", ".join(sorted(_VALID_DOMAINS)) + "\n"
        '- "language": ISO 639-1 code (en, fr, ar, es, de, it, pt, ...)\n\n'
        f"Course name: {course_name}\n"
        f"Description: {description or '(none)'}\n"
        f"Sample content:\n{sample[:1500]}\n\n"
        "JSON:"
    )

    try:
        model = genai.GenerativeModel(_DETECT_MODEL)
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        # Strip ```json ... ``` fences if the model added them.
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        data = json.loads(text)
        domain = (data.get("domain") or "other").strip().lower()
        if domain not in _VALID_DOMAINS:
            domain = "other"
        language = (data.get("language") or "en").strip().lower()[:5]
        return domain, language
    except Exception as e:
        print(f"[RAG] domain/language detection failed ({e}); defaulting to (other, en)")
        return "other", "en"


def index_course(course_data: dict) -> int:
    """
    Chunk, embed, and upsert every text block of a course into Pinecone.
    Each course lives in its own namespace (= course_id) so we can clear
    + repopulate atomically with delete_all (works on serverless).

    course_data shape (produced by collect_course_content):
        {
          "course_id": str,
          "course_name": str,
          "course_description": str,
          "items": [
             {section_id, section_title, subsection_id, subsection_title,
              block_id, content_text}, ...
          ]
        }

    Returns the number of chunks stored. Raises on real errors.
    """
    course_id = course_data["course_id"]
    course_name = course_data.get("course_name") or f"Course {course_id[:8]}"
    course_description = course_data.get("course_description", "") or ""
    items = course_data.get("items", [])

    print(f"[RAG] Indexing course {course_id} ({course_name!r}) — {len(items)} content items")

    if not GEMINI_KEY:
        raise RuntimeError("gemini_api_key is not set")

    # One-shot domain + language classification (single Gemini call, cheap).
    sample = "\n".join(
        _strip_html(it.get("content_text") or "")[:500]
        for it in items[:5]
        if it.get("content_text")
    )
    domain, language = _detect_domain_language(course_name, course_description, sample)
    print(f"[RAG] Course classified: domain={domain}, language={language}")

    idx = _index()

    # Clear the namespace atomically before reindex (serverless-compatible).
    try:
        idx.delete(delete_all=True, namespace=course_id)
        print(f"[RAG] Cleared namespace '{course_id}'")
    except Exception as e:
        print(f"[RAG] Namespace clear skipped ({e})")

    chunks_meta: List[dict] = []
    for item in items:
        raw = (item.get("content_text") or "").strip()
        if not raw:
            continue
        text = _strip_html(raw) if raw.startswith("<") else raw
        if not text:
            continue
        for chunk_idx, chunk in enumerate(_chunk_text(text)):
            chunks_meta.append({
                "course_id": course_id,
                "course_name": course_name,
                "domain": domain,
                "language": language,
                "section_id": item.get("section_id") or "",
                "section_title": item.get("section_title") or "",
                "subsection_id": item.get("subsection_id") or "",
                "subsection_title": item.get("subsection_title") or "",
                "block_id": item.get("block_id") or "",
                "chunk_index": chunk_idx,
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
        {"id": f"{course_id}_{i:06d}", "values": emb, "metadata": meta}
        for i, (meta, emb) in enumerate(zip(chunks_meta, embeddings))
    ]

    upserted = 0
    for i in range(0, len(vectors), UPSERT_BATCH):
        batch = vectors[i : i + UPSERT_BATCH]
        idx.upsert(vectors=batch, namespace=course_id)
        upserted += len(batch)

    print(f"[RAG] Upserted {upserted} vectors into namespace '{course_id}'")
    return upserted


def collect_course_content(course_id: str, db) -> dict:
    """
    Pull every indexable text payload for a course and return a structured
    dict ready to feed index_course(). Each item carries the DB UUIDs of
    its section / subsection / source block so chunks remain joinable back
    to the rows they came from.

    Returns:
        {
          "course_id":           str (UUID),
          "course_name":         str,
          "course_description":  str,
          "items": [
            {"section_id", "section_title",
             "subsection_id", "subsection_title",
             "block_id", "content_text"},
            ...
          ],
        }
    """
    from uuid import UUID
    from app.models.courses import Course
    from app.models.course_section import CourseSection
    from app.models.course_subsection import CourseSubsection
    from app.models.course_material import CourseMaterial
    from app.models.lesson_block import LessonBlock

    items: List[dict] = []

    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    course_name = course.title if course else f"Course {course_id[:8]}"
    course_description = (course.description or "") if course else ""

    # ── (C) Synthetic course-overview chunk: title + description ──────────────
    if course:
        overview_parts = [f"Course title: {course.title}"]
        if course.description:
            overview_parts.append(f"Course description: {course.description}")
        items.append({
            "section_id": "",
            "section_title": "Course Overview",
            "subsection_id": "",
            "subsection_title": "",
            "block_id": "course_overview",
            "content_text": "\n".join(overview_parts),
        })

    # ── Text lesson blocks (new hierarchy: section → subsection → block) ──────
    rows_new = (
        db.query(
            LessonBlock,
            CourseSubsection.id.label("ss_id"),
            CourseSubsection.title.label("ss_title"),
            CourseSection.id.label("s_id"),
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

    # ── Legacy text lesson blocks (linked directly to section) ────────────────
    rows_legacy = (
        db.query(
            LessonBlock,
            CourseSection.id.label("s_id"),
            CourseSection.title.label("s_title"),
        )
        .join(CourseSection, LessonBlock.section_id == CourseSection.id)
        .filter(
            CourseSection.course_id == UUID(course_id),
            LessonBlock.block_type == "text",
            LessonBlock.content.isnot(None),
            LessonBlock.subsection_id.is_(None),
        )
        .all()
    )

    # ── (A) Course materials with parsed text (PDFs etc.) ─────────────────────
    rows_materials = (
        db.query(
            CourseMaterial,
            CourseSection.id.label("s_id"),
            CourseSection.title.label("s_title"),
        )
        .join(CourseSection, CourseMaterial.section_id == CourseSection.id)
        .filter(
            CourseSection.course_id == UUID(course_id),
            CourseMaterial.content_text.isnot(None),
        )
        .all()
    )

    print(
        f"[RAG] collect: {len(rows_new)} blocks (new) + "
        f"{len(rows_legacy)} blocks (legacy) + {len(rows_materials)} materials"
    )

    for block, ss_id, ss_title, s_id, s_title in rows_new:
        items.append({
            "section_id": str(s_id),
            "section_title": s_title,
            "subsection_id": str(ss_id),
            "subsection_title": ss_title,
            "block_id": str(block.id),
            "content_text": block.content,
        })
    for block, s_id, s_title in rows_legacy:
        items.append({
            "section_id": str(s_id),
            "section_title": s_title,
            "subsection_id": "",
            "subsection_title": "",
            "block_id": str(block.id),
            "content_text": block.content,
        })
    for material, s_id, s_title in rows_materials:
        items.append({
            "section_id": str(s_id),
            "section_title": s_title,
            "subsection_id": "",
            "subsection_title": f"Material: {material.title}",
            "block_id": str(material.id),
            "content_text": material.content_text,
        })

    return {
        "course_id": course_id,
        "course_name": course_name,
        "course_description": course_description,
        "items": items,
    }


def index_course_sync(course_id: str) -> int:
    """Run full indexing in the calling thread; raises on error.
    Use this when the caller needs to know whether indexing succeeded
    (e.g. publish flow, manual reindex endpoint)."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        course_data = collect_course_content(course_id, db)
        return index_course(course_data)
    finally:
        db.close()


def index_course_bg(course_id: str) -> None:
    """Best-effort indexing in a daemon thread that starts immediately.
    Survives the request lifecycle better than FastAPI's BackgroundTasks
    (which can be starved/killed under uvicorn --reload). Errors are
    logged with full traceback; the caller never sees them."""
    def _worker():
        print(f"[RAG-BG] Started for course {course_id}")
        try:
            n = index_course_sync(course_id)
            print(f"[RAG-BG] Done for course {course_id} ({n} chunks)")
        except Exception as e:
            print(f"[RAG-BG] FAILED for course {course_id}: {e}")
            traceback.print_exc()

    threading.Thread(
        target=_worker,
        daemon=True,
        name=f"rag-{course_id[:8]}",
    ).start()


def course_index_stats(course_id: str) -> dict:
    """Return Pinecone index stats for a single course's namespace.
    Useful for letting the frontend confirm a course is searchable."""
    try:
        idx = _index()
        stats = idx.describe_index_stats()
        # SDK response shape: {"namespaces": {ns: {"vector_count": N}}, ...}
        ns_block = stats.get("namespaces", {}) if isinstance(stats, dict) else stats.namespaces
        ns_data = ns_block.get(course_id) if isinstance(ns_block, dict) else None
        if ns_data is None:
            return {"indexed": False, "vector_count": 0}
        count = (
            ns_data.get("vector_count", 0)
            if isinstance(ns_data, dict)
            else getattr(ns_data, "vector_count", 0)
        )
        return {"indexed": count > 0, "vector_count": int(count)}
    except Exception as e:
        return {"indexed": False, "vector_count": 0, "error": str(e)}


def delete_course_namespace(course_id: str) -> None:
    """Drop every vector belonging to a course. Safe to call when the
    namespace doesn't exist."""
    try:
        idx = _index()
        idx.delete(delete_all=True, namespace=course_id)
        print(f"[RAG] Deleted namespace '{course_id}'")
    except Exception as e:
        print(f"[RAG] delete_course_namespace skipped ({e})")


def search_course(course_id: str, query: str, top_k: int = 5) -> List[str]:
    """
    Embed the query, search the course's namespace for the closest chunks,
    return formatted strings ready to be injected as LLM context.
    """
    print(f"[RAG] Searching course {course_id} for: {query[:80]!r}")
    idx = _index()
    query_vec = _embed_one(query, task="retrieval_query")

    response = idx.query(
        vector=query_vec,
        top_k=top_k,
        namespace=course_id,
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
