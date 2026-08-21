import { AlertTriangle, ShieldAlert, FlaskConical } from "lucide-react";

export function ResearchDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm ${className}`}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p className="text-foreground/85">
        <strong className="font-semibold">Research Prototype</strong> — This application is for demonstration and
        research purposes only and does not provide a medical diagnosis.
      </p>
    </div>
  );
}

export function SimulatedResultBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/8 px-5 py-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
          ⚠ Simulated demo result
        </p>
        <p className="mt-1 text-sm text-foreground/80">
          This result is generated using demonstration data. It is not a medical diagnosis, and it is not derived from
          the video or audio you just recorded.
        </p>
      </div>
    </div>
  );
}

export function DemoTag({ children = "Demo / Simulated" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-warning-foreground">
      {children}
    </span>
  );
}

/**
 * Banner shown when real model output is displayed.
 * Replaces SimulatedResultBanner for live API results — but keeps the same
 * core message: this is a research prototype, not a medical diagnosis.
 */
export function ModelResultBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/6 px-5 py-4">
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Research Model Output
        </p>
        <p className="mt-1 text-sm text-foreground/80">
          These values are real output from the trained ALS-NET model for the video you just recorded.
          This is a <strong>research prototype</strong> — results are not a medical diagnosis and must not
          be used for clinical decision-making.
        </p>
      </div>
    </div>
  );
}
