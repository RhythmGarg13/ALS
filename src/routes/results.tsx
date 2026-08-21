import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw, Layers, CheckCircle2 } from "lucide-react";
import {
  SimulatedResultBanner,
  ModelResultBanner,
  DemoTag,
  ResearchDisclaimer,
} from "@/components/als/Disclaimers";
import { KinematicPlayer } from "@/components/als/KinematicPlayer";
import { LandmarkCanvas } from "@/components/als/LandmarkCanvas";
import { ArchitectureCards } from "@/components/als/ArchitectureCards";
import { getTask, ARCHITECTURES } from "@/lib/als/tasks";
import { useSession, setSession } from "@/lib/als/session";
import { runAnalysis, COHORT_METRICS } from "@/lib/als/mock-results";
import { normalizeBoundingBox, syntheticFace } from "@/lib/als/landmarks";
import type { LiveResult } from "@/lib/als/api";
import type { DemoResult } from "@/lib/als/mock-results";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Assessment Results — ALS-NET" },
      {
        name: "description",
        content:
          "ALS-NET results dashboard with temporal attention, facial symmetry and ST-GCN graph visualisations. Research prototype — not a medical diagnosis.",
      },
      { property: "og:title", content: "Assessment Results — ALS-NET" },
      {
        property: "og:description",
        content: "Results dashboard for the ALS-NET research prototype.",
      },
    ],
  }),
  component: ResultsPage,
});

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="mono-label">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Narrow the union so we can read shared fields safely */
function isLiveResult(r: DemoResult | LiveResult): r is LiveResult {
  return (r as LiveResult).source === "live";
}

