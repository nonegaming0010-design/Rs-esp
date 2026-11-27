import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while loading your workspace or cloud data.';
      if (this.state.message.includes('Missing or insufficient permissions')) {
        friendly = 'Your account does not have permission for this action, or your email is not verified yet.';
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
          <div className="max-w-md w-full rounded-lg border border-stone-300 bg-white p-6 space-y-3 dark:border-stone-800 dark:bg-stone-900">
            <h1 className="font-display text-lg font-bold">Rs-ESP Recovery</h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">{friendly}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Return to Workbench
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
