import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ARCHITECTURES, TASKS, type ClinicalTask } from "@/lib/als/tasks";
import { setSession, useSession } from "@/lib/als/session";
import { ResearchDisclaimer } from "@/components/als/Disclaimers";

const DEMO_CAPTION =
  "Illustrative pairing for this demo only — all four models are trained on all nine tasks pooled together in the actual research pipeline.";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Clinical Task Selection — ALS-NET" },
      {
        name: "description",
        content:
          "Choose a non-speech or speech clinical task (NSM_BIGSMILE, DDK_PATAKA, BBP_NORMAL and more) for the ALS-NET frontend demonstration.",
      },
      { property: "og:title", content: "Clinical Task Selection — ALS-NET" },
      {
        property: "og:description",
        content: "Non-speech and speech clinical tasks mapped to Siamese, Bi-GRU and ST-GCN architectures.",
      },
    ],
  }),
  component: TasksPage,
});

function TaskCard({ task, selected, onSelect }: { task: ClinicalTask; selected: boolean; onSelect: () => void }) {
  const arch = ARCHITECTURES[task.architecture];
  const Icon = task.icon;
  return (
    <article
      className={`surface-card flex flex-col p-6 transition-shadow ${selected ? "ring-2 ring-ring" : "hover:shadow-[var(--shadow-lift)]"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-semibold tracking-tight">{task.id}</h3>
          <p className="mono-label mt-0.5">{task.categoryLabel}</p>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium leading-relaxed">“{task.instruction}”</p>
      <p className="mt-2 text-sm text-muted-foreground">{task.purpose}</p>

      <dl className="mt-4 space-y-1.5 border-t pt-4 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Architecture</dt>
          <dd className="text-right font-mono font-medium">{arch.name}</dd>
        </div>
        <div className="col-span-full">
          <p className="text-[10px] text-muted-foreground">{DEMO_CAPTION}</p>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Prior</dt>
          <dd className="text-right">{arch.prior}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="text-right font-mono">{task.durationHint}</dd>
        </div>
      </dl>

      <button
        onClick={onSelect}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Start <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </article>
  );
}

function TasksPage() {
  const navigate = useNavigate();
  const session = useSession();

  const select = (id: string) => {
    setSession({ taskId: id, result: null, hasRecording: false, sequence: [], recordingDurationMs: 0 });
    void navigate({ to: "/assessment" });
  };

  const groups: { title: string; note: string; items: ClinicalTask[] }[] = [
    {
      title: "Non-Speech Tasks",
      note: "Volitional oro-facial movements without phonation.",
      items: TASKS.filter((t) => t.category === "non-speech"),
    },
    {
      title: "Speech Tasks",
      note: "Diadochokinetic repetition and sentence-level articulation.",
      items: TASKS.filter((t) => t.category === "speech"),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mono-label">Step 3 · Task selection</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Clinical Task Selection</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Select one task for this demonstration. Each task is associated with a different ALS-NET architecture based on
          the motion characteristics it emphasises.
        </p>
      </header>

      <ResearchDisclaimer className="mb-8 max-w-3xl" />

      {groups.map((g) => (
        <section key={g.title} className="mb-10">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
            <p className="text-sm text-muted-foreground">{g.note}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {g.items.map((t) => (
              <TaskCard key={t.id} task={t} selected={session.taskId === t.id} onSelect={() => select(t.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
