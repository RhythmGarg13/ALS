/**
 * Facial landmark utilities.
 *
 * The browser layer only *extracts and visualises* landmarks.
 * No classification happens here — a Python/PyTorch service can consume
 * the exact same tensors produced by `buildMotionFeatures()` +
 * `edgePadOrTruncate()`.
 *
 * Two distinct tensor types live here; read the comments carefully:
 *   DisplaySequence     — (N, 68, 2)  display-only, variable length, bbox-normalised {x,y}
 *   ModelFeatureTensor  — (15, 68, 6) model-input,  edge-padded, 6-channel motion features
 */

export type Point = { x: number; y: number };
export type Landmarks68 = Point[]; // length 68
export type BBox = [number, number, number, number]; // [xmin, ymin, xmax, ymax]

// ---------------------------------------------------------------------------
//  Display-only sequence type.
//  Used by KinematicPlayer and LandmarkCanvas for frame-by-frame playback.
//  Do NOT feed this to the model — channel count and padding semantics differ.
// ---------------------------------------------------------------------------
export type DisplaySequence = Landmarks68[];

// ---------------------------------------------------------------------------
//  Model-input tensor type.
//  Shape: (MAX_SEQ_LEN=15, 68, 6).  Channels: [centered_x, centered_y,
//  vel_x, vel_y, asym_x, asym_y].  Produced by buildMotionFeatures() +
//  edgePadOrTruncate().  This is what the real Python backend expects.
// ---------------------------------------------------------------------------
export type ModelFeatureTensor = number[][][];

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

/** Every real sample has 9-15 annotated frames, never more.
 *  Matches MAX_SEQ_LEN in als_net_project_v2/preprocessing.py. */
export const MAX_SEQ_LEN = 15;

/**
 * 68-point mirror permutation (0-indexed, dlib/iBUG layout).
 * Copied verbatim from MIRROR_IDX in als_net_project_v2/preprocessing.py.
 * MIRROR_PERM[i] gives the index of the landmark that is the bilateral mirror of landmark i.
 */
export const MIRROR_PERM: number[] = (() => {
  const MIRROR_IDX: Record<number, number> = {
    0: 16, 1: 15, 2: 14, 3: 13, 4: 12, 5: 11, 6: 10, 7: 9, 8: 8, 9: 7, 10: 6, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1, 16: 0,
    17: 26, 18: 25, 19: 24, 20: 23, 21: 22, 22: 21, 23: 20, 24: 19, 25: 18, 26: 17,
    27: 27, 28: 28, 29: 29, 30: 30,
    31: 35, 32: 34, 33: 33, 34: 32, 35: 31,
    36: 45, 37: 44, 38: 43, 39: 42, 40: 47, 41: 46, 42: 39, 43: 38, 44: 37, 45: 36, 46: 41, 47: 40,
    48: 54, 49: 53, 50: 52, 51: 51, 52: 50, 53: 49, 54: 48,
    55: 59, 56: 58, 57: 57, 58: 56, 59: 55,
    60: 64, 61: 63, 62: 62, 63: 61, 64: 60,
    65: 67, 66: 66, 67: 65,
  };
  return Array.from({ length: 68 }, (_, i) => MIRROR_IDX[i]!);
})();

// ---------------------------------------------------------------------------
//  UNUSED — reserved for a future MediaPipe FaceMesh integration.
//  This 478→68 index remap is NOT currently wired to any detector.
//  Do not use for model input — it does not match the dlib layout that
//  als_net_project_v2 expects.
// ---------------------------------------------------------------------------
// export const MEDIAPIPE_TO_68: number[] = [
//   // jaw (0-16)
//   127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365,
//   // right eyebrow (17-21)
//   70, 63, 105, 66, 107,
//   // left eyebrow (22-26)
//   336, 296, 334, 293, 300,
//   // nose bridge (27-30)
//   168, 197, 5, 4,
//   // nostrils (31-35)
//   75, 97, 2, 326, 305,
//   // right eye (36-41)
//   33, 160, 158, 133, 153, 144,
//   // left eye (42-47)
//   362, 385, 387, 263, 373, 380,
//   // outer lips (48-59)
//   61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181,
//   // inner lips (60-67)
//   78, 82, 13, 312, 308, 317, 14, 87,
// ];

// ---------------------------------------------------------------------------
//  Region definitions for visualisation (unchanged)
// ---------------------------------------------------------------------------

