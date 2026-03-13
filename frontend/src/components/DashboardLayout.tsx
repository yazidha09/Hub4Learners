import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

export default function DashboardLayout({
  children,
  navItems,
  activeNav,
  onNavChange,
  roleLabel,
}: {
  children: React.ReactNode
  navItems: NavItem[]
  activeNav: string
  onNavChange: (id: string) => void
  roleLabel: string
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

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
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <aside className="hidden md:flex w-[220px] bg-[#0C0C0F] flex-col shrink-0 h-screen sticky top-0">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[220px] bg-[#0C0C0F] flex flex-col h-full">{sidebar}</aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E5E7EB]">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-[#0C0C0F]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />
          <span className="text-[0.72rem] font-bold text-[#0C0C0F] tracking-[0.08em] uppercase">H4L</span>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
