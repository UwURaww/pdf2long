import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 font-mono">
          <div className="max-w-md w-full border-4 border-red-500 p-8 text-center bg-white dark:bg-black">
            <div className="text-red-500 flex justify-center mb-6">
              <AlertCircle size={64} />
            </div>
            <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter text-red-500">SYSTEM CRASH</h2>
            <p className="text-sm mb-8 uppercase opacity-70">
              The browser ran out of memory or encountered a fatal error. 
              PDFs with 1000+ pages or extreme resolution can be too much for some devices.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold border-2 border-transparent hover:border-current transition-all flex items-center justify-center gap-2 uppercase"
            >
              <RefreshCw size={20} />
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
