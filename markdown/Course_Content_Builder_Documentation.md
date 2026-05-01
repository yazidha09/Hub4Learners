# Course Content Builder — Simple Summary

---

## What was built?

Four things were added to the platform:

1. **Subsections** — A new level between a Section and its content. Instead of dumping everything into a section, professors now create named subsections (e.g., "1.1 What is ML?").
2. **Block-based lessons** — Inside each subsection, professors add ordered blocks: text, image, or video.
3. **Rich text editor** — The text block uses Tiptap (like a mini Word editor) with bold, headings, colors, lists, alignment, etc. The output is saved as HTML.
4. **Preview mode** — Professors can click "Preview" to see the course exactly as a student would, in a new tab.

---

## Data structure

```
Course
└── Section          (e.g., "Chapter 1 — Introduction")
    └── Subsection   (e.g., "1.1 What is Machine Learning?")
        └── Block    (text | image | video)
```

Old AI-generated courses don't have subsections — they still work using the old material system.

---

## Database changes

- **New table: `course_subsections`** — stores subsection title, which section it belongs to, and its order.
- **Updated table: `lesson_blocks`** — added a `subsection_id` column; `section_id` was made optional (for backward compatibility with AI courses).

---

## Backend changes (summary)

| What | Where |
|---|---|
| Create a subsection | `POST /api/courses/{id}/sections/{id}/subsections` |
| Add a block to a subsection | `POST /api/courses/{id}/subsections/{id}/blocks` |
| Delete a block | `DELETE /api/courses/blocks/{id}` |

- All write actions check that the professor owns the course.
- File uploads (image/video) are saved to `backend/uploads/blocks/`.
- Text content is saved as an HTML string in the database.

---

## Frontend changes (summary)

**Professor Dashboard:**
- Section cards now show a numbered list of subsections.
- Each subsection has an "Edit lesson" button that opens an editor panel.
- The editor has three buttons: **Text**, **Image**, **Video**.
- Text opens the Tiptap rich text editor (bold, headings, colors, etc.).
- Image/Video shows a file picker + optional caption.
- A "Preview" button opens the learning page as a student would see it.

**Learning Page (student view):**
- Sidebar shows sections as headers and subsections as clickable numbered items.
- Clicking a subsection loads its blocks in the main area.
- Text blocks with HTML are rendered as styled content.
- Image blocks show `<img>`, video blocks show `<video controls>`.
- Old AI-generated sections without subsections still show their materials as bullet items.

---

## Rich text editor (Tiptap) — key points

- Toolbar supports: H1/H2/H3, Bold, Italic, Underline, Strikethrough, Lists, Alignment, Text color, Highlight, Blockquote, Code block.
- Output is a standard HTML string stored in the `content` field of the block.
- Toolbar buttons use `onMouseDown` (not `onClick`) to avoid losing the text selection before the command fires.
- At render time, if `content` starts with `<`, it's treated as HTML and rendered with `dangerouslySetInnerHTML`.

---

## Files created / modified

| File | Change |
|---|---|
| `backend/app/models/course_subsection.py` | New model |
| `backend/app/models/lesson_block.py` | Added `subsection_id`, made `section_id` optional |
| `backend/app/schemas/course.py` | Added `SubsectionOut`, `SubsectionCreate` |
| `backend/app/controller/course_controller.py` | Added subsection + block logic |
| `backend/app/routes/course_routes.py` | New routes |
| `backend/app/main.py` | DB migrations on startup |
| `frontend/src/api/course.ts` | New types + API calls |
| `frontend/src/components/RichTextEditor.tsx` | New Tiptap component |
| `frontend/src/pages/ProfessorDashboard.tsx` | Subsection UI + lesson editor |
| `frontend/src/pages/CourseLearningPage.tsx` | Subsection sidebar + content renderer |

---

## Key rules

- Only professors can create/edit content — enforced by `require_role("professor")`.
- A professor can only edit their own courses — ownership is checked every time.
- `block_type` must be `text`, `image`, or `video` — anything else returns a 400 error.
- Image files: jpg, jpeg, png, gif, webp only.
- Video files: mp4, webm, mov only.
- Old AI-generated courses (no subsections) still display correctly via a fallback.

---

*Document generated for PFE project Hub4Learners — April 2026*
