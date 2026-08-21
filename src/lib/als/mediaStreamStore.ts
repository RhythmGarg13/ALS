/**
 * Shared media stream store.
 *
 * Lifts camera and microphone state into a module-level singleton so the
 * stream persists across route changes (/setup → /tasks → /assessment)
 * without re-acquiring the device on every mount.
 *
 * Pattern matches session.ts: module-level state + useSyncExternalStore.
 *
 * Stopping tracks is an explicit lifecycle action (call stopAll()), NOT an
 * implicit per-route unmount side effect.  stopAll() should only be called
 * when the user explicitly leaves the assessment flow (e.g. navigates to "/").
 */
import { useCallback } from "react";
import { useSyncExternalStore } from "react";

export type PermState = "idle" | "pending" | "granted" | "denied";

interface MediaStreamState {
  stream: MediaStream | null;
  camera: PermState;
  mic: PermState;
  error: string | null;
}

// ---------------------------------------------------------------------------
//  Module-level state
// ---------------------------------------------------------------------------

const videoTrackRef = { current: null as MediaStreamTrack | null };
const audioTrackRef = { current: null as MediaStreamTrack | null };

let state: MediaStreamState = {
  stream: null,
  camera: "idle",
  mic: "idle",
  error: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<MediaStreamState>) {
  state = { ...state, ...patch };
  emit();
}

function rebuild() {
  const tracks = [videoTrackRef.current, audioTrackRef.current].filter(Boolean) as MediaStreamTrack[];
  setState({ stream: tracks.length ? new MediaStream(tracks) : null });
}

function friendly(e: unknown, device: string) {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError")
    return `Access to the ${device} was blocked. Allow it in your browser's address-bar permission menu, then try again.`;
  if (name === "NotFoundError") return `No ${device} was detected on this device.`;
  if (name === "NotReadableError") return `The ${device} is already in use by another application.`;
  return `Could not start the ${device}. ${(e as Error)?.message ?? ""}`;
}

// ---------------------------------------------------------------------------
//  Public module-level actions
// ---------------------------------------------------------------------------

export async function enableCamera(): Promise<void> {
  if (videoTrackRef.current) return;
  setState({ camera: "pending", error: null });
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    });
    videoTrackRef.current = s.getVideoTracks()[0] ?? null;
    setState({ camera: "granted" });
    rebuild();
  } catch (e) {
    setState({ camera: "denied", error: friendly(e, "camera") });
  }
}

export async function enableMic(): Promise<void> {
  if (audioTrackRef.current) return;
  setState({ mic: "pending", error: null });
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    audioTrackRef.current = s.getAudioTracks()[0] ?? null;
    setState({ mic: "granted" });
    rebuild();
  } catch (e) {
    setState({ mic: "denied", error: friendly(e, "microphone") });
  }
}

export function stopAll(): void {
  videoTrackRef.current?.stop();
  audioTrackRef.current?.stop();
  videoTrackRef.current = null;
  audioTrackRef.current = null;
  setState({ stream: null, camera: "idle", mic: "idle" });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------------------------------------------------------------------------
//  React hook
// ---------------------------------------------------------------------------

/**
 * Reads from the shared module-level media stream store.
 * The stream persists across route changes — it is NOT torn down on unmount.
 * Call stopAll() explicitly if you need to release devices.
 */
export function useMediaStream() {
  const { stream, camera, mic, error } = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );

  const boundEnableCamera = useCallback(() => enableCamera(), []);
  const boundEnableMic = useCallback(() => enableMic(), []);
  const boundStopAll = useCallback(() => stopAll(), []);

  return {
    stream,
    camera,
    mic,
    error,
    enableCamera: boundEnableCamera,
    enableMic: boundEnableMic,
    stopAll: boundStopAll,
  };
}
