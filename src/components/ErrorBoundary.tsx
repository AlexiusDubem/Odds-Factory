import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    // Clear stale service worker caches and hard reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name)
        }
      })
    }
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-6">
            <i className="fa-solid fa-triangle-exclamation text-3xl text-red-400"></i>
          </div>

          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            The application encountered a temporary display issue. Click below to clear cache and refresh.
          </p>

          {this.state.error && (
            <div className="bg-slate-800/80 border border-slate-700 text-xs text-slate-300 font-mono p-3 rounded-xl max-w-lg overflow-x-auto text-left mb-6 w-full">
              {this.state.error.message}
            </div>
          )}

          <button
            onClick={this.handleReload}
            className="bg-accent hover:bg-emerald-400 active:scale-95 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-rotate"></i>
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
