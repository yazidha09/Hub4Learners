import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { updateProfile } from '../api/auth'
import type { UpdateProfileData } from '../api/auth'
import { listCategories, type CategoryOut } from '../api/category'
import Modal from './Modal'
import { useNotifications, type AppNotification, type NotificationType } from '../hooks/useNotifications'
import { useSettings } from '../hooks/useSettings'

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

const NOTIF_ICONS: Record<NotificationType | string, React.ReactNode> = {
  friend_request: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  friend_request_reviewed: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  ),
  friend_message: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  chat_request: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  chat_request_reviewed: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  enrollment: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  role_changed: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  ),
  announcement: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  ),
}

const NOTIF_COLORS: Record<NotificationType | string, string> = {
  friend_request:          'bg-blue-100 text-blue-600',
  friend_request_reviewed: 'bg-emerald-100 text-emerald-600',
  friend_message:          'bg-violet-100 text-violet-600',
  chat_request:            'bg-amber-100 text-amber-600',
  chat_request_reviewed:   'bg-sky-100 text-sky-600',
  enrollment:              'bg-teal-100 text-teal-600',
  role_changed:            'bg-purple-100 text-purple-600',
  announcement:            'bg-orange-100 text-orange-500',
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors border-none cursor-pointer shrink-0 ${
        checked ? 'bg-[#0C0C0F]' : 'bg-[#D1D5DB]'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'left-5' : 'left-1'
        }`}
      />
    </button>
  )
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function NotificationPanel({
  notifications,
  onDismiss,
  onMarkOneRead,
  onClearAll,
  onClose,
  anchorRect,
}: {
  notifications: AppNotification[]
  onDismiss: (id: string) => void
  onMarkOneRead: (id: string) => void
  onClearAll: () => void
  onClose: () => void
  anchorRect: DOMRect | null
}) {
  const unread = notifications.filter(n => !n.read).length
  const PANEL_WIDTH = 340
  const left = anchorRect ? Math.max(8, anchorRect.left - PANEL_WIDTH + anchorRect.width) : 8
  const bottom = anchorRect ? window.innerHeight - anchorRect.top + 8 : 80

  return createPortal(
    <div
      data-notif-panel
      className="fixed z-[9999] w-[340px] bg-white rounded-2xl overflow-hidden"
      style={{
        left,
        bottom,
        animation: 'fadeInUp 0.16s ease-out',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -8px rgba(0,0,0,0.22)',
        border: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[0.82rem] font-bold text-[#0C0C0F]">Notifications</span>
          {unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#FF5533] text-white text-[9px] font-bold leading-none">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[0.68rem] text-slate-400 hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-red-50"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 bg-transparent border-none cursor-pointer transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-4" />

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-[0.78rem] font-medium text-slate-400">You're all caught up</p>
            <p className="text-[0.7rem] text-slate-300 mt-0.5">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n, i) => (
            <div
              key={n.id}
              onClick={() => { if (!n.read) onMarkOneRead(n.id) }}
              className={`flex items-start gap-3 px-4 py-3.5 transition-colors group cursor-pointer relative ${
                !n.read ? 'bg-orange-50/50 hover:bg-orange-50' : 'hover:bg-slate-50'
              } ${i < notifications.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              {/* Unread bar */}
              {!n.read && (
                <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-[#FF5533]" />
              )}

              {/* Icon */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${NOTIF_COLORS[n.type] ?? 'bg-slate-100 text-slate-400'}`}>
                {NOTIF_ICONS[n.type] ?? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-1">
                <p className={`text-[0.77rem] leading-snug truncate ${!n.read ? 'font-semibold text-[#0C0C0F]' : 'font-medium text-slate-700'}`}>
                  {n.title}
                </p>
                <p className="text-[0.71rem] text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                <p className="text-[0.63rem] text-slate-300 mt-1.5 font-medium">{timeAgo(n.timestamp)}</p>
              </div>

              {/* Dismiss */}
              <button
                onClick={e => { e.stopPropagation(); onDismiss(n.id) }}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-400 bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                title="Dismiss"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  )
}

export default function DashboardLayout({
  children,
  navItems,
  activeNav,
  onNavChange,
  roleLabel,
  settingsExtra,
}: {
  children: React.ReactNode
  navItems: NavItem[]
  activeNav: string
  onNavChange: (id: string) => void
  roleLabel: string
  settingsExtra?: React.ReactNode
}) {
  const { user, token, logout, refreshUser } = useAuth()
  const { settings, updateSettings } = useSettings()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security' | 'appearance' | 'notifications' | 'privacy'>('profile')
  const [saving, setSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const [bellRect, setBellRect] = useState<DOMRect | null>(null)
  const { notifications, unreadCount, markAllRead, markOneRead, dismiss, clearAll } = useNotifications(user?.id, token)

  // Profile form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [speciality, setSpeciality] = useState('')
  const [categories, setCategories] = useState<CategoryOut[]>([])

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!notifOpen) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      const insideBell = notifRef.current?.contains(target)
      const insidePanel = (target as Element)?.closest?.('[data-notif-panel]')
      if (!insideBell && !insidePanel) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const initials = user?.full_name
    ?.split(' ')
    .filter(Boolean)
    .map(p => p[0]!.toUpperCase())
    .slice(0, 2)
    .join('') || 'U'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const openSettings = () => {
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
    setBio(user?.bio || '')
    setSpeciality(user?.speciality || '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSettingsMsg(null)
    setSettingsTab('profile')
    setSettingsOpen(true)

    listCategories().then(setCategories).catch(() => {})
  }

  const handleSaveProfile = async () => {
    if (!token) return
    setSaving(true)
    setSettingsMsg(null)
    try {
      const data: UpdateProfileData = {}
      if (fullName !== user?.full_name) data.full_name = fullName
      if (email !== user?.email) data.email = email
      if (bio !== (user?.bio || '')) data.bio = bio
      if (speciality !== (user?.speciality || '')) data.speciality = speciality
      await updateProfile(token, data)
      refreshUser()
      setSettingsMsg({ type: 'success', text: 'Profile updated successfully' })
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!token) return
    if (newPassword !== confirmPassword) {
      setSettingsMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (newPassword.length < 6) {
      setSettingsMsg({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    setSaving(true)
    setSettingsMsg(null)
    try {
      await updateProfile(token, { current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSettingsMsg({ type: 'success', text: 'Password changed successfully' })
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const sidebar = (
    <>
      <div className="px-5 pt-6 pb-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#FF5533] shrink-0" />
        <span className="text-[0.72rem] font-bold text-white/60 tracking-[0.08em] uppercase">H4L</span>
      </div>
      <div className="px-5 pb-6">
        <span className="text-[0.6rem] font-bold tracking-[0.14em] uppercase text-[#FF5533]/50">{roleLabel}</span>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { onNavChange(item.id); setMobileOpen(false) }}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-[0.8rem] font-medium border-none cursor-pointer transition-all w-full text-left bg-transparent ${
              activeNav === item.id
                ? 'text-white bg-white/[0.07]'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
            }`}
          >
            <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{item.icon}</span>
            {item.label}
            {activeNav === item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF5533]" />}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/[0.08] text-white/70 flex items-center justify-center text-[0.7rem] font-semibold uppercase shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.78rem] text-white/70 font-medium truncate">{user?.full_name}</div>
          <button
            onClick={handleLogout}
            className="text-[0.68rem] text-white/25 hover:text-[#FF5533] transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            Sign out
          </button>
        </div>
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <div ref={notifRef}>
            <button
              ref={bellRef}
              onClick={() => {
                setNotifOpen(o => {
                  if (!o) {
                    markAllRead()
                    setBellRect(bellRef.current?.getBoundingClientRect() ?? null)
                  }
                  return !o
                })
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all bg-transparent border-none cursor-pointer relative"
              title="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF5533] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel
                notifications={notifications}
                onDismiss={dismiss}
                onMarkOneRead={markOneRead}
                onClearAll={() => { clearAll(); setNotifOpen(false) }}
                onClose={() => setNotifOpen(false)}
                anchorRect={bellRect}
              />
            )}
          </div>
          {/* Settings */}
          <button
            onClick={openSettings}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all bg-transparent border-none cursor-pointer"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-[#F6F8FB] text-[#0C0C0F]">
      <aside className="hidden md:flex w-[230px] bg-gradient-to-b from-[#0B0C10] via-[#0E1018] to-[#0F111A] flex-col shrink-0 h-screen sticky top-0 shadow-[0_20px_60px_rgba(0,0,0,0.45)] border-r border-white/5">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div 
          className="fixed inset-0 z-50 md:hidden flex"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileOpen(false)} 
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          />
          <aside 
            className="relative w-[260px] bg-gradient-to-b from-[#0B0C10] via-[#0E1018] to-[#0F111A] flex flex-col h-full shadow-2xl"
            style={{ animation: 'slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur border-b border-[#E5E7EB] sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center bg-white border border-[#E5E7EB] rounded-lg cursor-pointer text-[#0C0C0F] shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />
          <span className="text-[0.72rem] font-bold text-[#0C0C0F] tracking-[0.08em] uppercase">H4L</span>
        </div>

        <main className="flex-1 overflow-y-auto relative">
          <div className="relative z-[1]">{children}</div>
        </main>
      </div>

      {/* Settings Modal */}
      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" size="lg">
        {/* Tab bar — 5 tabs */}
        <div className="flex gap-1 mb-6 bg-[#F1F3F5] rounded-lg p-1">
          {(
            [
              { id: 'profile',       label: 'Profile' },
              { id: 'security',      label: 'Security' },
              { id: 'appearance',    label: 'Appearance' },
              { id: 'notifications', label: 'Notifs' },
              { id: 'privacy',       label: 'Privacy' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => { setSettingsTab(tab.id); setSettingsMsg(null) }}
              className={`flex-1 py-2 text-[0.75rem] font-medium rounded-md transition-all border-none cursor-pointer ${
                settingsTab === tab.id
                  ? 'bg-white text-[#0C0C0F] shadow-sm'
                  : 'bg-transparent text-[#94A3B8] hover:text-[#0C0C0F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status message */}
        {settingsMsg && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-[0.82rem] font-medium ${
            settingsMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {settingsMsg.text}
          </div>
        )}

        {/* ── Profile tab ── */}
        {settingsTab === 'profile' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-full bg-[#0C0C0F] text-white flex items-center justify-center text-[1rem] font-semibold uppercase shrink-0">
                {initials}
              </div>
              <div>
                <div className="text-[0.88rem] font-semibold text-[#0C0C0F]">{user?.full_name}</div>
                <div className="text-[0.72rem] text-[#94A3B8] capitalize">{user?.role}</div>
              </div>
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us about yourself..."
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] resize-none"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Speciality / Field of Study</label>
              <select
                value={speciality}
                onChange={e => setSpeciality(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] bg-white cursor-pointer"
              >
                <option value="">— None —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {settingsExtra && (
              <div className="pt-2 mt-2 border-t border-[#E5E7EB]">
                {settingsExtra}
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-2 h-10 bg-[#0C0C0F] text-white text-[0.82rem] font-medium rounded-lg hover:bg-[#1E1E23] transition-colors disabled:bg-[#D1D5DB] disabled:cursor-not-allowed border-none cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* ── Security tab ── */}
        {settingsTab === 'security' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]"
              />
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]"
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              className="mt-2 h-10 bg-[#0C0C0F] text-white text-[0.82rem] font-medium rounded-lg hover:bg-[#1E1E23] transition-colors disabled:bg-[#D1D5DB] disabled:cursor-not-allowed border-none cursor-pointer"
            >
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        )}

        {/* ── Appearance tab ── */}
        {settingsTab === 'appearance' && (
          <div className="flex flex-col gap-5">
            {/* Theme */}
            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      value: 'light' as const,
                      label: 'Light',
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"/>
                          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      ),
                    },
                    {
                      value: 'dark' as const,
                      label: 'Dark',
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      ),
                    },
                    {
                      value: 'system' as const,
                      label: 'System',
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          <line x1="8" y1="21" x2="16" y2="21"/>
                          <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                      ),
                    },
                  ]
                ).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateSettings({ theme: opt.value })}
                    className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer ${
                      settings.theme === opt.value
                        ? 'border-[#0C0C0F] bg-[#0C0C0F] text-white'
                        : 'border-[#E5E7EB] bg-white text-[#94A3B8] hover:border-[#0C0C0F] hover:text-[#0C0C0F]'
                    }`}
                  >
                    {opt.icon}
                    <span className="text-[0.72rem] font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact mode */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <div>
                <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">Compact Mode</div>
                <div className="text-[0.72rem] text-[#94A3B8] mt-0.5">Reduce spacing for a denser layout</div>
              </div>
              <ToggleSwitch
                checked={settings.compactMode}
                onChange={v => updateSettings({ compactMode: v })}
              />
            </div>

            {/* Font size */}
            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Font Size</label>
              <div className="flex gap-2">
                {(['Small', 'Normal', 'Large'] as const).map((size, i) => {
                  const vals = ['small', 'normal', 'large'] as const
                  const current = (settings as any).fontSize ?? 'normal'
                  return (
                    <button
                      key={size}
                      onClick={() => updateSettings({ ...(settings as any), fontSize: vals[i] } as any)}
                      className={`flex-1 h-9 rounded-lg border text-[0.78rem] font-medium transition-all cursor-pointer ${
                        current === vals[i]
                          ? 'border-[#0C0C0F] bg-[#0C0C0F] text-white'
                          : 'border-[#E5E7EB] bg-white text-[#94A3B8] hover:border-[#0C0C0F] hover:text-[#0C0C0F]'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reduce animations */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <div>
                <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">Reduce Animations</div>
                <div className="text-[0.72rem] text-[#94A3B8] mt-0.5">Minimize motion effects across the app</div>
              </div>
              <ToggleSwitch
                checked={(settings as any).reduceMotion ?? false}
                onChange={v => updateSettings({ ...(settings as any), reduceMotion: v } as any)}
              />
            </div>
          </div>
        )}

        {/* ── Notifications tab ── */}
        {settingsTab === 'notifications' && (
          <div className="flex flex-col gap-2">
            <p className="text-[0.75rem] text-[#94A3B8] mb-2">Choose which notifications you want to receive.</p>
            {(
              [
                { key: 'notif_friendRequest' as const, label: 'Friend Requests', desc: 'When someone sends you a friend request' },
                { key: 'notif_messages' as const,       label: 'Messages',        desc: 'When you receive a new message' },
                { key: 'notif_enrollment' as const,     label: 'Enrollment',      desc: 'Updates about your course enrollments' },
                { key: 'notif_announcements' as const,  label: 'Announcements',   desc: 'Platform-wide announcements' },
                { key: 'notif_roleChanges' as const,    label: 'Role Changes',    desc: 'When your account role is updated' },
                { key: 'notif_sounds' as const,         label: 'Sound Effects',   desc: 'Play a sound for incoming notifications' },
              ]
            ).map(item => (
              <div
                key={item.key}
                className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">{item.label}</div>
                  <div className="text-[0.7rem] text-[#94A3B8] mt-0.5">{item.desc}</div>
                </div>
                <ToggleSwitch
                  checked={settings[item.key]}
                  onChange={v => updateSettings({ [item.key]: v })}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Privacy tab ── */}
        {settingsTab === 'privacy' && (
          <div className="flex flex-col gap-4">
            {/* Profile visibility */}
            <div>
              <label className="block text-[0.7rem] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Profile Visibility</label>
              <select
                value={settings.profileVisibility}
                onChange={e => updateSettings({ profileVisibility: e.target.value as any })}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.85rem] text-[#0C0C0F] outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] bg-white cursor-pointer"
              >
                <option value="public">Public — Anyone can view your profile</option>
                <option value="friends">Friends Only — Only your connections</option>
                <option value="private">Private — Only you can see your profile</option>
              </select>
            </div>

            {/* Show online status */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <div>
                <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">Show Online Status</div>
                <div className="text-[0.72rem] text-[#94A3B8] mt-0.5">Let others see when you're active</div>
              </div>
              <ToggleSwitch
                checked={settings.showOnlineStatus}
                onChange={v => updateSettings({ showOnlineStatus: v })}
              />
            </div>

            {/* Allow friend requests */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <div>
                <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">Allow Friend Requests</div>
                <div className="text-[0.72rem] text-[#94A3B8] mt-0.5">Let other users send you friend requests</div>
              </div>
              <ToggleSwitch
                checked={settings.allowFriendRequests}
                onChange={v => updateSettings({ allowFriendRequests: v })}
              />
            </div>

            {/* Activity visibility */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
              <div>
                <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">Show Learning Activity</div>
                <div className="text-[0.72rem] text-[#94A3B8] mt-0.5">Display your course progress on your profile</div>
              </div>
              <ToggleSwitch
                checked={(settings as any).showActivity ?? true}
                onChange={v => updateSettings({ ...(settings as any), showActivity: v } as any)}
              />
            </div>

            <div className="mt-1 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-[0.72rem] text-amber-700">
                Privacy settings are stored locally. Server-side enforcement will be available in a future update.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