export const REGIONS: Record<string, { label: string; idx: number[]; closed: boolean }> = {
  jaw: { label: "Jaw", idx: range(0, 16), closed: false },
  browR: { label: "Eyebrows", idx: range(17, 21), closed: false },
  browL: { label: "Eyebrows", idx: range(22, 26), closed: false },
  noseBridge: { label: "Nose", idx: range(27, 30), closed: false },
  nostrils: { label: "Nose", idx: range(31, 35), closed: false },
  eyeR: { label: "Eyes", idx: range(36, 41), closed: true },
  eyeL: { label: "Eyes", idx: range(42, 47), closed: true },
  lipsOuter: { label: "Mouth", idx: range(48, 59), closed: true },
  lipsInner: { label: "Mouth", idx: range(60, 67), closed: true },
};

export const REGION_COLORS: Record<string, string> = {
  jaw: "#2563eb",
  browR: "#0ea5e9",
  browL: "#0ea5e9",
  noseBridge: "#14b8a6",
  nostrils: "#14b8a6",
  eyeR: "#6366f1",
  eyeL: "#6366f1",
  lipsOuter: "#e11d48",
  lipsInner: "#f97316",
};

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// ---------------------------------------------------------------------------
//  Bounding-box normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Per-frame bounding-box normalisation using the frame's own bbox [x1,y1,x2,y2].
 * Matches the Python formula exactly:
 *   norm_x = (x - x1) / max(x2 - x1, 1e-8)
 *   norm_y = (y - y1) / max(y2 - y1, 1e-6)
 */
export function bboxNormFrame(pts: Landmarks68, bbox: BBox): Landmarks68 {
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(x2 - x1, 1e-8);
  const h = Math.max(y2 - y1, 1e-8);
  return pts.map((p) => ({
    x: (p.x - x1) / w,
    y: (p.y - y1) / h,
  }));
}

/** Bounding-box normalisation using computed min/max of the point set.
 *  Display-only — used by normalizeBoundingBox consumers (setup overlay, ST-GCN vis). */
export function normalizeBoundingBox(pts: Landmarks68): Landmarks68 {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  return pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
}

export function boundingBox(pts: Landmarks68) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ---------------------------------------------------------------------------
//  Model feature extraction — matches als_net_project_v2/preprocessing.py
// ---------------------------------------------------------------------------

/**
 * Compute the (T, 68, 6) motion feature tensor from the TRUE captured frame
 * sequence (before any padding/truncation).
 *
 * Inputs:
 *   frames  — T bbox-normalised landmark frames (each already passed through
 *             bboxNormFrame with its own per-frame bbox).
 *
 * Channel order (MUST match Python reference, do not reorder):
 *   [0:2] centered_xy  = lm_norm - temporal_mean(lm_norm)
 *   [2:4] velocity_xy  = 0 at t=0; lm_norm[t] - lm_norm[t-1] at t>0
 *   [4:6] asymmetry_xy = lm_norm[:,:,0] - (1 - mirrored[:,:,0])
 *                        lm_norm[:,:,1] -     mirrored[:,:,1]
 *
 * This is a MODEL-INPUT tensor.  Do not use for display.
 * Display-only sequences use DisplaySequence (Landmarks68[]).
 */
export function buildMotionFeatures(frames: Landmarks68[]): ModelFeatureTensor {
  const T = frames.length;
  if (T === 0) return [];

  // Build a raw (T, 68, 2) numeric array for efficient computation
  const lmNorm: number[][][] = frames.map((frame) =>
    frame.map((p) => [p.x, p.y]),
  );

  // Temporal mean: (68, 2)
  const meanPose: number[][] = Array.from({ length: 68 }, (_, li) => {
    let sumX = 0, sumY = 0;
    for (let t = 0; t < T; t++) {
      sumX += lmNorm[t]![li]![0]!;
      sumY += lmNorm[t]![li]![1]!;
    }
    return [sumX / T, sumY / T];
  });

  // Assemble (T, 68, 6)
  const features: number[][][] = [];

  for (let t = 0; t < T; t++) {
    const frameFeatures: number[][] = [];
    for (let li = 0; li < 68; li++) {
      const x = lmNorm[t]![li]![0]!;
      const y = lmNorm[t]![li]![1]!;

      // Centered position channels [0:2]
      const centX = x - meanPose[li]![0]!;
      const centY = y - meanPose[li]![1]!;

      // Velocity channels [2:4]: 0 at t=0; delta from previous frame otherwise
      let velX = 0, velY = 0;
      if (t > 0) {
        velX = x - lmNorm[t - 1]![li]![0]!;
        velY = y - lmNorm[t - 1]![li]![1]!;
      }

      // Asymmetry channels [4:6]:
      //   asym_x = lm_norm[:,:,0] - (1.0 - mirrored[:,:,0])
      //   asym_y = lm_norm[:,:,1] -        mirrored[:,:,1]
      const mirrorIdx = MIRROR_PERM[li]!;
      const mirX = lmNorm[t]![mirrorIdx]![0]!;
      const mirY = lmNorm[t]![mirrorIdx]![1]!;
      const asymX = x - (1.0 - mirX);
      const asymY = y - mirY;

      frameFeatures.push([centX, centY, velX, velY, asymX, asymY]);
    }
    features.push(frameFeatures);
  }

  return features;
}

