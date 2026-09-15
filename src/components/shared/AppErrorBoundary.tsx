import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crash:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-black text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Reload the page to continue. If this keeps happening, sign out and sign back in.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="forest-gradient inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
