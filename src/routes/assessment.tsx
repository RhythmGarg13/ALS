import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Circle, Square, RotateCcw, Sparkles, CheckCircle2, Mic, Camera } from "lucide-react";
import { CameraView } from "@/components/als/CameraView";
import { AudioWaveform } from "@/components/als/AudioWaveform";
import { useMediaStream } from "@/hooks/useMediaStream";
import { getTask, ARCHITECTURES } from "@/lib/als/tasks";
import { setSession, saveCapture, useSession } from "@/lib/als/session";
import {
  buildSequence,
  buildMotionFeatures,
  edgePadOrTruncate,
  bboxNormFrame,
  type Landmarks68 as AlsLandmarks68,
  type BBox as AlsBBox,
} from "@/lib/als/landmarks";
import { ResearchDisclaimer } from "@/components/als/Disclaimers";
import { useFaceLandmarks, type Landmarks68 as HookLandmarks68, type BBox as HookBBox } from "@/hooks/useFaceLandmarks";
import { useSpeechFeatures } from "@/hooks/useSpeechFeatures";

/** Convert hook's [number,number][] to the {x,y}[] shape used by als/landmarks. */
function toAlsLandmarks(pts: HookLandmarks68): AlsLandmarks68 {
  return pts.map(([x, y]) => ({ x, y }));
}

/** Convert hook's BBox to als/landmarks BBox (same [xmin,ymin,xmax,ymax] tuple). */
function toAlsBBox(bbox: HookBBox): AlsBBox {
  return bbox as AlsBBox;
}

