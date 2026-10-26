import React, { useState } from 'react'
import { auth, googleProvider } from '../config/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'

export const LoginPanel: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please verify credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Google sign in failed. Please try again.')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 w-full font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_2px_24px_rgba(0,0,0,0.04)] border border-[#e5e9e5] p-8 sm:p-10 space-y-6">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Odds Factory"
            className="w-16 h-16 object-contain rounded-2xl mx-auto mb-4 shadow-xs"
          />
          <h2 className="text-2xl font-extrabold text-[#16201c] tracking-tight">Odds Factory</h2>
          <p className="text-xs text-[#71807a] mt-1.5 font-medium">
            Sign in to access your calibrated models and optimization vault
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full py-3 px-4 rounded-xl bg-white border border-[#e5e9e5] hover:bg-[#f7f8f4] text-[#16201c] font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-zinc-400" />
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
                className="w-4 h-4"
              />
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#e5e9e5]"></div>
            <span className="flex-shrink-0 mx-3 text-[#8a9690] text-[10px] uppercase font-mono font-bold">
              Or
            </span>
            <div className="flex-grow border-t border-[#e5e9e5]"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-[#8a9690] uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a9690] text-xs" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#fbfcf9] border border-[#e5e9e5] rounded-xl text-xs font-medium text-[#16201c] focus:outline-none focus:border-[#183b2d] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-[#8a9690] uppercase tracking-wider block">
              Password
            </label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a9690] text-xs" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#fbfcf9] border border-[#e5e9e5] rounded-xl text-xs font-medium text-[#16201c] focus:outline-none focus:border-[#183b2d] focus:bg-white transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3 rounded-xl bg-[#16201c] hover:bg-[#22332c] text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-[#dfff46]" />
            ) : (
              <i className="fa-solid fa-arrow-right-to-bracket text-[#dfff46]" />
            )}
            <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering)
              setError(null)
            }}
            className="text-xs font-semibold text-[#71807a] hover:text-[#16201c] transition-colors cursor-pointer"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  )
}
