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
          <div className="flex justify-center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="text-base font-semibold text-inherit">
            Something went wrong
          </div>
          <div className="text-sm opacity-60 max-w-[400px]">
            This section encountered an error. Try refreshing the page.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
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
