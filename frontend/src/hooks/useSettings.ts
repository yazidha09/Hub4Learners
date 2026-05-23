import { useState, useEffect, useCallback } from 'react'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  notif_friendRequest: boolean
  notif_messages: boolean
  notif_enrollment: boolean
  notif_announcements: boolean
  notif_roleChanges: boolean
  notif_sounds: boolean
  profileVisibility: 'public' | 'friends' | 'private'
  showOnlineStatus: boolean
  allowFriendRequests: boolean
}

const DEFAULTS: AppSettings = {
  theme: 'system',
  compactMode: false,
  notif_friendRequest: true,
  notif_messages: true,
  notif_enrollment: true,
  notif_announcements: true,
  notif_roleChanges: true,
  notif_sounds: false,
  profileVisibility: 'public',
  showOnlineStatus: true,
  allowFriendRequests: true,
}

const STORAGE_KEY = 'h4l_settings'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function applyCompact(compact: boolean) {
  document.documentElement.classList.toggle('compact', compact)
}

/** Call once before React mounts to prevent dark-mode flash. */
export function applyStoredSettings() {
  const s = loadSettings()
  applyTheme(s.theme)
  applyCompact(s.compactMode)
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    applyTheme(settings.theme)
    applyCompact(settings.compactMode)
  }, [settings.theme, settings.compactMode])

  // Track system preference changes when theme === 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
