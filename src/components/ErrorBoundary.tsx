import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { AppTheme } from '../types';

interface ErrorBoundaryProps {
  children: ReactNode;
  theme?: AppTheme;
  sectionLabel?: string;
  onResetToHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Prevents localized UI/telemetry rendering exceptions (e.g. malformed GPX data or map errors)
 * from whitescreening the active cockpit or crew map mid-ride.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.sectionLabel || 'App'}]`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isLight = this.props.theme === 'light';

    return (
      <div
        className={`w-full min-h-[260px] flex items-center justify-center p-4 ${
          isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#080c10] text-white'
        }`}
      >
        <div
          className={`w-full max-w-md rounded-2xl border p-5 shadow-xl space-y-4 text-center font-sans ${
            isLight
              ? 'bg-white border-rose-200 text-slate-800'
              : 'bg-[#0d131a] border-rose-500/40 text-slate-100'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="font-heading font-black text-base uppercase tracking-wide">
              {this.props.sectionLabel ? `${this.props.sectionLabel} Hit an Error` : 'Something Went Wrong'}
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Background GPS recording remains safe. You can recover this screen or return home.
            </p>
            {this.state.errorMessage && (
              <p
                className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-mono break-words border ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400'
                }`}
              >
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recover View</span>
            </button>

            {this.props.onResetToHome && (
              <button
                type="button"
                onClick={() => {
                  this.handleRetry();
                  this.props.onResetToHome?.();
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
