# Structured PDF Course Renderer — Implementation Notes

## What Changed

### Problem
PDFs were displayed inside an `<iframe>` — no structure, no AI integration, poor UX.

### Solution
On upload, the PDF is parsed into structured JSON (`{ sections: [{ title, content, images }] }`).
That JSON is stored in the existing `content_text` column.
The frontend reads it and renders a clean scroll-based reader with a section sidebar.

---

## Backend

### New file: `backend/app/utils/pdf_extractor.py`

**Two-pass extraction using PyMuPDF:**

**Pass 1** — scan all text spans across the whole document to compute the
_median body font size_. This is the baseline for heading detection.

**Pass 2** — walk pages in reading order:
- **Images**: extracted via `page.get_images()`, written to
  `uploads/pdf_images/`, served at `/uploads/pdf_images/*`.
  Each image is passed to **EasyOCR** (optional). If the OCR result is
  short (≤ 80 chars, 2–12 words) it's treated as a section title and starts
  a new section. Otherwise the image URL is added to the current section.
- **Text blocks**: classified as **heading** if their dominant font size is
  ≥ 115 % of body size, or if they are bold and short (< 100 chars).
  A heading flushes the current section and starts a new one.
  All other text is appended to `current_content`.

**`structured_to_plain_text(structured)`** — helper that concatenates all
section titles + content into a single string for the RAG embedder.

EasyOCR is fully optional — wrapped in try/except at every call site.
If the package is not installed or the model fails to load, images are
included as regular images (not title-detected).

---

### Modified: `backend/app/controller/course_controller.py`

`upload_material()` — PDF branch added before `_save_file()`:

```python
if mat_type == "pdf":
    pdf_bytes = file.file.read()
    file.file.seek(0)
    structured = extract_pdf_content(pdf_bytes, material_id=section_id)
    content_text = json.dumps(structured)          # stored in DB
    rag_text     = structured_to_plain_text(structured)  # passed to embedder
