"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useTrendingPredictions } from "@/hooks/usePrediction";
import { Page } from "@/components/shell/Page";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatTimeAgo } from "@/lib/utils";
import { storyPath } from "@/lib/routes";

export default function OutlookPage() {
  const { data, isLoading, isError, refetch } = useTrendingPredictions();

  return (
    <Page
      width="max-w-[960px]"
      title="Outlook"
      description={
        <>
          AI-generated projections of what might happen next in a story. They are estimates, not
          confirmed events.
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
            <Link href="/" className="btn-ink">
              Go to today&apos;s stories
            </Link>
          }
        >
          Open a story and select Run outlook at the end of it. Finished outlooks are listed here.
        </EmptyState>
      ) : (
        <ol className="divide-y divide-divider border-b border-border">
          {data.map((p, i) => (
            <li key={p.id}>
              <Link
                href={storyPath(p.article_id)}
                className="group grid grid-cols-[40px_1fr] items-start gap-6 py-6"
              >
                <span className="kicker pt-1 text-[12px] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-3">
                    <span className="kicker">{p.article_source}</span>
                    <span className="label-ui text-text-tertiary" suppressHydrationWarning>
                      {formatTimeAgo(p.completed_at)}
                    </span>
                  </p>
                  <h2 className="mt-1.5 font-editorial text-[24px] leading-[1.08] tracking-[-0.025em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {p.article_title}
                  </h2>
                  {p.prediction_summary && (
                    <p className="mt-2 line-clamp-2 text-[15px] leading-[1.45] text-text-secondary">
                      {p.prediction_summary}
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
