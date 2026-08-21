import { ARCHITECTURES, type ArchitectureId } from "@/lib/als/tasks";
import { GitCompareArrows, Waves, Network } from "lucide-react";

const ICONS: Record<ArchitectureId, typeof Waves> = {
  siamese: GitCompareArrows,
  bigru: Waves,
  stgcn: Network,
};

export function ArchitectureCards({ highlight }: { highlight?: ArchitectureId }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {Object.values(ARCHITECTURES).map((a) => {
        const Icon = ICONS[a.id];
        const active = highlight === a.id;
        return (
          <article
            key={a.id}
            className={`surface-card flex flex-col p-6 ${active ? "ring-2 ring-ring" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg navy-gradient text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="mono-label">Demo AUC {a.demoAuc.toFixed(3)}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">{a.name}</h3>
            <p className="text-sm text-primary">{a.prior}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.description}</p>

            <p className="mono-label mt-5">Best suited for</p>
            <p className="font-mono text-sm font-medium">{a.bestFor}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Illustrative pairing for this demo only — all four models are trained on all nine tasks pooled together in the actual research pipeline.
            </p>

            <ol className="mt-4 space-y-1.5 border-t pt-4">
              {a.stages.map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-xs">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-2 font-mono text-[10px]">
                    {i + 1}
                  </span>
                  <span className="font-mono text-muted-foreground">{s}</span>
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
