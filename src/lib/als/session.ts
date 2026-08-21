/**
 * Frontend-only session store.
 *
 * Holds the demo session state (selected task, recording metadata, captured
 * landmark/speech features). Everything stays in this browser tab — no
 * backend, no upload. A Python/PyTorch service can later consume the exact
 * same `(15, 68, 6)` model-feature tensor plus the speech summary.
 */
import { useSyncExternalStore } from "react";
import type { Landmarks68 } from "./landmarks";
import type { DemoResult } from "./mock-results";
import type { LiveResult } from "./api";


export type SpeechSummary = {
  ddkRateHz: number;
  peakCount: number;
  rhythmVariability: number | null;
  meanPitchHz: number | null;
  speechFrameCount: number;
};

export type TaskCapture = {
  taskId: string;
  landmarkFrameCount: number;
  sequence: Landmarks68[]; // raw captured frames (display-only, variable length)
  /** Model-input tensor (15, 68, 6): centered, velocity, asymmetry channels. null if not yet computed. */
  modelFeatures: number[][][] | null;
  /** Parallel mask for modelFeatures: 1.0 = real frame, 0.0 = edge-padded. */
  featureMask: number[] | null;
  speech: SpeechSummary | null;
  durationMs: number;
  capturedAt: number;
};

export type SessionState = {
  taskId: string | null;
  recordingDurationMs: number;
  recordingUrl: string | null;
  hasRecording: boolean;
  /** Display-only sequence for KinematicPlayer (variable-length, bbox-normalised {x,y}). */
  sequence: Landmarks68[];
  /** Same sequence resampled to 20 frames for the scrubber display. */
  displaySequence: Landmarks68[];
  captures: Record<string, TaskCapture>;
  /** null = no analysis run yet; DemoResult = mock run; LiveResult = real API run */
  result: DemoResult | LiveResult | null;
};

const initial: SessionState = {
  taskId: null,
  recordingDurationMs: 0,
  recordingUrl: null,
  hasRecording: false,
  sequence: [],
  displaySequence: [],
  captures: {},
  result: null,
};

let state: SessionState = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setSession(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  emit();
}

export function saveCapture(capture: TaskCapture) {
  state = { ...state, captures: { ...state.captures, [capture.taskId]: capture } };
  emit();
}

export function resetSession() {
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  state = initial;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export function getSession() {
  return state;
}
