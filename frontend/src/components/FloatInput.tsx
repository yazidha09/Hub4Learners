import { useState } from 'react'

interface FloatInputProps {
  label: string
  name: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function FloatInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
}: FloatInputProps) {
  const [showPass, setShowPass] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPass ? 'text' : 'password') : type
  const lifted = value.length > 0

  return (
    <div className="relative mb-7">
      <input
        id={name}
        name={name}
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete="off"
        className="
          peer w-full bg-transparent border-b border-white/10
          pt-5 pb-2 pr-9 text-slate-100 text-[15px] font-light
          placeholder-transparent focus:outline-none
          transition-colors duration-300
          focus:border-transparent
        "
      />

      {/* Floating label */}
      <label
        htmlFor={name}
        className={`
          absolute left-0 pointer-events-none font-light
          transition-all duration-200 ease-out
          ${lifted
            ? 'top-0 text-[11px] text-violet-400'
            : 'top-[18px] text-[15px] text-white/30 peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-violet-400'
          }
        `}
      >
        {label}
      </label>

      {/* Animated bottom line */}
      <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-violet-600 to-sky-400 transition-[width] duration-300 ease-out peer-focus:w-full" />

      {/* Static bottom line */}
      <div className="absolute bottom-0 left-0 h-px w-full bg-white/10" />

      {/* Password toggle */}
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPass(s => !s)}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-white/25 hover:text-white/60 transition-colors"
        >
          {showPass ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
