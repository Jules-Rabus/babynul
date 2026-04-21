"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-xl bg-destructive/10 p-4">
            <h2 className="text-sm font-semibold text-destructive">
              Erreur de rendu
            </h2>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground"
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
