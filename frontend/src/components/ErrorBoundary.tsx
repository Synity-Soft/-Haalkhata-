import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 max-w-xl mx-auto rounded-3xl bg-card border border-border shadow-card text-text text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-accent">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black mb-2 text-text">
            {this.props.fallbackTitle || 'অ্যাপে একটি সমস্যা দেখা দিয়েছে'}
          </h2>
          <p className="text-sm text-text-secondary mb-5 leading-relaxed">
            চিন্তার কিছু নেই, আপনার পূর্বের সকল তথ্য ও হিসাব সংরক্ষিত রয়েছে। পুনরায় চেষ্টা করতে নিচের বোতামটি চাপুন।
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-accent text-[#493522] font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>আবার চেষ্টা করুন</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border bg-background-secondary text-text text-xs font-semibold hover:border-accent/40 transition-all"
            >
              পেজ রিফ্রেশ করুন
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
