// frontend/src/components/ErrorBoundary.jsx — a crash in one screen never blanks the whole app
import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // reported only when Sentry is configured (VITE_SENTRY_DSN)
    window.__nivraReportError?.(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel glass-modal max-w-sm w-full p-6 text-center" role="alert">
          <h1 className="text-xl font-black text-white">Something went wrong</h1>
          <p className="text-sm text-white/70 mt-2">Please reload the page. If this is an emergency, don't wait:</p>
          <a href="tel:112" className="btn-emergency !animate-none justify-center w-full mt-4 !py-3">Call 112</a>
          <button onClick={() => window.location.reload()} className="btn-secondary justify-center w-full mt-2">Reload NIVRA</button>
        </div>
      </div>
    );
  }
}
