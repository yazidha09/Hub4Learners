import logging
from dataclasses import dataclass

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

CHUNK_MIN_WORDS = 400
CHUNK_MAX_WORDS = 1500


@dataclass
class PDFChunk:
    index: int
    text: str
    word_count: int
    page_start: int
    page_end: int


def parse_pdf(pdf_bytes: bytes) -> list[PDFChunk]:
    """Parse a PDF binary and return a list of logical text chunks."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    spans = _extract_spans(doc)
    doc.close()

    if not spans:
        logger.warning("PDF produced zero text spans")
        return []

    median_size = _median_font_size(spans)
    chunks = _build_chunks(spans, median_size)
    logger.info("PDF parsed: %d spans → %d chunks", len(spans), len(chunks))
    return chunks


# ── Private helpers ───────────────────────────────────────────────────────────

def _extract_spans(doc: fitz.Document) -> list[dict]:
    spans: list[dict] = []
    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:   # skip image blocks
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    spans.append({
                        "text": text,
                        "size": span["size"],
                        "bold": bool(span["flags"] & 16) or "Bold" in span.get("font", ""),
                        "page": page_num + 1,
                    })
    return spans


def _median_font_size(spans: list[dict]) -> float:
    sizes = sorted(s["size"] for s in spans)
    return sizes[len(sizes) // 2] if sizes else 12.0


def _is_heading(span: dict, median_size: float) -> bool:
    # A span is a heading if it's significantly larger or bold+slightly larger
    return (
        span["size"] >= median_size * 1.25
        or (span["bold"] and span["size"] >= median_size * 1.08)
    )


def _build_chunks(spans: list[dict], median_size: float) -> list[PDFChunk]:
    chunks: list[PDFChunk] = []
    buf_texts: list[str] = []
    buf_words = 0
    chunk_start_page = spans[0]["page"]
    current_page = chunk_start_page

    def flush() -> None:
        nonlocal buf_texts, buf_words, chunk_start_page
        text = " ".join(buf_texts).strip()
        if text:
            chunks.append(PDFChunk(
                index=len(chunks),
                text=text,
                word_count=buf_words,
                page_start=chunk_start_page,
                page_end=current_page,
            ))
        buf_texts.clear()
        buf_words = 0
        chunk_start_page = current_page

    for span in spans:
        current_page = span["page"]
        words = len(span["text"].split())

        # Flush before a heading when the buffer is large enough
        if _is_heading(span, median_size) and buf_words >= CHUNK_MIN_WORDS:
            flush()

        buf_texts.append(span["text"])
        buf_words += words

        # Hard-flush at max size
        if buf_words >= CHUNK_MAX_WORDS:
            flush()

    flush()
    return chunks
