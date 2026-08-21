import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Cpu, AlertTriangle } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/als/mock-results";
import { getTask, ARCHITECTURES } from "@/lib/als/tasks";
import { setSession, useSession } from "@/lib/als/session";
import { analyzeRecording, ApiError } from "@/lib/als/api";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "ALS-NET Analysis — Processing" },
      {
        name: "description",
        content:
          "ALS-NET processing pipeline: landmark extraction, bounding-box normalization, 20-frame sequence construction and architecture selection.",
      },
      { property: "og:title", content: "ALS-NET Analysis — Processing" },
      { property: "og:description", content: "ALS-NET processing pipeline — sending recorded video to inference backend." },
    ],
  }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const navigate = useNavigate();
  const session = useSession();
  const task = getTask(session.taskId);
  const arch = ARCHITECTURES[task.architecture];
  const [stage, setStage] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  // Track whether the API call has been fired (StrictMode double-effect guard)
  const firedRef = useRef(false);

  useEffect(() => {
    // ── Stage animation — runs independently of the API call ──────────────
    const per = 480;
    const animId = window.setInterval(() => {
      setStage((s) => {
        // Stop advancing the last stage until navigation fires
        if (s >= PIPELINE_STAGES.length - 2) {
          window.clearInterval(animId);
          return s;
        }
        return s + 1;
      });
    }, per);

    // ── Real API call ──────────────────────────────────────────────────────
    if (firedRef.current) return () => window.clearInterval(animId);
    firedRef.current = true;

    void (async () => {
      try {
        // 1. Retrieve the recorded video blob from the object URL
        if (!session.recordingUrl) {
          throw new Error(
            "No recording found. Please record a video before analyzing.",
          );
        }
        const videoRes = await fetch(session.recordingUrl);
        const videoBlob = await videoRes.blob();

        // 2. POST to the inference API
        const result = await analyzeRecording(videoBlob, task.id);

        // 3. Advance animation to final stage, then navigate
        setStage(PIPELINE_STAGES.length - 1);
        await new Promise((r) => setTimeout(r, 600));

        setSession({ result });
        void navigate({ to: "/results" });
      } catch (err) {
        window.clearInterval(animId);
        const message =
          err instanceof ApiError
            ? `API error (${err.status}): ${err.message}`
            : err instanceof Error
              ? err.message
              : "An unexpected error occurred.";
        setApiError(message);
      }
    })();

    return () => window.clearInterval(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-[80vh] overflow-hidden hero-gradient">
      <div className="absolute inset-0 grid-backdrop opacity-50" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" aria-hidden /> ALS-NET pipeline
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">ALS-NET Analysis</h1>
          {apiError ? (
            <p className="mt-2 text-sm text-destructive">Analysis failed — see error below.</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Sending recording to inference service…
            </p>
          )}
        </div>

        {/* Error state */}
        {apiError && (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-destructive/40 bg-destructive/8 px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
                  Inference Error
                </p>
                <p className="mt-1 text-sm text-foreground/80">{apiError}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Make sure the ALS-NET inference server is running at{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}
                  </code>
                  . See the backend README for setup instructions.
                </p>
                <button
                  onClick={() => void navigate({ to: "/assessment" })}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-2"
                >
                  ← Back to Recording
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline stage list */}
        <ol className="mx-auto mt-10 max-w-xl space-y-2">
          {PIPELINE_STAGES.map((s, i) => {
            const state = i < stage ? "done" : i === stage ? "active" : "idle";
            return (
              <li
                key={s}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                  state === "idle" ? "bg-card/50 opacity-55" : "bg-card shadow-[var(--shadow-card)]"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    state === "done"
                      ? "bg-success/15 text-success"
                      : state === "active"
                        ? "bg-primary-soft text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : state === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <span className="font-mono text-[10px]">{i + 1}</span>
                  )}
                </span>
                <span className="flex-1 text-sm font-medium">{s}</span>
                <span className="mono-label">
                  {state === "done" ? "ok" : state === "active" ? "running" : "queued"}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mx-auto mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
          <div className="surface-card p-5">
            <p className="mono-label">Input Representation</p>
            <p className="mt-1 font-mono text-xl">(T, 68, 6)</p>
            <p className="mt-1 text-xs text-muted-foreground">T frames · 68 pts · 6-channel features</p>
          </div>
          <div className="surface-card p-5">
            <p className="mono-label">Selected Architecture</p>
            <p className="mt-1 text-sm font-semibold">{arch.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{arch.prior}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
