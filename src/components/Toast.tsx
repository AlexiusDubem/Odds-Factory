import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  error: 'fa-solid fa-circle-xmark',
  info: 'fa-solid fa-circle-info',
}

const COLORS: Record<ToastType, { bar: string; icon: string; bg: string; border: string; title: string }> = {
  success: {
    bar: 'bg-emerald-500',
    icon: 'text-emerald-500',
    bg: 'bg-white',
    border: 'border-emerald-200',
    title: 'text-emerald-900',
  },
  warning: {
    bar: 'bg-amber-400',
    icon: 'text-amber-500',
    bg: 'bg-white',
    border: 'border-amber-200',
    title: 'text-amber-900',
  },
  error: {
    bar: 'bg-red-500',
    icon: 'text-red-500',
    bg: 'bg-white',
    border: 'border-red-200',
    title: 'text-red-900',
  },
  info: {
    bar: 'bg-blue-500',
    icon: 'text-blue-500',
    bg: 'bg-white',
    border: 'border-blue-200',
    title: 'text-blue-900',
  },
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const c = COLORS[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-xl shadow-lg border ${c.bg} ${c.border} overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200`}
    >
      {/* colour bar */}
      <div className={`w-1 self-stretch shrink-0 ${c.bar}`} />
      <i className={`${ICONS[toast.type]} ${c.icon} mt-3.5 text-base shrink-0`} />
      <div className="flex-1 py-3 pr-2">
        <p className={`text-sm font-semibold ${c.title}`}>{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-2 mt-2 mr-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      >
        <i className="fa-solid fa-xmark text-xs" />
      </button>
    </div>
  )
}

// ─── Container ────────────────────────────────────────────────────────────────

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (type: ToastType, title: string, description?: string) => {
      const id = `toast-${Date.now()}-${counterRef.current++}`
      setToasts((prev) => [...prev.slice(-4), { id, type, title, description }])
    },
    []
  )

  return { toasts, toast, dismiss }
}
