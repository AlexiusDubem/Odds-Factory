import { Link } from 'react-router-dom'
import { auth, isFirebaseConfigured } from '../config/firebase'
import { signOut } from 'firebase/auth'

const ADMIN_EMAIL = 'alexiusdubem7@gmail.com'

export const ProfilePanel = () => {
  const user = auth.currentUser
  const isAdmin = Boolean(user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL)

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out of Odds Factory?')) {
      if (isFirebaseConfigured) {
        signOut(auth)
      } else {
        window.location.reload()
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 font-sans animate-in fade-in duration-300">
      {/* ── Page Intro ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="font-mono text-[10px] uppercase font-bold tracking-[0.08em] text-[#84918a]">
          Account
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-1.5px] text-[#16201c] leading-[1.12]">
          Your preferences.
        </h2>
        <p className="text-xs sm:text-sm text-[#71807a] max-w-xl leading-relaxed">
          Control how Odds Factory presents markets, executes smart drops, and measures ticket survival probability.
        </p>
      </section>

      {/* ── User Identity Card ─────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 sm:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-950 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-md shrink-0">
              {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'P'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <i className="fa-solid fa-crown text-[9px] text-amber-500"></i>
                  Pro Member
                </span>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                  Verified Punter
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 truncate">
                {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Odds Factory Punter')}
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                {user?.email || 'guest@oddsfactory.local'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLogout}
              className="py-2.5 px-4 bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 text-zinc-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-zinc-200/60"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Admin Command Card (Strictly for alexiusdubem7@gmail.com) ── */}
      {isAdmin && (
        <div className="bg-[#183b2d] border border-[#2d5543] rounded-[24px] p-6 sm:p-7 shadow-sm text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-black/30 text-[#dfff46] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-[#dfff46]/20">
                <i className="fa-solid fa-shield-halved text-[9px]"></i>
                Superadmin Clearance
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Platform Command Center
            </h3>
            <p className="text-xs text-[#b4d4bd] font-medium">
              Monitor active users, telemetry, dropped picks, and dispatch real-time notifications.
            </p>
          </div>

          <Link
            to="/control"
            className="py-3 px-5 bg-[#dfff46] hover:bg-[#d4f53f] text-[#16201c] font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 shadow-xs"
          >
            <i className="fa-solid fa-sliders text-xs"></i>
            <span>Open Command Center</span>
          </Link>
        </div>
      )}

      {/* ── Two-Column Stats Bento ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Betting DNA */}
        <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.02)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <i className="fa-solid fa-dna text-emerald-600"></i>
            Betting Style & DNA
          </h3>

          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-600 mb-1">
                <span>Risk Tolerance</span>
                <span className="text-emerald-600 font-black">Balanced (Level 3)</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%] rounded-full"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-600 mb-1">
                <span>Primary Sport</span>
                <span className="text-blue-600 font-black">Football (SportyBet)</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[95%] rounded-full"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-600 mb-1">
                <span>Favorite Market</span>
                <span className="text-indigo-600 font-black">Double Chance & Corners</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[78%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription & Capabilities */}
        <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.02)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <i className="fa-solid fa-layer-group text-blue-600"></i>
            Membership Features
          </h3>

          <div className="space-y-2 text-xs font-semibold">
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200/60">
              <span className="text-zinc-700">SportyBet Live Booking</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-check text-[10px]"></i> Unlimited
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200/60">
              <span className="text-zinc-700">AI Neural Challenger</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-check text-[10px]"></i> Active
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200/60">
              <span className="text-zinc-700">Midnight Odds Access</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-check text-[10px]"></i> Enabled
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200/60">
              <span className="text-zinc-700">Multi-Market Discovery</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <i className="fa-solid fa-check text-[10px]"></i> 12 Families
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