const DEMO_CAPTION =
  "Illustrative pairing for this demo only — all four models are trained on all nine tasks pooled together in the actual research pipeline.";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Assessment Recording — ALS-NET" },
      {
        name: "description",
        content:
          "Record a clinical task with live webcam, landmark overlay and real-time microphone waveform. Recordings stay inside the browser session.",
      },
      { property: "og:title", content: "Assessment Recording — ALS-NET" },
      {
        property: "og:description",
        content: "Webcam and microphone capture with a live 68-point landmark overlay for the ALS-NET prototype.",
      },
    ],
  }),
  component: AssessmentPage,
});

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function AssessmentPage() {
  const navigate = useNavigate();
  const session = useSession();
  const task = getTask(session.taskId);
  const arch = ARCHITECTURES[task.architecture];
  const { stream, camera, mic, error: mediaError, enableCamera, enableMic } = useMediaStream();

  const face = useFaceLandmarks();
  const speech = useSpeechFeatures();

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [complete, setComplete] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // Holds the data built synchronously in stop() so that onstop can safely read
  // it without a stale closure on face.frames.
  const pendingRef = useRef<{
    displaySequence: AlsLandmarks68[];
    rawSequence: AlsLandmarks68[];
    modelFeatures: number[][][] | null;
    featureMask: number[] | null;
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    void enableCamera();
    void enableMic();
  }, [enableCamera, enableMic]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => window.clearInterval(id);
  }, [recording]);

  const handleVideoReady = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  const start = () => {
    if (!stream) return;

    face.reset();
    speech.reset();

    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream);
    } catch {
      return;
    }
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);

      // Read from pendingRef — built synchronously in stop() where face.frames is fresh.
      // Do NOT re-read face.frames here: the onstop closure was created in start() and
      // would capture a stale (empty) reference to face.frames.
      const pending = pendingRef.current;
      setSession({
        hasRecording: true,
        recordingUrl: url,
        recordingDurationMs: pending?.durationMs ?? 0,
        sequence: pending?.rawSequence ?? [],
        displaySequence: pending?.displaySequence ?? [],
      });
      setComplete(true);
    };
    recorderRef.current = rec;
    startRef.current = Date.now();
    setElapsed(0);
    setComplete(false);
    rec.start();
    setRecording(true);

    // Start real extractions after MediaRecorder is running
    if (videoElRef.current) {
      face.start(videoElRef.current);
    }
    void speech.start();
  };

  const stop = () => {
    face.stop();
    speech.stop();

    // Build sequences synchronously here — face.frames is fresh at stop() time.
    const rawAlsFrames = face.frames.map((f) => toAlsLandmarks(f.normalisedLandmarks));
    const rawBBoxes = face.frames.map((f) => toAlsBBox(f.bbox));

    // Display sequence: uniformly resampled 20-frame display-only sequence.
    const displaySequence = buildSequence(rawAlsFrames, 20);

    // Model feature tensor: (T, 68, 6) from TRUE frames, then edge-pad to 15.
    // The hook already stores per-frame bbox-normalised landmarks in normalisedLandmarks,
    // so we re-normalise each frame using its own stored bbox to match Python exactly.
    const bboxNormed = face.frames.map((f, i) =>
      bboxNormFrame(toAlsLandmarks(f.rawLandmarks), rawBBoxes[i]!),
    );
    const motionFeatures = buildMotionFeatures(bboxNormed);
    const { padded: paddedFeatures, mask: featureMask } = edgePadOrTruncate(motionFeatures);

    pendingRef.current = {
      displaySequence,
      rawSequence: rawAlsFrames,
      modelFeatures: paddedFeatures.length > 0 ? (paddedFeatures as number[][][]) : null,
      featureMask: featureMask.length > 0 ? featureMask : null,
      durationMs: Date.now() - startRef.current,
    };

    // Compute speech summary
    const validPitches = speech.frames.map((f) => f.pitchHz).filter((p): p is number => p !== null);
    const meanPitchHz =
      validPitches.length > 0 ? validPitches.reduce((a, b) => a + b, 0) / validPitches.length : null;

    saveCapture({
      taskId: task.id,
      landmarkFrameCount: face.frames.length,
      sequence: rawAlsFrames,
      modelFeatures: pendingRef.current.modelFeatures,
      featureMask: pendingRef.current.featureMask,
      speech: {
        ddkRateHz: speech.ddkSummary.rateHz,
        peakCount: speech.ddkSummary.peakCount,
        rhythmVariability: speech.ddkSummary.rhythmVariability,
        meanPitchHz,
        speechFrameCount: speech.frames.length,
      },
      durationMs: pendingRef.current.durationMs,
      capturedAt: Date.now(),
    });

    recorderRef.current?.stop();
    setRecording(false);
  };

  const retake = () => {
    setComplete(false);
    setElapsed(0);
    pendingRef.current = null;
    setSession({ hasRecording: false, sequence: [], displaySequence: [], recordingDurationMs: 0 });
  };

  // Combine all errors for display (reuse existing error-display pattern)
  const hookErrors = [face.error, speech.error].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">Step 4 · Recording</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Assessment — <span className="font-mono">{task.id}</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="mono-label">Progress</p>
          <p className="text-sm font-medium">Task 1 of 1</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card p-4">
          <CameraView
            stream={stream}
            frame={face.frames.length > 0 ? face.frames[face.frames.length - 1] : null}
            overlayLabel={recording ? "REC" : undefined}
            statusLabel={face.isModelLoading ? "Loading model…" : undefined}
            onVideoReady={handleVideoReady}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!recording ? (
              <button
                onClick={start}
                disabled={!stream || complete}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Circle className="h-3.5 w-3.5 fill-current" aria-hidden /> Start Recording
              </button>
            ) : (
              <button
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> Stop
              </button>
            )}
            <button
              onClick={retake}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Retake
            </button>
            {complete && (
              <button
                onClick={() => void navigate({ to: "/processing" })}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" aria-hidden /> Analyze Demo
              </button>
            )}
          </div>
          {mediaError && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {mediaError}
            </p>
          )}
          {hookErrors && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {hookErrors}
            </p>
          )}
          {(camera !== "granted" || mic !== "granted") && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void enableCamera()} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
                <Camera className="h-3.5 w-3.5" aria-hidden /> Enable Camera
              </button>
              <button onClick={() => void enableMic()} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
                <Mic className="h-3.5 w-3.5" aria-hidden /> Enable Microphone
              </button>
            </div>
          )}
        </div>

        <div className="grid content-start gap-4">
          <section className="surface-card p-6">
            <p className="mono-label">Current Task</p>
            <h2 className="mt-1 font-mono text-lg font-semibold">{task.id}</h2>
            <p className="mt-2 text-sm font-medium">"{task.instruction}"</p>
            <p className="mt-2 text-sm text-muted-foreground">{task.purpose}</p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">{arch.name} · {arch.prior}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{DEMO_CAPTION}</p>
          </section>

          <section className="surface-card p-6">
            <div className="flex items-center justify-between">
              <p className="mono-label">Microphone</p>
              <span className={`text-xs ${mic === "granted" ? "text-success" : "text-muted-foreground"}`}>
                {mic === "granted" ? "Live input" : "Not connected"}
              </span>
            </div>
            <div className="mt-3">
              <AudioWaveform stream={stream} height={88} />
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="mono-label">Recording</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-3xl tabular-nums">{fmt(elapsed)}</span>
              {recording && (
                <span className="inline-flex items-center gap-2 rounded-full bg-destructive/12 px-3 py-1 text-xs font-medium text-destructive">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden /> Recording
                </span>
              )}
              {complete && (
                <span className="inline-flex items-center gap-2 rounded-full bg-success/12 px-3 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Recording Complete
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Captured with MediaRecorder and kept in this browser tab only — nothing is uploaded.
            </p>
          </section>

          <ResearchDisclaimer />
          <Link to="/tasks" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Choose a different task
          </Link>
        </div>
      </div>
    </div>
  );
}
