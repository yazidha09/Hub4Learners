"""
PDF → Structured JSON extractor
  1. PyMuPDF  — extracts text blocks (with font-size metadata) and embedded images
  2. EasyOCR  — optional; detects text inside images (title cards, diagrams)
               Gracefully skipped if the package is not installed.

Output shape:
  {
    "sections": [
      { "title": str, "content": str, "images": [url, ...] }
    ]
  }

The caller is responsible for persisting images and text.
"""

import json
import uuid
from pathlib import Path
from statistics import median
from typing import Optional

import fitz  # pymupdf

# Images are written here and served by the existing static mount at /uploads
IMAGES_DIR        = Path(__file__).resolve().parents[2] / "uploads" / "pdf_images"
IMAGES_URL_PREFIX = "http://localhost:8000/uploads/pdf_images"

# ── optional EasyOCR — loaded once and reused ──────────────────────────────────
_ocr_reader = None

def _get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is not None:
        return _ocr_reader
    try:
        import easyocr  # noqa: F401
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        return _ocr_reader
    except Exception:
        return None


def _ocr_image(img_bytes: bytes) -> str:
    """Return OCR text for image bytes, or '' on any failure."""
    reader = _get_ocr_reader()
    if reader is None:
        return ""
    try:
        import io
        import numpy as np
        from PIL import Image

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        results = reader.readtext(np.array(img), detail=0)
        return " ".join(results).strip()
    except Exception:
        return ""


# ── heading detection ──────────────────────────────────────────────────────────

def _dominant_font_size(block: dict) -> float:
    sizes = [
        span["size"]
        for line in block.get("lines", [])
        for span in line.get("spans", [])
    ]
    return max(sizes) if sizes else 0.0


def _block_text(block: dict) -> str:
    return "".join(
        span["text"]
        for line in block.get("lines", [])
        for span in line.get("spans", [])
    ).strip()


def _is_bold(block: dict) -> bool:
    for line in block.get("lines", []):
        for span in line.get("spans", []):
            if span.get("flags", 0) & (1 << 4):   # bit-4 = bold in MuPDF
                return True
    return False


def _is_heading(block: dict, body_size: float) -> bool:
    text = _block_text(block)
    if not text or len(text) > 200:
        return False
    size = _dominant_font_size(block)
    # Larger than body text, OR bold and short
    return size >= body_size * 1.15 or (_is_bold(block) and len(text) < 100)


def _looks_like_title(text: str) -> bool:
    """Short OCR result that could be a section title."""
    t = text.strip()
    return 2 <= len(t.split()) <= 12 and len(t) <= 80


# ── main extraction ────────────────────────────────────────────────────────────

def extract_pdf_content(pdf_bytes: bytes, material_id: str) -> dict:
    """
    Extract structured content from raw PDF bytes.

    Returns:
        {
          "sections": [{ "title": str, "content": str, "images": [url] }]
        }
    """
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # ── pass 1: collect all font sizes to estimate body size ──────────────────
    all_sizes: list[float] = []
    for page in doc:
        for block in page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]:
            if block["type"] == 0:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        all_sizes.append(span["size"])
    body_size = median(all_sizes) if all_sizes else 12.0
    doc.close()

    # ── pass 2: build sections ────────────────────────────────────────────────
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    sections: list[dict] = []
    cur_title   = ""
    cur_content: list[str] = []
    cur_images:  list[str] = []

    def flush():
        nonlocal cur_title, cur_content, cur_images
        content = "\n\n".join(cur_content).strip()
        if cur_title or content or cur_images:
            sections.append({
                "title":   cur_title or "Content",
                "content": content,
                "images":  list(cur_images),
            })
        cur_content = []
        cur_images  = []
        cur_title   = ""

    seen_xrefs: set[int] = set()

    for page in doc:
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        # Collect image xrefs on this page first (maintain reading order)
        page_images: dict[int, str] = {}   # xref → saved URL
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            try:
                img_data = doc.extract_image(xref)
                ext      = img_data.get("ext", "png")
                fname    = f"{material_id}_{uuid.uuid4().hex[:8]}.{ext}"
                (IMAGES_DIR / fname).write_bytes(img_data["image"])
                url = f"{IMAGES_URL_PREFIX}/{fname}"

                # Try OCR — if it reads like a section title, use it as such
                ocr_text = _ocr_image(img_data["image"])
                if ocr_text and _looks_like_title(ocr_text):
                    page_images[xref] = f"__TITLE__{ocr_text}"
                else:
                    page_images[xref] = url
            except Exception:
                continue

        # Process blocks in reading order
        # (images without bboxes are inserted at top; refine if needed)
        img_iter = iter(page_images.values())

        # Insert images that appear before first block
        for val in list(page_images.values()):
            if val.startswith("__TITLE__"):
                flush()
                cur_title = val[len("__TITLE__"):]
            else:
                cur_images.append(val)
        page_images.clear()   # already consumed above

        for block in blocks:
            if block["type"] != 0:   # skip image-type blocks (already handled)
                continue
            text = _block_text(block)
            if not text:
                continue

            if _is_heading(block, body_size):
                flush()
                cur_title = text
            else:
                cur_content.append(text)

    flush()
    doc.close()

    # ── fallback ───────────────────────────────────────────────────────────────
    if not sections:
        sections = [{"title": "Content", "content": "", "images": []}]

    return {"sections": sections}


# ── plain-text extractor for RAG ───────────────────────────────────────────────

def structured_to_plain_text(structured: dict) -> str:
    """Flatten structured JSON to plain text for RAG embedding."""
    parts = []
    for sec in structured.get("sections", []):
        if sec.get("title"):
            parts.append(sec["title"])
        if sec.get("content"):
            parts.append(sec["content"])
    return "\n\n".join(parts)
