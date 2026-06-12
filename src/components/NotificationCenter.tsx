import { useEffect, useState, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

export interface AppNotification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: any
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Request Web Push Permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!auth.currentUser) return

    const notifRef = collection(db, 'users', auth.currentUser.uid, 'notifications')
    const q = query(notifRef, orderBy('createdAt', 'desc'))

    let isInitialLoad = true

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AppNotification[] = []
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as AppNotification)
      })
      setNotifications(data)

      // Trigger Web Push for new unread notifications
      if (!isInitialLoad && 'Notification' in window && Notification.permission === 'granted') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data() as AppNotification
            if (!notif.read) {
              new Notification(notif.title, {
                body: notif.message,
                icon: '/logo.png'
              })
            }
          }
        })
      }
      isInitialLoad = false
    })

    return () => unsubscribe()
  }, [])

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

  const handleMarkAsRead = async (id: string) => {
    if (!auth.currentUser) return
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', id), {
        read: true
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', id))
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      >
        <i className="fa-regular fa-bell text-lg"></i>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {unreadCount} New
              </span>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <i className="fa-regular fa-bell-slash text-3xl mb-3 text-slate-300"></i>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map(n => (
                  <li 
                    key={n.id} 
                    className={`p-4 transition-colors hover:bg-slate-50 cursor-pointer ${n.read ? 'opacity-60' : 'bg-blue-50/30'}`}
                    onClick={() => !n.read && handleMarkAsRead(n.id)}
                  >
                    <div className="flex gap-3 justify-between items-start">
                      <div className="flex gap-3">
                        <div className="mt-1">
                          {n.read ? (
                            <i className="fa-solid fa-envelope-open text-slate-400"></i>
                          ) : (
                            <i className="fa-solid fa-envelope text-accent"></i>
                          )}
                        </div>
                        <div>
                          <h4 className={`text-sm ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                            {n.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                            {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                          </p>
                        </div>
                      </div>
                      
                      {n.read && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          title="Delete notification"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
