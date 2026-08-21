import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

export type Point2D = [number, number];
export type Landmarks68 = Point2D[]; // length 68
export type BBox = [number, number, number, number]; // [Xmin, Ymin, Xmax, Ymax]

export interface FaceFrame {
  frameIndex: number;
  timestampMs: number;
  rawLandmarks: Landmarks68;
  bbox: BBox;
  normalisedLandmarks: Landmarks68;
}

export interface UseFaceLandmarksOptions {
  modelUrl?: string;
  intervalMs?: number;
}

export interface UseFaceLandmarksResult {
  isModelLoading: boolean;
  isReady: boolean;
  error: string | null;
  isTracking: boolean;
  frames: FaceFrame[];
  start: (videoEl: HTMLVideoElement) => void;
  stop: () => void;
  reset: () => void;
}

function normaliseLandmarks(lm: Landmarks68, bbox: BBox): Landmarks68 {
  const [xmin, ymin, xmax, ymax] = bbox;
  const w = Math.max(xmax - xmin, 1e-6);
  const h = Math.max(ymax - ymin, 1e-6);
  return lm.map(([x, y]) => {
    const nx = Math.min(1, Math.max(0, (x - xmin) / w));
    const ny = Math.min(1, Math.max(0, (y - ymin) / h));
    return [nx, ny] as Point2D;
  });
}

export function useFaceLandmarks(options: UseFaceLandmarksOptions = {}): UseFaceLandmarksResult {
  const {
    // Weights are self-hosted in public/models/ to avoid CDN dependency during live demos.
    // CDN fallback (document-only, not used by default):
    //   https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/
    modelUrl = "/models",
    intervalMs = 66,
  } = options;

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [frames, setFrames] = useState<FaceFrame[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRunRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsModelLoading(true);
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        if (!cancelled) {
          setIsReady(true);
          setIsModelLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Failed to load face-api.js models: ${String(e)}`);
          setIsModelLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    if (now - lastRunRef.current < intervalMs) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastRunRef.current = now;

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (detection) {
        const box = detection.detection.box;
        const bbox: BBox = [box.x, box.y, box.x + box.width, box.y + box.height];
        const rawLandmarks: Landmarks68 = detection.landmarks.positions.map((p) => [p.x, p.y] as Point2D);
        const normalisedLandmarks = normaliseLandmarks(rawLandmarks, bbox);

        const frame: FaceFrame = {
          frameIndex: frameIndexRef.current++,
          timestampMs: now - startTimeRef.current,
          rawLandmarks,
          bbox,
          normalisedLandmarks,
        };
        setFrames((prev) => [...prev, frame]);
      }
    } catch (e) {
      setError(`Landmark extraction error: ${String(e)}`);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [intervalMs]);

  const start = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (!isReady) {
        setError("Models are not loaded yet.");
        return;
      }
      videoRef.current = videoEl;
      frameIndexRef.current = 0;
      startTimeRef.current = performance.now();
      setIsTracking(true);
      rafRef.current = requestAnimationFrame(tick);
    },
    [isReady, tick],
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const reset = useCallback(() => {
    setFrames([]);
    frameIndexRef.current = 0;
  }, []);

  useEffect(() => stop, [stop]);

  return { isModelLoading, isReady, error, isTracking, frames, start, stop, reset };
}
