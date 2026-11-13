"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { useReferencePage } from "@/hooks/useReferencePage";
import { Page } from "@/components/shell/Page";
import { ErrorState } from "@/components/ui/states";
import { ENTITY_LABELS, ENTITY_TYPES, cn, entityColor, entityKind } from "@/lib/utils";
import { PublishedTime } from "@/components/ui/published-time";
import type { ReferenceEntityContext } from "@/types";
import { storyPath } from "@/lib/routes";

export default function ReferencesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useReferencePage(id);
  const [open, setOpen] = useState<string | null>(null);

  const back = (
    <Link
      href={storyPath(id)}
      className="label-ui mb-6 inline-flex h-9 items-center gap-1.5 text-text-secondary hover:text-foreground"
    >
      <ArrowLeft size={13} /> Back to the story
    </Link>
  );

  if (isLoading) {
    return (
      <Page title="References" before={back}>
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      </Page>
    );
  }
  if (isError || !data) {
    return (
      <Page title="References" before={back}>
        <ErrorState what="references" onRetry={() => refetch()} />
      </Page>
    );
  }

  const groups = ENTITY_TYPES.map((t) => ({
    type: t as string,
    items: data.entities.filter((e) => entityKind(e.type) === t),
  })).filter((g) => g.items.length > 0);

  return (
    <Page
      width="max-w-[1080px]"
      before={back}
      title="References"
      description={
        <>
          Everyone and everything mentioned in{" "}
          <span className="italic text-foreground">{data.article.title}</span>,{" "}
          {data.entities.length} in total.
        </>
      }
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.type} aria-labelledby={`g-${g.type}`}>
              <h2 id={`g-${g.type}`} className="section-label flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entityColor(g.type) }}
                  aria-hidden
                />
                {ENTITY_LABELS[g.type]?.many ?? "Other"}
                <span className="font-normal text-text-tertiary">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-divider">
                {g.items.map((e) => (
                  <ReferenceRow
                    key={e.id}
                    entity={e}
                    storyId={id}
                    open={open === e.id}
                    onToggle={() => setOpen(open === e.id ? null : e.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {data.related_articles.length > 0 && (
          <aside>
            <h2 className="section-label">Related stories</h2>
            <ul className="divide-y divide-divider">
              {data.related_articles.map((a) => (
                <li key={a.id} className="py-3.5">
                  <Link href={storyPath(a.id)} className="group block">
                    <span className="block font-editorial text-[17px] leading-[1.2] tracking-[-0.01em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                      {a.title}
                    </span>
                    <span className="label-ui mt-1.5 flex gap-3 text-text-tertiary">
                      <span className="font-bold text-accent-secondary">{a.source}</span>
                      <PublishedTime at={a.published_at} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </Page>
  );
}

function ReferenceRow({
  entity,
  storyId,
  open,
  onToggle,
}: {
  entity: ReferenceEntityContext;
  storyId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const explained = !!entity.context?.trim();
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-4 py-3.5 text-left"
      >
        <span className="w-[200px] flex-shrink-0 font-editorial text-[16px] font-bold leading-snug">
          {entity.name}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 font-editorial text-[15px] leading-relaxed",
            explained ? "text-text-secondary" : "text-text-tertiary",
            !open && "line-clamp-1",
          )}
        >
          {explained ? entity.context : "Not explained yet"}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "mt-1 flex-shrink-0 text-text-tertiary transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && !explained && (
        <p className="pb-2 pl-[216px] text-[15px] leading-relaxed text-text-secondary">
          Samā4 hasn&apos;t written an explanation for {entity.name} yet.{" "}
          <Link
            href={storyPath(storyId)}
            className="text-accent-secondary underline underline-offset-2"
          >
            Open the story
          </Link>{" "}
          and select the term to get one
          {entity.wikipedia_url ? ", or read about it on Wikipedia." : "."}
        </p>
      )}
      {open && entity.wikipedia_url && (
        <div className="pb-4 pl-[216px]">
          <a
            href={entity.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="label-ui link-ui inline-flex items-center gap-1 font-bold text-accent-secondary"
          >
            Read more on Wikipedia <ArrowUpRight size={12} />
          </a>
        </div>
      )}
    </li>
  );
}
