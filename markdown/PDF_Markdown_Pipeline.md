# PDF → Markdown Conversion Pipeline

## Overview

When a professor uploads a **PDF material**, the backend automatically converts it into clean, structured markdown with embedded images. The result is stored in the database as `content_text` and rendered directly in the frontend — no PDF viewer needed.

---

## Table of Contents

1. [Trigger](#1-trigger)
2. [Step 1 — Local Extraction (PyMuPDF)](#2-step-1--local-extraction-pymupdf)
3. [Step 2 — Chunking](#3-step-2--chunking)
4. [Step 3 — AI Enhancement (Together AI)](#4-step-3--ai-enhancement-together-ai)
5. [Step 4 — Image Safety Net](#5-step-4--image-safety-net)
6. [Visual Flow](#6-visual-flow)
7. [Technologies](#7-technologies)

---

## 1. Trigger

When a professor uploads a PDF material, `course_controller.py` intercepts the file **before saving it** and calls the converter:

```python
# backend/app/controller/course_controller.py  (lines 201–206)
if mat_type == "pdf":
    pdf_bytes = file.file.read()
    file.file.seek(0)
    converted = pdf_to_markdown(pdf_bytes, material_id=section_id)
    if converted:
        content_text = converted
```

The conversion is **synchronous** — the professor waits for it to complete. The resulting markdown string is stored in the `content_text` column of the material record.

---

## 2. Step 1 — Local Extraction (PyMuPDF)

**File:** `backend/app/utils/pdf_converter.py` — `_extract()`

PyMuPDF (`fitz`) opens the PDF **purely in memory** from raw bytes — no temp files created. For each page it does two things:

### Text extraction
```python
text = page.get_text().strip()
```
All readable text on the page is pulled out as a plain string.

### Image extraction
```python
for img_info in page.get_images(full=True):
    xref = img_info[0]
    img_data = doc.extract_image(xref)
    # saved to uploads/pdf_images/<uuid>.png
    # embedded inline as:
    #   ![image](http://localhost:8000/uploads/pdf_images/filename.png)
```

Every embedded image (even ones not in text blocks) is:
- Extracted from the PDF's internal xref table
- Saved to `uploads/pdf_images/` with a UUID filename
- Embedded inline in the markdown as `![image](url)`

A list of **all image URLs** is returned separately alongside the raw text — this is used in Step 4 as a safety net.

All pages are joined with `---` horizontal rule separators:

```
[Page 1 text + images]

---

[Page 2 text + images]

---

...
```

---

## 3. Step 2 — Chunking

**File:** `backend/app/utils/pdf_converter.py` — `_chunk()`

Together AI has token limits. The raw text is split by blank lines into paragraphs, then **greedily packed** into chunks of max **5,000 characters** each — without ever breaking in the middle of a paragraph.

```python
CHUNK_CHARS = 5_000

# splits on blank lines, then packs into chunks ≤ 5000 chars
chunks = _chunk(raw_text)
```

This ensures:
- No single API call is too large
- Paragraph boundaries are always respected
- Image tags (which sit between paragraphs) are never split across chunks

---

## 4. Step 3 — AI Enhancement (Together AI)

**File:** `backend/app/utils/pdf_converter.py` — `_enhance()`

Each chunk is sent to **Together AI** (model: `meta-llama/Llama-3-8b-chat-hf`) with a strict system prompt:

```
You are a markdown formatting expert. Convert raw PDF-extracted text into
clean, well-structured markdown.

Rules:
1. Use proper headings (#, ##, ###), **bold**, *italic*, lists, tables, code blocks.
2. Preserve ALL content — never summarise, omit, or invent anything.
3. CRITICAL: preserve EVERY markdown image tag `![alt](url)` EXACTLY as given —
   do not remove, rewrite, or modify them.
4. Fix obvious OCR errors and garbled characters.
5. Return ONLY the markdown — no preamble, no explanation.
```

Key parameters:
| Parameter | Value |
|---|---|
| Model | `meta-llama/Llama-3-8b-chat-hf` |
| Max tokens | 4096 |
| Temperature | 0.1 (very deterministic) |
| Timeout | 90 seconds |
| Delay between chunks | 0.8 seconds (rate limiting) |

> **Graceful fallback:** if Together AI fails for any reason (network error, timeout, bad status), the raw extracted text is used as-is — nothing is lost.

---

## 5. Step 4 — Image Safety Net

**File:** `backend/app/utils/pdf_converter.py` — `pdf_to_markdown()` lines 172–177

Despite the system prompt instructing the LLM to preserve image tags, LLMs sometimes strip them anyway. After all chunks are joined, the code runs a verification:

```python
missing = [url for url in all_urls if url not in result]
if missing:
    result += "\n\n---\n\n"
    for url in missing:
        result += f"\n\n![image]({url})"
```

Any image that was extracted in Step 1 but is **absent from the final markdown** gets appended at the end under a separator. This guarantees **no image is ever silently lost**.

---

## 6. Visual Flow

```
PDF bytes (uploaded by professor)
    │
    ▼
┌─────────────────────────────────────────┐
│  Step 1 — PyMuPDF  (local, no network) │
│                                         │
│  for each page:                         │
│    ├── page.get_text()  → raw text      │
│    └── page.get_images() → save to disk │
│              └─► ![image](url) inline   │
└─────────────────────────────────────────┘
    │
    ├── raw markdown string
    └── [ list of all image URLs ]
    │
    ▼
┌──────────────────────────────────────┐
│  Step 2 — Chunker                   │
│  split by blank lines, pack ≤ 5000  │
│  chars per chunk                    │
└──────────────────────────────────────┘
    │
    └── [ chunk1, chunk2, chunk3, ... ]
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  Step 3 — Together AI  (Llama-3-8b)                 │
│                                                      │
│  for each chunk:                                     │
│    ├── POST /v1/chat/completions                     │
│    ├── system: "format as clean markdown,            │
│    │           preserve ALL image tags"              │
│    └── response: enhanced markdown chunk             │
│                                                      │
│  [0.8s delay between chunks — rate limiting]         │
│  [fallback to raw text on any error]                 │
└──────────────────────────────────────────────────────┘
    │
    └── join all enhanced chunks
    │
    ▼
┌──────────────────────────────────────────────────┐
│  Step 4 — Image safety net                      │
│  check: which URLs from Step 1 are missing?     │
│  re-append any missing images at the end        │
└──────────────────────────────────────────────────┘
    │
    ▼
Final markdown string
    │
    ▼
Stored in DB as  content_text  on the CourseMaterial row
    │
    ▼
Rendered in frontend via <Markdown> (react-markdown)
when student/professor clicks "Read" on a PDF material
```

---

## 7. Technologies

| Component | Library / Service | Role |
|---|---|---|
| PDF parsing | `PyMuPDF` (`fitz`) | Extract text and images locally |
| Image storage | Local filesystem | `uploads/pdf_images/`, served at `/uploads` |
| Chunking | Custom Python | Respect paragraph boundaries, stay under token limits |
| AI formatting | Together AI — Llama-3-8b | Convert raw text to clean markdown |
| Frontend rendering | `react-markdown` | Render `content_text` as rich HTML in the UI |

---

*Document generated for PFE project Hub4Learners — April 2026*
