'use client';
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-10 px-5 text-center min-h-[200px] flex flex-col items-center justify-center gap-3">
          <div className="text-[32px]">⚠️</div>
          <div className="text-base font-semibold text-inherit">
            Something went wrong
          </div>
          <div className="text-sm opacity-60 max-w-[400px]">
            This section encountered an error. Try refreshing the page.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #c47d8e, #a3586b)', color: '#fff' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
