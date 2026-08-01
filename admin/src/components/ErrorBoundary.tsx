import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-red-100 dark:border-red-900/20 p-12 text-center max-w-md shadow-2xl">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              We encountered a runtime error while rendering this page.
              <br />
              <span className="text-xs font-mono text-red-400 mt-2 block overflow-hidden text-ellipsis">
                {this.state.error?.message}
              </span>
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
            >
              <RefreshCw size={20} />
              Reboot Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
