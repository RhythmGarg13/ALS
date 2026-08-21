import type { LucideIcon } from "lucide-react";
import { Smile, Wind, Heart, MoveHorizontal, AudioLines, Repeat, MessageSquareQuote, Maximize2, ArrowUpFromLine } from "lucide-react";

export type ArchitectureId = "siamese" | "bigru" | "stgcn";

export type Architecture = {
  id: ArchitectureId;
  name: string;
  shortName: string;
  prior: string;
  bestFor: string;
  demoAuc: number;
  stages: string[];
  description: string;
};

export const ARCHITECTURES: Record<ArchitectureId, Architecture> = {
  siamese: {
    id: "siamese",
    name: "Siamese Network",
    shortName: "Siamese",
    prior: "Spatial Symmetry Prior",
    bestFor: "NSM_BIGSMILE",
    demoAuc: 0.925,
    stages: ["Left Face → Shared Encoder", "Right Face → Shared Encoder", "Latent Distance", "Classification"],
    description:
      "Twin encoders with shared weights compare mirrored halves of the landmark set, so the representation is organised around left/right correspondence.",
  },
  bigru: {
    id: "bigru",
    name: "Bi-GRU + Temporal Attention",
    shortName: "Bi-GRU",
    prior: "Temporal / Apex Prior",
    bestFor: "DDK_PATAKA",
    demoAuc: 0.941,
    stages: ["Frame 1 → Frame 2 → … → Frame 20", "Bi-GRU", "Temporal Attention", "Apex Frames"],
    description:
      "A bidirectional recurrent encoder with temporal self-attention weights individual frames, surfacing articulatory apex moments in rapid repetition tasks.",
  },
  stgcn: {
    id: "stgcn",
    name: "ST-GCN",
    shortName: "ST-GCN",
    prior: "Coordinated Movement Prior",
    bestFor: "NSM_BLOW",
    demoAuc: 0.905,
    stages: ["Facial landmark nodes", "Spatial connections", "Temporal sequence", "ST-GCN"],
    description:
      "A spatio-temporal graph convolution treats landmarks as graph nodes with anatomical edges, modelling coordinated multi-point movement over time.",
  },
};

export type TaskCategory = "non-speech" | "speech";

export type ClinicalTask = {
  id: string;
  category: TaskCategory;
  categoryLabel: string;
  instruction: string;
  purpose: string;
  architecture: ArchitectureId;
  icon: LucideIcon;
  durationHint: string;
};

export const TASKS: ClinicalTask[] = [
  {
    id: "NSM_BIGSMILE",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Smile as widely as possible and hold the position.",
    purpose: "Evaluates bilateral facial symmetry and range of motion.",
    architecture: "siamese",
    icon: Smile,
    durationHint: "≈ 5 s",
  },
  {
    id: "NSM_SPREAD",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Spread your lips laterally as far as comfortably possible.",
    purpose: "Evaluates facial movement and symmetry.",
    architecture: "siamese",
    icon: MoveHorizontal,
    durationHint: "≈ 5 s",
  },
  {
    id: "NSM_BLOW",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Perform the instructed blowing movement.",
    purpose: "Evaluates coordinated lip movement.",
    architecture: "stgcn",
    icon: Wind,
    durationHint: "≈ 5 s",
  },
  {
    id: "NSM_KISS",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Pucker your lips as if giving a kiss.",
    purpose: "Evaluates lip movement and coordination.",
    architecture: "stgcn",
    icon: Heart,
    durationHint: "≈ 5 s",
  },
  {
    id: "DDK_PA",
    category: "speech",
    categoryLabel: "Speech / Diadochokinetic",
    instruction: "Repeat PA as quickly and clearly as possible.",
    purpose: "Evaluates rate and regularity of single-syllable repetition.",
    architecture: "bigru",
    icon: Repeat,
    durationHint: "≈ 8 s",
  },
  {
    id: "DDK_PATAKA",
    category: "speech",
    categoryLabel: "Speech / Diadochokinetic",
    instruction: "Repeat PA-TA-KA as quickly and clearly as possible.",
    purpose: "Evaluates rapid articulatory coordination and temporal movement patterns.",
    architecture: "bigru",
    icon: AudioLines,
    durationHint: "≈ 8 s",
  },
  {
    id: "BBP_NORMAL",
    category: "speech",
    categoryLabel: "Speech / Sentence",
    instruction: "Repeat: Buy Bobby a Puppy.",
    purpose: "Evaluates coordinated multi-articulator movement.",
    architecture: "bigru",
    icon: MessageSquareQuote,
    durationHint: "≈ 6 s",
  },
  {
    id: "NSM_OPEN",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Open your mouth as wide as comfortably possible.",
    purpose: "Evaluates jaw range of motion.",
    architecture: "stgcn",
    icon: Maximize2,
    durationHint: "\u2248 5 s",
  },
  {
    id: "NSM_BROW",
    category: "non-speech",
    categoryLabel: "Non-Speech Movement",
    instruction: "Raise your eyebrows as high as possible.",
    purpose: "Evaluates upper-face range of motion and symmetry.",
    architecture: "siamese",
    icon: ArrowUpFromLine,
    durationHint: "\u2248 5 s",
  },
];

export function getTask(id: string | null | undefined): ClinicalTask {
  return TASKS.find((t) => t.id === id) ?? TASKS[5]!;
}
