"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useTrendingPredictions } from "@/hooks/usePrediction";
import { Page } from "@/components/shell/Page";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { CONFIDENCE_HELP, IMPACT_HELP } from "@/lib/outlook";
import { formatTimeAgo } from "@/lib/utils";

function impactColor(score: number) {
  return score > 70 ? "var(--error)" : score > 40 ? "var(--entity-event)" : "var(--success)";
}

export default function OutlookPage() {
  const { data, isLoading, isError, refetch } = useTrendingPredictions();

  return (
    <Page
      width="max-w-[960px]"
      title="Outlook"
      description={
        <>
          AI-generated projections of what might happen next in a story, ranked by the
          model&apos;s estimate of impact. They are estimates, not confirmed events.
          <span className="mt-2 block text-[13.5px] text-text-tertiary">
            <strong className="font-medium text-text-secondary">Impact</strong>: {IMPACT_HELP}{" "}
            <strong className="font-medium text-text-secondary">Model confidence</strong>:{" "}
            {CONFIDENCE_HELP}
          </span>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState what="outlooks" onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No outlooks yet"
          action={
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-lg bg-accent-primary px-4 text-[13px] font-semibold text-on-accent hover:opacity-90"
            >
              Go to today&apos;s stories
            </Link>
          }
        >
          Open a story and select Run outlook at the end of it. Finished outlooks are listed here.
        </EmptyState>
      ) : (
        <ol className="divide-y border-y">
          {data.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/?article=${p.article_id}`}
                className="group grid grid-cols-[40px_1fr_140px] items-start gap-6 py-6"
              >
                <span className="pt-0.5 font-display text-[22px] font-semibold tabular-nums text-text-tertiary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex gap-3 text-[12.5px]">
                    <span className="font-display font-semibold">{p.article_source}</span>
                    <span className="text-text-tertiary" suppressHydrationWarning>
                      {formatTimeAgo(p.completed_at)}
                    </span>
                  </p>
                  <h2 className="mt-1 font-display text-[17px] font-semibold leading-snug group-hover:text-accent-secondary">
                    {p.article_title}
                  </h2>
                  {p.prediction_summary && (
                    <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-text-secondary">
                      {p.prediction_summary}
                    </p>
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-[12px] text-text-tertiary">Impact (estimate)</p>
                  <p className="font-display text-[18px] font-semibold tabular-nums">
                    {Math.round(p.impact_score)}
                  </p>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background-secondary"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, p.impact_score)}%`,
                        backgroundColor: impactColor(p.impact_score),
                      }}
                    />
                  </div>
                  {p.confidence_score != null && (
                    <p className="mt-2 text-[12px] text-text-tertiary">
                      {Math.round(p.confidence_score * 100)}% model confidence
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}
