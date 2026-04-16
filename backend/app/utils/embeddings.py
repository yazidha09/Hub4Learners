"""
Embedding and retrieval utilities for RAG.

Embedding model : BAAI/bge-base-en-v1.5  via Together AI  (768-dim vectors)
Vector store    : pgvector on Neon PostgreSQL  (material_chunks table)
No extra Python package required — uses requests + raw SQL.
"""

import os
import requests
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.utils.chunker import chunk_text

load_dotenv()

TOGETHER_KEY    = os.getenv("TOGETHER_API_KEY")
EMBEDDING_URL   = "https://api.together.xyz/v1/embeddings"
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
VECTOR_DIM      = 768


# ── helpers ────────────────────────────────────────────────────────────────────

def _vec(embedding: list[float]) -> str:
    """Format a Python float list as a PostgreSQL vector literal: [a,b,c,…]"""
    return "[" + ",".join(map(str, embedding)) + "]"


def embed_text(text_input: str) -> list[float] | None:
    """
    Call Together AI to get a 768-dim embedding for *text_input*.
    Returns None on any failure so callers can degrade gracefully.
    """
    if not TOGETHER_KEY:
        return None
    try:
        resp = requests.post(
            EMBEDDING_URL,
            headers={
                "Authorization": f"Bearer {TOGETHER_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": EMBEDDING_MODEL, "input": text_input},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception:
        return None


# ── indexing ───────────────────────────────────────────────────────────────────

def embed_and_store_material(
    material_id: str,
    course_id: str,
    section_title: str,
    material_title: str,
    content_text: str,
    db: Session,
) -> int:
    """
    Chunk *content_text*, embed each chunk, and upsert into material_chunks.
    Deletes all previous chunks for this material before inserting new ones.
    Returns the number of chunks successfully stored.
    """
    # Remove stale chunks for this material
    db.execute(
        text("DELETE FROM material_chunks WHERE material_id = :mid"),
        {"mid": str(material_id)},
    )
    db.commit()

    chunks = chunk_text(content_text)
    stored = 0

    for idx, chunk in enumerate(chunks):
        embedding = embed_text(chunk)
        if embedding is None:
            continue

        db.execute(
            text("""
                INSERT INTO material_chunks
                    (id, material_id, course_id, section_title, material_title,
                     chunk_index, content, embedding)
                VALUES
                    (gen_random_uuid(), :mid, :cid, :sec, :mat,
                     :idx, :content, :emb::vector)
            """),
            {
                "mid":     str(material_id),
                "cid":     str(course_id),
                "sec":     section_title,
                "mat":     material_title,
                "idx":     idx,
                "content": chunk,
                "emb":     _vec(embedding),
            },
        )
        stored += 1

    db.commit()
    return stored


# ── retrieval ──────────────────────────────────────────────────────────────────

def course_has_chunks(course_id: str, db: Session) -> bool:
    """Return True if at least one chunk exists for this course."""
    row = db.execute(
        text("SELECT 1 FROM material_chunks WHERE course_id = :cid LIMIT 1"),
        {"cid": str(course_id)},
    ).fetchone()
    return row is not None


def retrieve_relevant_chunks(
    query: str,
    course_id: str,
    db: Session,
    top_k: int = 6,
) -> list[dict]:
    """
    Embed *query* then return the *top_k* most similar chunks for *course_id*
    using cosine similarity ( <=> operator ).

    Returns a list of dicts:
      { content, section_title, material_title, similarity }
    """
    query_vec = embed_text(query)
    if query_vec is None:
        return []

    rows = db.execute(
        text("""
            SELECT
                content,
                section_title,
                material_title,
                1 - (embedding <=> :qvec::vector) AS similarity
            FROM material_chunks
            WHERE course_id = :cid
            ORDER BY embedding <=> :qvec::vector
            LIMIT :k
        """),
        {
            "qvec": _vec(query_vec),
            "cid":  str(course_id),
            "k":    top_k,
        },
    ).fetchall()

    return [
        {
            "content":        r.content,
            "section_title":  r.section_title,
            "material_title": r.material_title,
            "similarity":     float(r.similarity),
        }
        for r in rows
    ]
