/**
 * Global crash guard. Wrap the app once in App.tsx. On any render error in
 * the tree it shows a themed full-screen fallback instead of a white screen.
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // Keep the failure in the console for support/debugging.
    console.error('Unhandled render error:', error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const dark = document.documentElement.classList.contains('dark');
    const surface = dark ? '#111827' : '#FFFFFF';
    const border = dark ? '#1F2937' : '#E3E8EF';
    const title = dark ? '#F9FAFB' : '#101828';
    const text = dark ? 'rgba(226,232,240,0.8)' : '#475467';

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: dark ? '#0B1220' : '#F4F6F9',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: 28,
            boxShadow: dark
              ? '0 24px 64px -16px rgba(0,0,0,0.6)'
              : '0 24px 64px -16px rgba(16,24,40,0.2)',
            textAlign: 'center',
          }}
          role="alert"
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: title }}>
            Something went wrong
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: text }}>
            The screen failed to load. Reloading usually fixes this. If it
            keeps happening, contact support.
          </p>
          {this.state.message && (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 12,
                color: text,
                opacity: 0.75,
                wordBreak: 'break-word',
              }}
            >
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#2563EB',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
