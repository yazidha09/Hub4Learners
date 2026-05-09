"""
PDF parser.

Parses PDFs into chunks suitable for AI structure inference, while preserving
per-line formatting metadata so chunk content can later be rendered as HTML
*verbatim* (without any AI rewriting).
"""
import logging
from dataclasses import dataclass, field

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

CHUNK_MIN_WORDS = 250
CHUNK_MAX_WORDS = 800


_BULLET_PREFIXES = ("•", "-", "–", "●", "*", "·", "▪", "■")


@dataclass
class PDFLine:
    """One visual line of text with formatting metadata."""
    text: str
    size: float
    bold: bool
    page: int
    is_bullet: bool = False
    is_numbered: bool = False
    bullet_text: str = ""
    heading_level: int = 0   # 0 = body, 2/3/4 = heading levels


@dataclass
class PDFChunk:
    """A logical chunk of the PDF — keeps the original lines for verbatim rendering."""
    index: int
    text: str
    word_count: int
    page_start: int
    page_end: int
    lines: list[PDFLine] = field(default_factory=list)


# ── Public API ────────────────────────────────────────────────────────────────

def parse_pdf(pdf_bytes: bytes) -> list[PDFChunk]:
    """Parse a PDF and return chunks. Each chunk preserves its original lines."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    lines = _extract_lines(doc)
    doc.close()

    if not lines:
        logger.warning("PDF produced zero text lines")
        return []

    median = _median_size(lines)
    _annotate_headings(lines, median)
    chunks = _build_chunks(lines)
    logger.info("PDF parsed: %d lines → %d chunks", len(lines), len(chunks))
    return chunks


def lines_to_html(lines: list[PDFLine]) -> str:
    """
    Render PDF lines as clean HTML. Content is preserved verbatim — only HTML
    tags are added (paragraphs, lists, headings, inline emphasis).
    """
    if not lines:
        return ""

    parts: list[str] = []
    para_buf: list[str] = []

    def flush_para() -> None:
        if not para_buf:
            return
        text = " ".join(para_buf).strip()
        if text:
            parts.append(f"<p>{text}</p>")
        para_buf.clear()

    for line in lines:
        text = line.text.strip()
        if not text:
            flush_para()
            continue

        # Headings inside a subsection — emit h3/h4 (h2 is reserved for subsection title itself)
        if line.heading_level >= 2:
            flush_para()
            tag = f"h{max(3, min(line.heading_level, 4))}"
            parts.append(f"<{tag}>{_escape(text)}</{tag}>")
            continue

        if line.is_bullet:
            flush_para()
            item = line.bullet_text or text
            parts.append(f"<ul><li>{_escape(item)}</li></ul>")
            continue

        if line.is_numbered:
            flush_para()
            item = line.bullet_text or text
            parts.append(f"<ol><li>{_escape(item)}</li></ol>")
            continue

        piece = _escape(text)
        if line.bold:
            piece = f"<strong>{piece}</strong>"
        para_buf.append(piece)

    flush_para()
    return _merge_consecutive_lists(parts)


# ── Private helpers ───────────────────────────────────────────────────────────

def _extract_lines(doc: fitz.Document) -> list[PDFLine]:
    """One PDFLine per visual line — picks dominant span for size/weight."""
    out: list[PDFLine] = []
    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:   # skip image blocks
                continue
            for line in block["lines"]:
                pieces: list[str] = []
                max_size = 0.0
                bold_chars = 0
                total_chars = 0
                for span in line["spans"]:
                    t = span["text"]
                    if not t:
                        continue
                    pieces.append(t)
                    sz = span["size"]
                    if sz > max_size:
                        max_size = sz
                    is_bold = bool(span["flags"] & 16) or "Bold" in span.get("font", "")
                    chars = len(t)
                    total_chars += chars
                    if is_bold:
                        bold_chars += chars

                text = "".join(pieces).strip()
                if not text:
                    continue

                bold = total_chars > 0 and bold_chars / total_chars >= 0.6
                line_obj = PDFLine(
                    text=text,
                    size=max_size or 12.0,
                    bold=bold,
                    page=page_num + 1,
                )
                _classify_list_marker(line_obj)
                out.append(line_obj)
    return out


def _classify_list_marker(line: PDFLine) -> None:
    text = line.text.lstrip()
    if not text:
        return
    if text[0] in _BULLET_PREFIXES:
        line.is_bullet = True
        line.bullet_text = text[1:].strip(" \t-–")
        return
    if len(text) >= 2 and text[0].isdigit():
        i = 1
        while i < len(text) and text[i].isdigit():
            i += 1
        if i < len(text) and text[i] in (".", ")"):
            line.is_numbered = True
            line.bullet_text = text[i + 1:].strip()


def _median_size(lines: list[PDFLine]) -> float:
    sizes = sorted(l.size for l in lines)
    return sizes[len(sizes) // 2] if sizes else 12.0


def _annotate_headings(lines: list[PDFLine], median: float) -> None:
    """Mark lines as headings based on font size relative to body median."""
    for line in lines:
        if line.is_bullet or line.is_numbered:
            continue
        if line.size >= median * 1.4:
            line.heading_level = 2
        elif line.size >= median * 1.2:
            line.heading_level = 3
        elif line.bold and line.size >= median * 1.05 and len(line.text.split()) <= 12:
            line.heading_level = 4


def _build_chunks(lines: list[PDFLine]) -> list[PDFChunk]:
    """
    Group lines into chunks of CHUNK_MIN_WORDS..CHUNK_MAX_WORDS words. Try to
    cut at heading boundaries when possible so each chunk is a coherent topic.
    """
    chunks: list[PDFChunk] = []
    buf: list[PDFLine] = []
    buf_words = 0
    chunk_start_page = lines[0].page

    def flush() -> None:
        nonlocal buf, buf_words, chunk_start_page
        if not buf:
            return
        text = " ".join(l.text for l in buf).strip()
        end_page = buf[-1].page
        if text:
            chunks.append(PDFChunk(
                index=len(chunks),
                text=text,
                word_count=buf_words,
                page_start=chunk_start_page,
                page_end=end_page,
                lines=list(buf),
            ))
        buf = []
        buf_words = 0
        chunk_start_page = end_page

    for line in lines:
        words = len(line.text.split())

        # Prefer to flush before a heading once we have enough material
        if line.heading_level == 2 and buf_words >= CHUNK_MIN_WORDS:
            flush()

        buf.append(line)
        buf_words += words

        if buf_words >= CHUNK_MAX_WORDS:
            flush()

    flush()
    return chunks


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _merge_consecutive_lists(parts: list[str]) -> str:
    merged: list[str] = []
    for part in parts:
        if merged and merged[-1].endswith("</li></ul>") and part.startswith("<ul><li>"):
            merged[-1] = merged[-1][:-len("</ul>")] + part[len("<ul>"):]
        elif merged and merged[-1].endswith("</li></ol>") and part.startswith("<ol><li>"):
            merged[-1] = merged[-1][:-len("</ol>")] + part[len("<ol>"):]
        else:
            merged.append(part)
    return "\n".join(merged)
