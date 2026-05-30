import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI. If not provided, the default error card is shown. */
  fallback?: ReactNode;
  /** Called when an error is caught. Useful for logging to an external service. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** If true, shows a "Go Home" button alongside the retry button. */
  showHomeLink?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React Error Boundary.
 *
 * Wrap any subtree to prevent a single component crash from taking down
 * the entire application. Shows a friendly recovery UI with retry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-display font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {this.state.error?.message || "An unexpected error occurred. Please try again."}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={this.handleRetry} className="rounded-xl">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              {this.props.showHomeLink && (
                <Button variant="outline" className="rounded-xl" onClick={() => (window.location.href = "/")}>
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
