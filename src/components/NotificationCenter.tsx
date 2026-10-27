import { useEffect, useState, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../config/firebase'

export interface AppNotification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: any
  isBroadcast?: boolean
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return

    let userNotifs: AppNotification[] = []
    let broadcastNotifs: AppNotification[] = []

    const mergeAndSort = () => {
      const combined = [...userNotifs, ...broadcastNotifs].sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (typeof a.createdAt === 'number' ? a.createdAt : 0)
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (typeof b.createdAt === 'number' ? b.createdAt : 0)
        return timeB - timeA
      })
      setNotifications(combined)
    }

    // 1. Subscribe to Global Broadcasts
    let unsubBroadcasts: (() => void) | undefined
    try {
      const bQuery = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(10))
      unsubBroadcasts = onSnapshot(bQuery, (snapshot) => {
        const data: AppNotification[] = []
        snapshot.forEach((d) => {
          const item = d.data()
          if (item.active !== false) {
            data.push({
              id: d.id,
              title: item.title || 'Broadcast',
              message: item.message || '',
              read: false,
              createdAt: item.createdAt,
              isBroadcast: true,
            })
          }
        })
        broadcastNotifs = data
        mergeAndSort()
      }, () => {})
    } catch {}

    // 2. Subscribe to User-Specific Notifications
    let unsubUserNotifs: (() => void) | undefined
    if (auth.currentUser) {
      try {
        const notifRef = collection(db, 'users', auth.currentUser.uid, 'notifications')
        const q = query(notifRef, orderBy('createdAt', 'desc'), limit(15))
        unsubUserNotifs = onSnapshot(q, (snapshot) => {
          const data: AppNotification[] = []
          snapshot.forEach((d) => {
            data.push({ id: d.id, ...d.data(), isBroadcast: false } as AppNotification)
          })
          userNotifs = data
          mergeAndSort()
        }, () => {})
      } catch {}
    }

    return () => {
      if (unsubBroadcasts) unsubBroadcasts()
      if (unsubUserNotifs) unsubUserNotifs()
    }
  }, [auth.currentUser])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (n: AppNotification) => {
    if (n.isBroadcast) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      return
    }
    if (!auth.currentUser) return
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', n.id), {
        read: true,
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (n: AppNotification) => {
    if (n.isBroadcast) {
      setNotifications((prev) => prev.filter((item) => item.id !== n.id))
      return
    }
    if (!auth.currentUser) return
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', n.id))
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
        aria-label="View notifications"
      >
        <i className="fa-solid fa-bell text-sm"></i>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto sm:right-0 top-[65px] sm:top-full sm:mt-2 bg-white border border-zinc-200/80 shadow-[0_12px_32px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden z-50 animate-in fade-in duration-150 w-auto sm:w-84">
          <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xs text-zinc-900 uppercase tracking-wider">Alerts & Broadcasts</h3>
              {unreadCount > 0 && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.2 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 space-y-1.5">
                <i className="fa-solid fa-bell-slash text-2xl text-zinc-300 mb-1"></i>
                <p className="text-xs font-bold text-zinc-700">No Notifications</p>
                <p className="text-[11px] text-zinc-400">All system broadcasts and alerts will appear here</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleMarkAsRead(n)}
                  className={`p-3.5 transition-colors hover:bg-zinc-50 cursor-pointer flex gap-3 items-start justify-between ${
                    n.read ? 'opacity-60' : 'bg-white'
                  }`}
                >
                  <div className="flex gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                        n.isBroadcast
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      <i className={`fa-solid ${n.isBroadcast ? 'fa-bullhorn' : 'fa-envelope'}`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-black text-zinc-900 truncate">{n.title}</span>
                        {n.isBroadcast && (
                          <span className="text-[9px] font-bold bg-zinc-900 text-white px-1.5 py-0.2 rounded">
                            Broadcast
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 font-medium leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-1">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(n)
                    }}
                    className="text-zinc-300 hover:text-rose-600 transition-colors p-1 shrink-0 cursor-pointer"
                    title="Dismiss alert"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