function ResultsPage() {
  const navigate = useNavigate();
  const session = useSession();
  const task = getTask(session.taskId);
  const arch = ARCHITECTURES[task.architecture];

  // Fall back to mock analysis only if no result is stored (e.g. direct URL nav)
  const result = useMemo(
    () => session.result ?? runAnalysis(task.id),
    [session.result, task.id],
  );

  const live = isLiveResult(result);

  const reportRef = useRef<HTMLAnchorElement>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const stgcnFace = useMemo(() => normalizeBoundingBox(syntheticFace(1.2, 0.7)), []);

  // Resolve display values from whichever result type we have
  const cohortMetrics = live ? result.cohortMetrics : COHORT_METRICS;
  const attentionData = live ? result.attention : result.attention;
  const symmetryData  = live ? result.symmetry   : result.symmetry;
  const symmetryDiff  = live ? result.symmetryDifference : result.symmetryDifference;
  const taskAuc       = live ? null : result.taskAuc;  // live results don't carry per-task AUC

  const generateReport = () => {
    const base = {
      product: "ALS-NET research prototype",
      disclaimer: live
        ? "RESEARCH PROTOTYPE — Real model output. Not a medical diagnosis and must not be used for clinical decision-making."
        : "SIMULATED DEMO RESULT — demonstration data only. Not a medical diagnosis and not derived from the recorded session.",
      task: task.id,
      instruction: task.instruction,
      architecture: arch.name,
      prior: arch.prior,
      representation: "(T, 68, 6)",
      generatedAt: new Date(result.generatedAt).toISOString(),
    };

    const report = live
      ? {
          ...base,
          prediction: result.prediction,
          probability: result.probability,
          nFramesUsed: result.nFramesUsed,
          temporalAttention: result.attention,
          symmetryScore: result.symmetryScore,
          symmetry: result.symmetry,
          cohortMetrics,
        }
      : {
          ...base,
          demoTaskAuc: result.taskAuc,
          cohortDemoMetrics: COHORT_METRICS,
          temporalAttention: result.attention,
          symmetry: result.symmetry,
        };

    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    setReportUrl(url);
    requestAnimationFrame(() => reportRef.current?.click());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">Step 6 · Results</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">ALS-NET Assessment Results</h1>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {live ? "Analysis Complete" : "Demo Analysis Complete"}
          </p>
        </div>
        {live ? null : <DemoTag />}
      </header>

      {/* Banner — swaps based on result source */}
      {live ? <ModelResultBanner /> : <SimulatedResultBanner />}

      {/* ── Top metrics row ─────────────────────────────────────────────────── */}
      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {/* Classification output card */}
        <div className="surface-card p-5 xl:col-span-1">
          <p className="mono-label">Classification Output</p>
          {live ? (
            <>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
                  result.prediction === "ALS" ? "text-destructive" : "text-success"
                }`}
              >
                {result.prediction}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Model confidence: {(result.probability * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.nFramesUsed} frames used
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Model inference not yet connected</p>
              <p className="mt-1 text-xs text-muted-foreground">No clinical interpretation is provided.</p>
            </>
          )}
        </div>

        <MetricCard
          label="Sensitivity"
          value={`${cohortMetrics.sensitivity}%`}
          note="Illustrative placeholder — demonstration only"
        />
        <MetricCard
          label="Specificity"
          value={`${cohortMetrics.specificity}%`}
          note="Illustrative placeholder — demonstration only"
        />
        <MetricCard
          label="F1 Score"
          value={`${cohortMetrics.f1}%`}
          note="Illustrative placeholder — demonstration only"
        />
        <MetricCard
          label="AUC-ROC"
          value={cohortMetrics.auc.toFixed(3)}
          note="Illustrative placeholder — demonstration only"
        />
      </section>
      <p className="mt-3 text-xs text-muted-foreground">
        These are illustrative placeholder values for demonstration purposes only — they do not reflect
        published results and do not describe the person in front of the camera.
      </p>

      {/* ── Task-specific visualisation ────────────────────────────────────── */}
      <section className="mt-10 surface-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="mono-label">Task-specific result · {task.id}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{arch.name}</h2>
            <p className="text-sm text-primary">{arch.prior}</p>
          </div>
          <div className="text-right">
            {!live && taskAuc !== null && (
              <>
                <p className="mono-label">Demo AUC</p>
                <p className="font-mono text-2xl font-semibold">{arch.demoAuc.toFixed(3)}</p>
              </>
            )}
            {live && (
              <>
                <p className="mono-label">P(ALS)</p>
                <p className={`font-mono text-2xl font-semibold ${result.prediction === "ALS" ? "text-destructive" : "text-success"}`}>
                  {(result.probability * 100).toFixed(1)}%
                </p>
              </>
            )}
          </div>
        </div>

        {/* BiGRU — Temporal Attention */}
        {task.architecture === "bigru" && (
          <div className="mt-6">
            <p className="text-sm font-medium">Temporal Attention</p>
            <div className="mt-3 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={attentionData ?? []}
                  margin={{ top: 10, right: 12, bottom: 4, left: -12 }}
                >
                  <defs>
                    <linearGradient id="attn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="frame" tickFormatter={(v) => `${v}`} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis domain={[0, 1]} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 12,
                    }}
                    formatter={(v: number | string) => [`${v}`, "Attention Weight"]}
                    labelFormatter={(l) => `Frame ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="url(#attn)"
                    dot={(props) => {
                      const { cx, cy, payload, index } = props as unknown as {
                        cx: number;
                        cy: number;
                        index: number;
                        payload: { apex: boolean };
                      };
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={payload.apex ? 5 : 2.5}
                          fill={payload.apex ? "var(--color-destructive)" : "var(--color-accent)"}
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              X-axis: Frame 1 → Frame {(attentionData ?? []).length} · Y-axis: attention weight. Highlighted markers are high-weight frames.
            </p>
            <p className="mt-3 rounded-lg border bg-surface px-4 py-3 text-sm text-muted-foreground">
              Attention peaks represent temporal regions receiving greater weight in the model.
              They should not be interpreted as direct evidence of ALS.
            </p>
          </div>
        )}

        {/* Siamese — Symmetry */}
        {task.architecture === "siamese" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-medium">Left vs. Right Facial Region</p>
              <div className="mt-3 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={symmetryData ?? []}
                    margin={{ top: 10, right: 12, bottom: 4, left: -12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="region"
                      stroke="var(--color-muted-foreground)"
                      fontSize={10}
                      interval={0}
                      angle={-12}
                      dy={8}
                    />
                    <YAxis domain={[0, 1]} stroke="var(--color-muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Left Facial Region" dataKey="left" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                    <Bar name="Right Facial Region" dataKey="right" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid content-start gap-4">
              <div className="surface-card p-5">
                <p className="mono-label">
                  {live ? "Symmetry Score" : "Symmetry Difference (mock)"}
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold">
                  {symmetryDiff !== null ? symmetryDiff.toFixed(3) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {live
                    ? "Mean absolute feature asymmetry across all landmarks."
                    : "Mean absolute left/right latent difference across demonstration regions."}
                </p>
              </div>
              <div className="surface-card p-5">
                <p className="mono-label">Encoder pipeline</p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                  <li>Left Face → Shared Encoder</li>
                  <li>Right Face → Shared Encoder</li>
                  <li>→ Latent Distance</li>
                  <li>→ Classification</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ST-GCN — Graph vis */}
        {task.architecture === "stgcn" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="aspect-square w-full rounded-xl border bg-surface">
              <LandmarkCanvas landmarks={stgcnFace} className="h-full w-full" fit="contain" background="grid" pointRadius={3} />
            </div>
            <div className="grid content-start gap-4">
              <p className="text-sm text-muted-foreground">
                Landmarks are treated as graph nodes; anatomical neighbours form spatial edges, and matching nodes across
                the sequence form temporal edges.
              </p>
              <div className="surface-card p-5">
                <p className="mono-label">Graph definition</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {[
                    ["Nodes", "68"],
                    ["Spatial edges", "≈ 132"],
                    ["Temporal window", `${live ? result.nFramesUsed : 15} frames`],
                    ["Partitioning", "Spatial configuration"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mt-10">
        {/* displaySequence is the 20-frame display-only scrubber sequence built in stop(). */}
        <KinematicPlayer sequence={session.displaySequence} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">ALS-NET Architectures</h2>
        <p className="mt-1 text-sm text-muted-foreground">Task-conditioned model selection used by the framework.</p>
        <div className="mt-5">
          <ArchitectureCards highlight={task.architecture} />
        </div>
      </section>

      {/* ── Assessment Summary ─────────────────────────────────────────────── */}
      <section className="mt-10 surface-card p-6">
        <h2 className="text-xl font-semibold tracking-tight">Assessment Summary</h2>
        <dl className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {((): Array<[string, string]> => {
            const cap = session.captures[task.id];
            const isDDK = task.id.startsWith("DDK");
            const rows: Array<[string, string]> = [
              ["Task", task.id],
              ["Input", "Webcam + Microphone"],
              ["Representation", "68-point facial landmarks (dlib)"],
              ["Frames captured", cap ? String(cap.landmarkFrameCount) : "—"],
              ["Architecture", arch.name],
              [
                "Classification",
                live
                  ? `${result.prediction} (${(result.probability * 100).toFixed(1)}% confidence)`
                  : "Model inference not yet connected",
              ],
            ];
            if (live) {
              rows.push(["Frames used (server)", String(result.nFramesUsed)]);
            }
            if (isDDK && cap?.speech) {
              rows.push(
                ["DDK Rate (Hz)", cap.speech.ddkRateHz.toFixed(2)],
                ["Syllable peaks", String(cap.speech.peakCount)],
                [
                  "Rhythm variability",
                  cap.speech.rhythmVariability != null ? cap.speech.rhythmVariability.toFixed(3) : "—",
                ],
                [
                  "Mean pitch (Hz)",
                  cap.speech.meanPitchHz != null ? cap.speech.meanPitchHz.toFixed(1) : "—",
                ],
              );
            }
            return rows;
          })().map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-mono font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSession({ result: null, hasRecording: false, sequence: [], displaySequence: [], recordingDurationMs: 0 });
              void navigate({ to: "/tasks" });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Run Another Task
          </button>
          <Link
            to="/architecture"
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            <Layers className="h-4 w-4" aria-hidden /> View Architecture
          </Link>
          <button
            onClick={generateReport}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            <Download className="h-4 w-4" aria-hidden />
            {live ? "Generate Report" : "Generate Demo Report"}
          </button>
          <a
            ref={reportRef}
            href={reportUrl ?? "#"}
            download={`als-net-report-${task.id}.json`}
            className="hidden"
            aria-hidden
          >
            download
          </a>
        </div>
      </section>

      <div className="mt-8">
        <ResearchDisclaimer />
      </div>
    </div>
  );
}
