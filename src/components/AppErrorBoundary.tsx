import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: any;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren<{}>, AppErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console for now; could be extended to remote logging
    console.error('AppErrorBoundary caught an error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Lightweight fallback UI consistent with app style
      const details = this.state.error?.message || String(this.state.error || '');
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#00051E] dark:text-white flex flex-col items-center justify-center p-4">
          <h1 className="text-xl font-bold mb-2">Une erreur est survenue</h1>
          <p className="text-slate-700 dark:text-white/80 mb-4 text-center max-w-md">
            La page n'a pas pu s'afficher. Vous pouvez revenir à l'accueil et réessayer.
          </p>
          {details && (
            <div className="mb-4 max-w-xl text-xs text-red-700 dark:text-red-200 bg-red-50 dark:bg-white/5 border border-red-200 dark:border-white/10 rounded-lg p-3 whitespace-pre-wrap">
              {details}
            </div>
          )}
          <a href="#/" className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-4 py-2 rounded-3xl">Accueil</a>
          <button onClick={this.handleReset} className="mt-2 text-sm text-slate-600 dark:text-white/70 underline">Réessayer ici</button>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default AppErrorBoundary;
