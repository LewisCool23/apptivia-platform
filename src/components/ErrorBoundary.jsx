import React from 'react';

// ── Full-app boundary — used in App.jsx to catch catastrophic failures ───────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info);
    this.setState({ errorInfo: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-apptivia-paper flex items-center justify-center p-6">
          <div className="bg-white border rounded-lg shadow-sm p-6 max-w-lg text-center">
            <h1 className="text-lg font-semibold text-apptivia-ink mb-2">Something went wrong</h1>
            <p className="text-sm text-apptivia-carbon-500 mb-3">An unexpected error occurred while rendering this page.</p>
            <button
              onClick={() => window.location.reload()}
              className="mb-3 px-4 py-2 bg-apptivia-coral text-white text-sm rounded-lg hover:bg-apptivia-coral"
            >
              Reload Page
            </button>
            <div className="text-xs text-left bg-apptivia-paper border rounded p-3 text-apptivia-carbon-700 overflow-auto max-h-48 whitespace-pre-wrap">
              {String(this.state.error?.message || this.state.error || 'Unknown error')}
              {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
              {this.state.errorInfo?.componentStack ? `\n\n${this.state.errorInfo.componentStack}` : ''}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// ── Per-page boundary — wraps individual pages so one crash doesn't kill all ─
// Automatically resets when the component key changes (i.e. route navigation).
export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[PageErrorBoundary]', error, info);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="bg-white border border-red-100 rounded-lg shadow-sm p-8 max-w-md text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-base font-semibold text-apptivia-ink mb-1">This page ran into a problem</h2>
            <p className="text-sm text-apptivia-carbon-500 mb-5">
              {String(this.state.error?.message || 'An unexpected error occurred.')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-apptivia-coral text-white text-sm font-medium rounded-lg hover:bg-apptivia-coral transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 border border-apptivia-carbon-300 text-apptivia-carbon-700 text-sm font-medium rounded-lg hover:bg-apptivia-paper transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
