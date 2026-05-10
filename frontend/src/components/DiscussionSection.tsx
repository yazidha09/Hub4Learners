import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  createDiscussionPost,
  deleteDiscussionPost,
  editDiscussionPost,
  getDiscussionSummary,
  listDiscussionPosts,
  regenerateDiscussionSummary,
  replyToDiscussionPost,
  reportDiscussionPost,
  toggleDiscussionVote,
  type DiscussionPostOut,
  type DiscussionSort,
  type DiscussionSummaryOut,
} from '../api/discussions'

interface Props {
  open: boolean
  onClose: () => void
  subsectionId: string
  lessonTitle: string
  token: string
  currentUserId: string
  onCountChange?: (total: number) => void
}

const SORT_OPTIONS: { key: DiscussionSort; label: string }[] = [
  { key: 'relevant', label: 'Most relevant' },
  { key: 'top',      label: 'Most upvoted'  },
  { key: 'new',      label: 'Newest'        },
  { key: 'old',      label: 'Oldest'        },
]

const PAGE_SIZE = 10

/* ─── Markdown renderer ─── */
function PostMarkdown({ source }: { source: string }) {
  return (
    <div
      className="
        prose prose-invert max-w-none text-[0.86rem] leading-[1.7] text-[#CBD5E1]
        [&>p]:my-2 [&_p]:text-[#CBD5E1]
        [&_a]:text-[#FF7755] [&_a]:underline [&_a]:underline-offset-2
        [&_strong]:text-[#E2E8F0]
        [&_code]:bg-[#0F1117] [&_code]:text-[#FF7755] [&_code]:px-1.5 [&_code]:py-0.5
        [&_code]:rounded [&_code]:text-[0.78rem] [&_code]:font-mono [&_code]:border [&_code]:border-[#1E2028]
        [&_pre]:bg-[#0B0D12] [&_pre]:border [&_pre]:border-[#1E2028]
        [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto
        [&_pre]:text-[0.78rem] [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:text-[#94A3B8] [&_pre_code]:p-0
        [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:my-0.5
        [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#FF5533]/40
        [&_blockquote]:pl-3 [&_blockquote]:text-[#94A3B8] [&_blockquote]:italic
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

/* ─── Helpers ─── */
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function Avatar({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  const initials = name
    .split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (image) {
    const src = image.startsWith('http') ? image : `http://localhost:8000${image}`
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-[#1E2028] shrink-0"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="rounded-full bg-gradient-to-br from-[#FF5533] to-[#E64422] text-white font-bold flex items-center justify-center shrink-0"
    >
      {initials || '?'}
    </div>
  )
}

/* ─── Composer ─── */
function Composer({
  value, onChange, onSubmit, onCancel, submitting, placeholder, autoFocus, submitLabel, compact,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel?: () => void
  submitting: boolean
  placeholder: string
  autoFocus?: boolean
  submitLabel: string
  compact?: boolean
}) {
  const [showPreview, setShowPreview] = useState(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (autoFocus && taRef.current) taRef.current.focus()
  }, [autoFocus])

  return (
    <div className="rounded-xl bg-[#0F1117] border border-[#1E2028] focus-within:border-[#FF5533]/40 transition-colors">
      {showPreview ? (
        <div className={`px-3 ${compact ? 'py-2 min-h-[64px]' : 'py-3 min-h-[88px]'}`}>
          {value.trim() ? (
            <PostMarkdown source={value} />
          ) : (
            <p className="text-[#475569] text-[0.8rem] italic">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          className="w-full bg-transparent text-[#E2E8F0] text-[0.86rem] px-3 py-2.5 outline-none resize-none placeholder-[#475569] leading-relaxed"
        />
      )}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-[#1A1D25]">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowPreview(false)}
            className={`text-[0.7rem] font-semibold px-2 py-1 rounded-md transition-colors ${
              !showPreview ? 'bg-[#1A1D25] text-[#E2E8F0]' : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            Write
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`text-[0.7rem] font-semibold px-2 py-1 rounded-md transition-colors ${
              showPreview ? 'bg-[#1A1D25] text-[#E2E8F0]' : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            Preview
          </button>
          <span className="text-[0.64rem] text-[#475569] ml-1.5 hidden sm:inline">
            Markdown · @mention
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={submitting}
              className="text-[0.74rem] font-semibold text-[#64748B] hover:text-[#CBD5E1] px-2.5 py-1 rounded-md transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={submitting || !value.trim()}
            className="text-[0.74rem] font-semibold bg-[#FF5533] text-white hover:bg-[#E64422] disabled:bg-[#1A1D25] disabled:text-[#475569] disabled:cursor-not-allowed px-3 py-1 rounded-md transition-colors"
          >
            {submitting ? '…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Post card ─── */
function PostCard({
  post, isReply, token, onMutate,
}: {
  post: DiscussionPostOut
  isReply: boolean
  token: string
  onMutate: (action: 'replace' | 'delete' | 'add-reply', payload?: DiscussionPostOut, postId?: string) => void
}) {
  const [voting, setVoting] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.content)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [reported, setReported] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [voteState, setVoteState] = useState({ has_voted: post.has_voted, upvote_count: post.upvote_count })
  useEffect(() => {
    setVoteState({ has_voted: post.has_voted, upvote_count: post.upvote_count })
  }, [post.has_voted, post.upvote_count])

  const handleVote = useCallback(async () => {
    if (voting || post.is_deleted) return
    setVoting(true)
    setVoteState({
      has_voted: !voteState.has_voted,
      upvote_count: voteState.upvote_count + (voteState.has_voted ? -1 : 1),
    })
    try {
      const res = await toggleDiscussionVote(token, post.id)
      setVoteState({ has_voted: res.has_voted, upvote_count: res.upvote_count })
    } catch {
      setVoteState({ has_voted: post.has_voted, upvote_count: post.upvote_count })
    } finally {
      setVoting(false)
    }
  }, [voting, voteState, token, post])

  const handleReply = useCallback(async () => {
    if (!replyText.trim()) return
    setReplySubmitting(true)
    try {
      const reply = await replyToDiscussionPost(token, post.id, replyText.trim())
      onMutate('add-reply', reply, post.id)
      setReplyText('')
      setShowReply(false)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to post reply')
    } finally {
      setReplySubmitting(false)
    }
  }, [replyText, token, post.id, onMutate])

  const handleEdit = useCallback(async () => {
    if (!editText.trim()) return
    setEditSubmitting(true)
    try {
      const updated = await editDiscussionPost(token, post.id, editText.trim())
      onMutate('replace', updated)
      setEditing(false)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to edit post')
    } finally {
      setEditSubmitting(false)
    }
  }, [editText, token, post.id, onMutate])

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this post?')) return
    try {
      await deleteDiscussionPost(token, post.id)
      onMutate('delete', undefined, post.id)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete post')
    }
  }, [token, post.id, onMutate])

  const handleReport = useCallback(async () => {
    if (reported) return
    try {
      await reportDiscussionPost(token, post.id)
      setReported(true)
      setMenuOpen(false)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to report post')
    }
  }, [reported, token, post.id])

  return (
    <article className={isReply ? 'pt-3' : 'pt-3 border-t border-[#1A1D25] first:border-t-0 first:pt-0'}>
      <div className="flex items-start gap-3">
        <Avatar name={post.author.full_name} image={post.author.profile_image} size={isReply ? 26 : 32} />
        <div className="flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[0.82rem] font-semibold text-[#E2E8F0] truncate">{post.author.full_name}</span>
              {post.is_instructor && (
                <span className="text-[0.58rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF5533]/15 text-[#FF7755] border border-[#FF5533]/25">
                  Instructor
                </span>
              )}
              <span className="text-[0.68rem] text-[#475569]">· {timeAgo(post.created_at)}</span>
              {post.edited_at && <span className="text-[0.64rem] text-[#475569] italic">(edited)</span>}
            </div>

            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((m) => !m)}
                className="text-[#475569] hover:text-[#CBD5E1] p-1 rounded-md hover:bg-[#1A1D25] transition-colors"
                aria-label="Post menu"
              >
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-10 w-36 rounded-lg bg-[#0F1117] border border-[#1E2028] shadow-xl overflow-hidden"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {post.is_owner && !post.is_deleted && (
                    <>
                      <button
                        onClick={() => { setEditing(true); setMenuOpen(false); setEditText(post.content) }}
                        className="w-full text-left px-3 py-1.5 text-[0.76rem] text-[#CBD5E1] hover:bg-[#1A1D25]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full text-left px-3 py-1.5 text-[0.76rem] text-rose-400 hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {!post.is_owner && !post.is_deleted && (
                    <button
                      onClick={handleReport}
                      disabled={reported}
                      className="w-full text-left px-3 py-1.5 text-[0.76rem] text-[#CBD5E1] hover:bg-[#1A1D25] disabled:opacity-50"
                    >
                      {reported ? 'Reported' : 'Report'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {editing ? (
            <Composer
              value={editText}
              onChange={setEditText}
              onSubmit={handleEdit}
              onCancel={() => { setEditing(false); setEditText(post.content) }}
              submitting={editSubmitting}
              placeholder="Edit your post…"
              autoFocus
              submitLabel="Save"
              compact
            />
          ) : (
            <PostMarkdown source={post.content} />
          )}

          {!editing && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={handleVote}
                disabled={voting || post.is_deleted}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[0.72rem] font-semibold transition-colors ${
                  voteState.has_voted
                    ? 'bg-[#FF5533]/15 text-[#FF7755] border border-[#FF5533]/30'
                    : 'bg-transparent text-[#94A3B8] border border-[#1E2028] hover:border-[#252830] hover:text-[#CBD5E1]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                <span className="font-mono tabular-nums">{voteState.upvote_count}</span>
              </button>

              {!isReply && !post.is_deleted && (
                <button
                  onClick={() => setShowReply((r) => !r)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.72rem] font-semibold text-[#94A3B8] border border-[#1E2028] hover:border-[#252830] hover:text-[#CBD5E1] transition-colors"
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-5-5 5-5M4 12h11a5 5 0 015 5v0" />
                  </svg>
                  Reply
                </button>
              )}

              {post.reply_count > 0 && !isReply && (
                <span className="text-[0.68rem] text-[#475569] ml-0.5">
                  · {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                </span>
              )}
            </div>
          )}

          {showReply && !isReply && (
            <div className="mt-2.5">
              <Composer
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleReply}
                onCancel={() => { setShowReply(false); setReplyText('') }}
                submitting={replySubmitting}
                placeholder={`Reply to ${post.author.full_name}…`}
                autoFocus
                submitLabel="Reply"
                compact
              />
            </div>
          )}

          {!isReply && post.replies && post.replies.length > 0 && (
            <div className="mt-3 ml-1 pl-3 border-l-2 border-[#1A1D25] space-y-3">
              {post.replies.map((r) => (
                <PostCard key={r.id} post={r} isReply token={token} onMutate={onMutate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

/* ─── AI summary card ─── */
function SummaryCard({
  summary, loading, onRegenerate, regenerating,
}: {
  summary: DiscussionSummaryOut | null
  loading: boolean
  onRegenerate: () => void
  regenerating: boolean
}) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="rounded-xl bg-[#111318] border border-[#1E2028] px-3 py-2 flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
        <p className="text-[0.74rem] text-[#94A3B8]">Loading AI digest…</p>
      </div>
    )
  }

  const hasSummary = !!summary?.summary_md
  const canGen = !!summary?.can_generate

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#1A0F0A] to-[#111318] border border-[#FF5533]/20 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#FF5533]/5 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-[#FF5533]/15 text-[#FF7755] border border-[#FF5533]/30 flex items-center justify-center shrink-0">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#FF7755]">AI digest</p>
          <p className="text-[0.74rem] text-[#CBD5E1] truncate">
            {hasSummary
              ? `${summary?.is_stale ? 'Update available · ' : ''}from ${summary?.post_count_at_gen ?? 0} posts`
              : canGen ? 'Generate a digest of common questions' : 'Unlocks at 3+ posts'}
          </p>
        </div>
        <svg
          width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          className={`text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-[#FF5533]/15">
          {hasSummary ? (
            <div className="pt-2.5">
              <PostMarkdown source={summary!.summary_md!} />
              <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.66rem] text-[#475569]">
                <span>Generated {summary?.generated_at ? timeAgo(summary.generated_at) : '—'}</span>
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="text-[0.7rem] font-semibold text-[#FF7755] hover:text-[#FF5533] disabled:opacity-50"
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2.5 flex items-center justify-between gap-3">
              <p className="text-[0.74rem] text-[#94A3B8]">
                {canGen ? 'Generate a digest of common questions and top answers.' : '3+ posts unlock this digest.'}
              </p>
              {canGen && (
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="shrink-0 px-2.5 py-1 rounded-md bg-[#FF5533] text-white text-[0.7rem] font-semibold hover:bg-[#E64422] disabled:opacity-50 transition-colors"
                >
                  {regenerating ? 'Generating…' : 'Generate'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Modal shell + main component ─── */
export default function DiscussionSection({
  open, onClose, subsectionId, lessonTitle, token, onCountChange,
}: Props) {
  const [posts, setPosts] = useState<DiscussionPostOut[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [sort, setSort] = useState<DiscussionSort>('relevant')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [composer, setComposer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [summary, setSummary] = useState<DiscussionSummaryOut | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryRegenerating, setSummaryRegenerating] = useState(false)

  const fetchSummary = useCallback(async () => {
    if (!subsectionId) return
    setSummaryLoading(true)
    try {
      const s = await getDiscussionSummary(token, subsectionId)
      setSummary(s)
    } catch {
      // non-fatal
    } finally {
      setSummaryLoading(false)
    }
  }, [subsectionId, token])

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError('')
      try {
        const data = await listDiscussionPosts(token, subsectionId, sort, PAGE_SIZE, nextOffset)
        setTotal(data.total)
        onCountChange?.(data.total)
        setHasMore(data.has_more)
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]))
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load discussion')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [token, subsectionId, sort, onCountChange],
  )

  // Reload when modal opens, lesson changes, or sort changes.
  useEffect(() => {
    if (!open || !subsectionId) return
    setPosts([])
    setHasMore(false)
    fetchPage(0, true)
    fetchSummary()
  }, [open, subsectionId, sort, fetchPage, fetchSummary])

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleNewPost = useCallback(async () => {
    if (!composer.trim()) return
    setSubmitting(true)
    try {
      const created = await createDiscussionPost(token, subsectionId, composer.trim())
      setPosts((prev) => [created, ...prev])
      setTotal((t) => {
        const next = t + 1
        onCountChange?.(next)
        return next
      })
      setComposer('')
    } catch (e: any) {
      alert(e?.message ?? 'Failed to post')
    } finally {
      setSubmitting(false)
    }
  }, [composer, token, subsectionId, onCountChange])

  const handleMutate = useCallback(
    (action: 'replace' | 'delete' | 'add-reply', payload?: DiscussionPostOut, postId?: string) => {
      setPosts((prev) => {
        if (action === 'replace' && payload) {
          return prev.map((p) => {
            if (p.id === payload.id) return { ...payload, replies: p.replies }
            return { ...p, replies: p.replies.map((r) => (r.id === payload.id ? payload : r)) }
          })
        }
        if (action === 'delete' && postId) {
          return prev.map((p) => {
            if (p.id === postId) return { ...p, is_deleted: true, content: '*[deleted]*' }
            return { ...p, replies: p.replies.filter((r) => r.id !== postId) }
          })
        }
        if (action === 'add-reply' && payload && postId) {
          return prev.map((p) =>
            p.id === postId ? { ...p, replies: [...p.replies, payload], reply_count: p.reply_count + 1 } : p,
          )
        }
        return prev
      })
    },
    [],
  )

  const handleRegenerateSummary = useCallback(async () => {
    setSummaryRegenerating(true)
    try {
      const s = await regenerateDiscussionSummary(token, subsectionId)
      setSummary(s)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to generate summary')
    } finally {
      setSummaryRegenerating(false)
    }
  }, [token, subsectionId])

  const headingCount = useMemo(() => (total === 1 ? '1 post' : `${total} posts`), [total])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        onClick={onClose}
        aria-label="Close discussion"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <div className="relative ml-auto h-full w-full sm:w-[560px] md:w-[620px] lg:w-[680px] bg-[#0C0C0F] border-l border-[#1E2028] shadow-2xl flex flex-col animate-[slideIn_220ms_ease-out]">
        <style>{`
          @keyframes slideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `}</style>

        {/* Header */}
        <header className="shrink-0 px-5 py-3.5 border-b border-[#1E2028] bg-[#111318]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#475569]">Discussion</p>
              </div>
              <h3 className="text-[0.95rem] font-bold text-[#E2E8F0] truncate">{lessonTitle}</h3>
              <p className="text-[0.7rem] text-[#475569] mt-0.5">{headingCount}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as DiscussionSort)}
                className="bg-[#0F1117] border border-[#1E2028] text-[#CBD5E1] text-[0.74rem] rounded-md px-2 py-1 outline-none focus:border-[#FF5533]/40 cursor-pointer hover:border-[#252830] transition-colors"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-white hover:bg-[#1A1D25] transition-colors"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Composer (sticky-feel — sits above the scrolling feed) */}
        <div className="shrink-0 px-5 py-3 border-b border-[#1E2028] bg-[#0E1015] space-y-3">
          <SummaryCard
            summary={summary}
            loading={summaryLoading}
            onRegenerate={handleRegenerateSummary}
            regenerating={summaryRegenerating}
          />
          <Composer
            value={composer}
            onChange={setComposer}
            onSubmit={handleNewPost}
            submitting={submitting}
            placeholder="Ask a question or share what you learned…"
            submitLabel="Post"
            compact
          />
        </div>

        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[0.78rem]">
                {error}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#1A1D25] border border-[#252830] flex items-center justify-center mb-3">
                  <svg width="20" height="20" fill="none" stroke="#475569" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <p className="text-[0.84rem] font-semibold text-[#94A3B8]">No discussion yet</p>
                <p className="text-[0.72rem] text-[#475569] mt-1">Be the first to ask or share something.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} isReply={false} token={token} onMutate={handleMutate} />
                ))}

                {hasMore && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => fetchPage(posts.length, false)}
                      disabled={loadingMore}
                      className="px-3.5 py-1.5 rounded-lg bg-[#111318] border border-[#1E2028] text-[#CBD5E1] text-[0.76rem] font-semibold hover:border-[#252830] disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? 'Loading…' : `Load more (${total - posts.length} left)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
