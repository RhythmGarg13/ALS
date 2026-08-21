import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { LandmarkCanvas } from "./LandmarkCanvas";
import { syntheticFace, normalizeBoundingBox, type Landmarks68 } from "@/lib/als/landmarks";

function fallbackSequence(): Landmarks68[] {
  return Array.from({ length: 20 }, (_, i) =>
    normalizeBoundingBox(syntheticFace(i * 0.25, (Math.sin((i / 19) * Math.PI * 2) + 1) / 2)),
  );
}

/**
 * Frame-by-frame playback of the captured kinematic sequence.
 * When sequence.length === 0 (no recording made yet), uses a deterministic
 * synthetic face as a placeholder and shows a visible "Synthetic preview" label.
 */
export function KinematicPlayer({ sequence }: { sequence: Landmarks68[] }) {
  // Only use fallback when there is truly no capture yet (length 0).
  // A real recording may have any number of frames.
  const isSynthetic = sequence.length === 0;
  const frames = isSynthetic ? fallbackSequence() : sequence;
  const totalFrames = frames.length;

  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(
      () => setFrame((f) => (f >= totalFrames ? 1 : f + 1)),
      110,
    );
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, totalFrames]);

  // Reset frame to 1 when a new sequence arrives
  useEffect(() => {
    setFrame(1);
  }, [sequence]);

  return (
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Facial Kinematic Analysis</h2>
        <span className="mono-label">Visualisation only</span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="aspect-square w-full rounded-xl border bg-surface">
            <LandmarkCanvas
              landmarks={frames[frame - 1] ?? null}
              className="h-full w-full"
              fit="contain"
              background="grid"
              pointRadius={2.6}
            />
          </div>
          {isSynthetic && (
            <p className="mt-2 text-xs text-muted-foreground">
              Synthetic preview — no recording yet.
            </p>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current frame</span>
              <span className="font-mono font-medium">
                {String(frame).padStart(2, "0")} / {String(totalFrames).padStart(2, "0")}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={totalFrames}
              value={frame}
              onChange={(e) => {
                setPlaying(false);
                setFrame(Number(e.target.value));
              }}
              className="w-full accent-[oklch(0.58_0.13_245)]"
              aria-label="Frame slider"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPlaying(true)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${playing ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-surface-2"}`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden /> Play
              </button>
              <button
                onClick={() => setPlaying(false)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${!playing ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-surface-2"}`}
              >
                <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setFrame(1);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
              </button>
            </div>
          </div>
        </div>

        <dl className="grid content-start gap-2.5 text-sm">
          {(
            [
              ["Sequence Length", `${totalFrames} frames`],
              ["Landmarks", "68"],
              ["Coordinates", "2D"],
              ["Normalization", "Bounding-box normalized"],
              ["Representation", isSynthetic ? "(synthetic)" : `(${totalFrames}, 68, 2)`],
              ["Source", isSynthetic ? "Demonstration sequence" : "Captured this session"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
