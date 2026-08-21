/**
 * Mock / demonstration results.
 *
 * IMPORTANT: nothing here is a prediction. Values are illustrative placeholder
 * figures for demonstration purposes only — they are NOT yet-published results
 * from the ALS-NET research paper (LOSO evaluation has not been completed yet).
 *
 * To connect a real backend later, replace `runAnalysis()` with a call to a
 * Python/PyTorch inference API that accepts the (15, 68, 6) model-feature tensor.
 */
import { ARCHITECTURES, getTask } from "./tasks";
import type { ArchitectureId } from "./tasks";

export type AttentionPoint = { frame: number; label: string; weight: number; apex: boolean };
export type SymmetryPoint = { region: string; left: number; right: number; diff: number };

export type DemoResult = {
  taskId: string;
  architecture: ArchitectureId;
  generatedAt: number;
  cohortMetrics: { sensitivity: number; specificity: number; f1: number; auc: number };
  taskAuc: number;
  attention: AttentionPoint[];
  symmetry: SymmetryPoint[];
  symmetryDifference: number;
};

/**
 * Illustrative placeholder cohort-level metrics for demonstration purposes only.
 * These are NOT yet-published results — LOSO evaluation has not been run yet.
 * Do not present these as findings from the research paper.
 */
export const COHORT_METRICS = {
  sensitivity: 88.9,
  specificity: 86.4,
  f1: 87.5,
  auc: 0.91,
};

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildAttention(seed: number): AttentionPoint[] {
  const rnd = mulberry(seed);
  const apexes = [4, 9, 14, 18];
  const pts: AttentionPoint[] = [];
  for (let i = 1; i <= 20; i++) {
    let base = 0.18 + rnd() * 0.14;
    for (const a of apexes) {
      base += 0.62 * Math.exp(-((i - a) ** 2) / 1.6);
    }
    const weight = Math.min(0.97, Number(base.toFixed(2)));
    pts.push({ frame: i, label: `Frame ${i}`, weight, apex: apexes.includes(i) });
  }
  return pts;
}

function buildSymmetry(seed: number): SymmetryPoint[] {
  const rnd = mulberry(seed);
  const regions = ["Outer lip corner", "Inner lip", "Cheek raise", "Eye aperture", "Brow lift", "Jaw contour"];
  return regions.map((region) => {
    const left = Number((0.62 + rnd() * 0.3).toFixed(3));
    const right = Number(Math.min(0.99, Math.max(0.4, left + (rnd() - 0.5) * 0.18)).toFixed(3));
    return { region, left, right, diff: Number(Math.abs(left - right).toFixed(3)) };
  });
}

export function runAnalysis(taskId: string): DemoResult {
  const task = getTask(taskId);
  const arch = ARCHITECTURES[task.architecture];
  const seed = Array.from(taskId).reduce((a, c) => a + c.charCodeAt(0), 7);
  const symmetry = buildSymmetry(seed);
  const symmetryDifference = Number(
    (symmetry.reduce((a, s) => a + s.diff, 0) / symmetry.length).toFixed(3),
  );
  return {
    taskId,
    architecture: task.architecture,
    generatedAt: Date.now(),
    cohortMetrics: COHORT_METRICS,
    taskAuc: arch.demoAuc,
    attention: buildAttention(seed),
    symmetry,
    symmetryDifference,
  };
}

export const PIPELINE_STAGES = [
  "Video Input",
  "Facial Landmark Extraction",
  "Bounding-Box Normalization",
  "20-Frame Sequence Construction",
  "Task Identification",
  "Architecture Selection",
  "Kinematic Analysis",
  "Assessment Complete",
];
