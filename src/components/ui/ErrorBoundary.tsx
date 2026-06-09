"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-destructive font-semibold">Algo deu errado.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message}
            </p>
            <button
              className="mt-4 text-sm underline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Tentar novamente
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
