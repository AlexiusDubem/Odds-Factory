/**
 * UpdatePrompt
 * ─────────────
 * Detects when the service worker has downloaded a new version of the app
 * and shows a polished bottom-sheet banner prompting the user to reload.
 *
 * Uses vite-plugin-pwa's `useRegisterSW` hook which is generated at build time.
 * Works on all browsers / installed PWAs on iOS and Android.
 */

import { useRegisterSW } from 'virtual:pwa-register/react'
import { useState, useEffect } from 'react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Poll for updates every 60 seconds when the app is open
      if (r) {
        setInterval(() => r.update(), 60_000)
      }
    },
  })

  const [dismissed, setDismissed] = useState(false)

  // Auto-dismiss if user ignores for 30 s (they'll see it again next open)
  useEffect(() => {
    if (!needRefresh) return
    const t = setTimeout(() => setDismissed(true), 30_000)
    return () => clearTimeout(t)
  }, [needRefresh])

  if (!needRefresh || dismissed) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm"
      style={{ animation: 'slideUpFade 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translate(-50%, 24px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <div className="flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-black/40 px-4 py-3.5 border border-white/10">
        {/* Icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
          <i className="fa-solid fa-rotate text-green-400 text-sm" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">New update available</p>
          <p className="text-xs text-slate-400 leading-tight mt-0.5">Tap to get the latest features</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Dismiss"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-green-500 hover:bg-green-400 active:scale-95 transition-all text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-lg shadow-green-500/30 whitespace-nowrap"
          >
            Update now
          </button>
        </div>
      </div>
    </div>
  )
}
