import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert, RefreshCw, Home, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Change this value (e.g. the active workspace id) to clear a caught error:
   * a broken module must not poison every other section of the terminal.
   */
  resetKey?: string | number;
  /** Compact card for a single module instead of the full-screen fallback. */
  variant?: "screen" | "inline";
  /** Short module name shown in the inline fallback. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence: a render error must not leave the operator with a blank
 * terminal. The boundary keeps the shell alive and offers a retry (which also
 * remounts the subtree) plus a way back to the root route.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Ai Tor] unhandled render error", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const inline = this.props.variant === "inline";
    const wrap = inline ? "flex min-h-0 flex-1 items-center justify-center p-4" : "flex min-h-[100dvh] items-center justify-center bg-background p-4";

    return (
      <div className={wrap}>
        <div
          role="alert"
          className={cn(
            "w-full max-w-lg rounded-xl border border-destructive/30 bg-card/70 p-5 shadow-[0_0_40px_hsl(var(--destructive)/0.12)]",
            inline && "backdrop-blur-sm",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
            <h2 className="font-heading text-sm uppercase tracking-widest text-foreground">
              {inline ? `Módulo ${this.props.label ?? ""} no disponible`.replace(/\s+/g, " ").trim() : "El terminal encontró un fallo"}
            </h2>
          </div>
          <p className="font-mono text-[11px] leading-5 text-muted-foreground">
            {inline
              ? "Esta vista falló al renderizar. El resto del terminal sigue operativo: reintenta o cambia de módulo."
              : "Una vista falló al renderizar. La sesión y tus datos guardados siguen intactos; recarga para volver al estado normal."}
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-md border border-border/50 bg-background/70 p-2 font-mono text-[10px] leading-4 text-destructive/80">
            {error.message}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={inline ? this.retry : () => window.location.reload()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {inline ? (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {inline ? "Reintentar" : "Recargar"}
            </button>
            <a
              href="/"
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/50 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Home className="h-3.5 w-3.5" aria-hidden="true" /> Ir al inicio
            </a>
          </div>
        </div>
      </div>
    );
  }
}
