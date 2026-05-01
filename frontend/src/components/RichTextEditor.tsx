import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const COLORS = [
  '#0f172a', '#334155', '#64748b', '#94a3b8',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#0284c7', '#7c3aed', '#db2777', '#0891b2',
  '#f87171', '#fb923c', '#fbbf24', '#4ade80',
]

function ToolbarButton({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`w-7 h-7 rounded flex items-center justify-center text-[0.78rem] font-semibold transition-colors ${
        active
          ? 'bg-[#0C0C0F] text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const [showColors, setShowColors] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: [
          'min-h-[200px] px-4 py-3 outline-none text-[0.87rem] leading-relaxed text-slate-800',
          'focus:outline-none',
          '[&_h1]:text-[1.4rem] [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-slate-900',
          '[&_h2]:text-[1.15rem] [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-slate-900',
          '[&_h3]:text-[1rem] [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-slate-800',
          '[&_p]:mb-2',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:space-y-1',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:space-y-1',
          '[&_strong]:font-bold',
          '[&_em]:italic',
          '[&_u]:underline',
          '[&_mark]:px-0.5 [&_mark]:rounded-sm',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-500',
          '[&_pre]:bg-slate-100 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-sm [&_pre]:overflow-x-auto',
          '[&_code]:bg-slate-100 [&_code]:text-[#FF5533] [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.82rem]',
        ].join(' '),
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!editor) return null

  const currentColor = editor.getAttributes('textStyle').color as string | undefined

  const sep = <div className="w-px h-5 bg-slate-200 mx-1" />

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col shadow-sm">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#E5E7EB] flex-wrap bg-[#F8F9FA]">

        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>

        {sep}

        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 11.79A4 4 0 0013 5H7v14h6.5a4.5 4.5 0 002.1-8.21zM9 7h4a2 2 0 010 4H9V7zm4.5 10H9v-4h4.5a2.5 2.5 0 010 5z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 4v2h2.2l-3.4 12H8v2h7v-2h-2.2l3.4-12H18V4z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span style={{ textDecoration: 'underline', fontSize: '0.85rem', lineHeight: 1 }}>U</span>
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M6.85 7.08C6.85 4.37 9.45 3 12.24 3c1.64 0 3 .49 3.9 1.28.77.65 1.46 1.73 1.46 3.24h-2.44c0-.64-.22-1.17-.61-1.54-.51-.48-1.25-.73-2.14-.73-1.94 0-2.96.95-2.96 2.09 0 .64.28 1.13.78 1.54H2v2h20v-2H6.85zm.5 6.92c.09.23.26.43.5.61.86.65 2.18.97 3.74.97 1.76 0 3.04-.44 3.8-1.05.49-.39.85-.92.85-1.65v-.85H2v2h5.35z"/></svg>
        </ToolbarButton>

        {sep}

        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm16-8V6H8.023v2H20zM8 11h12v2H8zm0 5h12v2H8z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2zm1-9h1V4H2v1h1zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2zm5-5v2h14V6zm0 4v2h14v-2zm0 4v2h14v-2z"/></svg>
        </ToolbarButton>

        {sep}

        <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3zm0 4h18v2H3z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v2H3zm3 4h12v2H6zm-3 4h18v2H3zm3 4h12v2H6zm-3 4h18v2H3z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v2H3zm6 4h12v2H9zm-6 4h18v2H3zm6 4h12v2H9zm-6 4h18v2H3z"/></svg>
        </ToolbarButton>

        {sep}

        <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M15.5 3.5l-5 5-2.5-2.5-5 5 2.5 2.5-5 5h17v-2H7.33l3.17-3.17 2.5 2.5 5-5-2.5-2.5 3.5-3.5z"/></svg>
        </ToolbarButton>

        {/* Color picker */}
        <div className="relative" ref={colorRef}>
          <button
            type="button"
            title="Text color"
            onMouseDown={e => { e.preventDefault(); setShowColors(s => !s) }}
            className="w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <span className="text-[0.78rem] font-bold leading-none" style={{ color: currentColor ?? '#0f172a' }}>A</span>
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: currentColor ?? '#0f172a' }} />
          </button>
          {showColors && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-xl grid grid-cols-4 gap-1.5 w-[120px]">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColors(false) }}
                  className="w-6 h-6 rounded-md border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: currentColor === c ? '#FF5533' : '#E5E7EB' }}
                />
              ))}
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColors(false) }}
                className="col-span-4 mt-0.5 text-[0.65rem] text-slate-500 hover:text-slate-800 text-center py-1 rounded hover:bg-slate-100 transition-colors"
              >
                Remove color
              </button>
            </div>
          )}
        </div>

        {sep}

        <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6zm.27 15L13 13.27 14.73 15 13.46 18H16l-1.36 3.03C14.54 21.67 13.9 22 13.2 22c-.51 0-.98-.21-1.32-.55L6.27 20z"/></svg>
        </ToolbarButton>
      </div>

      {/* ── Editor area ── */}
      <div className="relative bg-white">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-3 left-4 text-slate-400 text-[0.87rem] pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