/**
 * Edge-pad (or truncate) a sequence to exactly `length` frames.
 *
 * Rules (matching als_net_project_v2/preprocessing.py):
 *   - If T >= length: truncate to the first `length` frames.
 *   - If T <  length: repeat the LAST real frame until length is reached.
 *
 * Returns:
 *   padded — the padded/truncated sequence of length `length`
 *   mask   — parallel array of length `length`; 1.0 = real frame, 0.0 = padded
 */
export function edgePadOrTruncate<T>(
  seq: T[],
  length: number = MAX_SEQ_LEN,
): { padded: T[]; mask: number[] } {
  if (seq.length === 0) {
    // Edge case: nothing captured — return empty-ish arrays
    return { padded: [], mask: [] };
  }
  if (seq.length >= length) {
    // Truncate
    return {
      padded: seq.slice(0, length),
      mask: Array(length).fill(1.0),
    };
  }
  // Edge-pad by repeating last real frame
  const last = seq[seq.length - 1]!;
  const padded = [...seq];
  const mask: number[] = seq.map(() => 1.0);
  while (padded.length < length) {
    padded.push(last);
    mask.push(0.0);
  }
  return { padded, mask };
}

// ---------------------------------------------------------------------------
//  Display-only helpers
// ---------------------------------------------------------------------------

/**
 * Uniformly resample a landmark stream into a T-frame DISPLAY sequence.
 * DISPLAY-ONLY — do not use as model input.
 * For the model-input tensor use buildMotionFeatures() + edgePadOrTruncate().
 */
export function buildSequence(frames: Landmarks68[], T = 20): DisplaySequence {
  if (frames.length === 0) return [];
  const out: Landmarks68[] = [];
  for (let i = 0; i < T; i++) {
    const src = Math.min(frames.length - 1, Math.round((i / (T - 1)) * (frames.length - 1)));
    out.push(normalizeBoundingBox(frames[src]!));
  }
  return out;
}

/** Deterministic synthetic face used when no camera landmarks are available. */
export function syntheticFace(t: number, open = 0): Landmarks68 {
  const pts: Landmarks68 = [];
  const cx = 0.5;
  const cy = 0.52;
  const rx = 0.26;
  const ry = 0.34;
  const wob = Math.sin(t * 1.6) * 0.006;

  // jaw
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (0.08 + (i / 16) * 0.84);
    pts.push({ x: cx - Math.cos(a) * rx + wob, y: cy + Math.sin(a) * ry * 0.95 });
  }
  // eyebrows
  for (let i = 0; i < 5; i++)
    pts.push({ x: cx - 0.17 + i * 0.045, y: cy - 0.2 - Math.sin((i / 4) * Math.PI) * 0.03 + wob });
  for (let i = 0; i < 5; i++)
    pts.push({ x: cx + 0.035 + i * 0.045, y: cy - 0.2 - Math.sin((i / 4) * Math.PI) * 0.03 + wob });
  // nose bridge
  for (let i = 0; i < 4; i++) pts.push({ x: cx + wob, y: cy - 0.15 + i * 0.06 });
  // nostrils
  for (let i = 0; i < 5; i++) pts.push({ x: cx - 0.055 + i * 0.0275 + wob, y: cy + 0.1 });
  // eyes
  const eye = (ex: number) => {
    const ey = cy - 0.11;
    const er = 0.055;
    const eh = 0.024;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push({ x: ex + Math.cos(a) * er + wob, y: ey + Math.sin(a) * eh });
    }
  };
  eye(cx - 0.11);
  eye(cx + 0.11);
  // lips
  const my = cy + 0.2;
  const mw = 0.11 + open * 0.02;
  const mh = 0.035 + open * 0.05;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * mw + wob, y: my + Math.sin(a) * mh });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * mw * 0.62 + wob, y: my + Math.sin(a) * mh * 0.55 });
  }
  return pts;
}
