"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { useSavedStories, type SavedStory } from "@/lib/preferences";
import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/ui/states";
import { StoryImage } from "@/components/ui/story-image";
import { formatTimeAgo } from "@/lib/utils";

export default function SavedPage() {
  const { saved, remove, restore } = useSavedStories();
  const [removed, setRemoved] = useState<SavedStory | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  // The focused Remove button just disappeared: move focus to Undo.
  useEffect(() => {
    if (removed) undoRef.current?.focus();
  }, [removed]);

  return (
    <Page
      title="Saved"
      description={
        saved.length > 0 ? "Stories you kept for later. They stay on this computer." : undefined
      }
    >
      <div role="status" className="empty:hidden">
        {removed && (
          <div className="mb-4 flex items-center gap-3 border-y border-foreground bg-background-secondary px-4 py-2.5 text-[15px]">
            <span className="min-w-0 flex-1 truncate">Removed &ldquo;{removed.title}&rdquo;</span>
            <button
              ref={undoRef}
              type="button"
              onClick={() => {
                restore(removed);
                setRemoved(null);
              }}
              className="label-ui link-ui h-8 flex-shrink-0 px-3 font-bold text-accent-secondary"
            >
              Undo
            </button>
          </div>
        )}
      </div>
      {saved.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet">
          Select Save above any story, or press S while reading, to keep it here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-divider border-b border-border">
          {saved.map((s) => (
            <li key={s.id} className="group flex items-start gap-5 py-6">
              <Link href={`/?article=${s.id}`} className="flex min-w-0 flex-1 gap-5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-3">
                    <span className="kicker">{s.source}</span>
                    <span className="label-ui text-text-tertiary" suppressHydrationWarning>
                      Saved {formatTimeAgo(s.saved_at).toLowerCase()}
                    </span>
                  </p>
                  <h2 className="mt-1.5 font-editorial text-[24px] leading-[1.08] tracking-[-0.025em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {s.title}
                  </h2>
                  {s.summary && (
                    <p className="mt-2 line-clamp-2 text-[15px] leading-[1.4] text-text-secondary">
                      {s.summary}
                    </p>
                  )}
                </div>
                <StoryImage
                  src={s.image_url}
                  source={s.source}
                  loading="lazy"
                  className="h-24 w-36 text-[14px]"
                />
              </Link>
              <button
                type="button"
                onClick={() => {
                  remove(s.id);
                  setRemoved(s);
                }}
                title="Remove from saved"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-tertiary transition hover:text-foreground"
              >
                <X size={16} />
                <span className="sr-only">Remove {s.title} from saved</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
