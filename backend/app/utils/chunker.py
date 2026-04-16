"""
Text chunking utility for RAG.
Splits markdown/plain text into overlapping chunks while respecting
paragraph and heading boundaries so chunks stay semantically coherent.
"""

import re

CHUNK_SIZE    = 1_500   # target characters per chunk
CHUNK_OVERLAP = 200     # characters carried over into the next chunk


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """
    Split *text* into overlapping chunks.

    Strategy:
    1. Split on blank lines (paragraph / heading boundaries).
    2. Greedily pack paragraphs into a chunk until chunk_size is reached.
    3. When a chunk is full, start the next one with an overlap tail of the
       previous chunk so context is not lost at boundaries.
    4. If a single paragraph exceeds 1.5× chunk_size, hard-split it with
       the same overlap so we never produce unreasonably large chunks.
    """
    # Normalise line endings and collapse excessive blank lines
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    if not text:
        return []

    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para

        if len(candidate) > chunk_size and current:
            # Flush the current chunk
            chunks.append(current.strip())
            # Overlap: carry the tail of the flushed chunk into the next one
            tail = current[-overlap:].strip() if len(current) > overlap else current.strip()
            current = f"{tail}\n\n{para}" if tail else para
        else:
            current = candidate

    if current.strip():
        chunks.append(current.strip())

    # Hard-split any chunk that is still too large (e.g. a huge single paragraph)
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= chunk_size * 1.5:
            final.append(chunk)
        else:
            i = 0
            while i < len(chunk):
                end = min(i + chunk_size, len(chunk))
                final.append(chunk[i:end].strip())
                i += chunk_size - overlap

    return final or [text[:chunk_size]]
