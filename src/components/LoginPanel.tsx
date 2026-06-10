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
      setError(err.message || 'Authentication failed. Please try again.')
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
    <div className="flex flex-col items-center justify-center py-24 px-4 w-full">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-accent to-blue-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
            <i className="fa-solid fa-bolt text-2xl text-white drop-shadow-sm" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Odds Factory</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">Log in to track and optimize your slips</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full py-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isGoogleLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-slate-400" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="w-5 h-5" />
            )}
            Continue with Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-semibold">Or</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="enter your email..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-semibold transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? <i className="fa-solid fa-circle-notch fa-spin text-accent" /> : <i className="fa-solid fa-arrow-right-to-bracket text-accent" />}
            {isRegistering ? 'Create Account' : 'Sign In with Email'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(null) }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  )
}
