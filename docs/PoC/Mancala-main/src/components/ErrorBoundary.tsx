import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private isQuotaError(error: Error | null): boolean {
    if (!error) return false;
    const msg = error.message;
    try {
      const parsed = JSON.parse(msg);
      const errStr = parsed.error || '';
      return errStr.includes('Quota exceeded') || 
             errStr.includes('quota-exceeded') || 
             errStr.includes('Quota limit exceeded');
    } catch {
      return msg.includes('Quota exceeded') || 
             msg.includes('quota-exceeded') || 
             msg.includes('Quota limit exceeded');
    }
  }

  public render() {
    if (this.state.hasError) {
      const isQuota = this.isQuotaError(this.state.error);

      return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
          <div className="bg-stone-800 border-2 border-amber-900/50 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-amber-500 mb-4">
              {isQuota ? 'Limite de Sagesse / Wisdom Limit Reached' : 'Une perturbation / A disturbance'}
            </h2>
            <p className="text-stone-300 mb-8 leading-relaxed">
              {isQuota 
                ? "Le village a atteint sa limite quotidienne... / The village has reached its daily limit. Come back tomorrow."
                : "Une erreur inattendue s'est produite. / An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
            >
              <RefreshCcw size={20} />
              Réessayer / Retry
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-6 p-4 bg-black/50 rounded-lg text-left text-xs text-red-400 overflow-auto max-h-40">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
