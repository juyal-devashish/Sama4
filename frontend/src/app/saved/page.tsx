"use client";

import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { useSavedStories } from "@/lib/preferences";
import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/ui/states";
import { formatTimeAgo } from "@/lib/utils";

export default function SavedPage() {
  const { saved, remove } = useSavedStories();

  return (
    <Page
      title="Saved"
      description={
        saved.length > 0 ? "Stories you kept for later. They stay on this computer." : undefined
      }
    >
      {saved.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet">
          Select Save above any story, or press S while reading, to keep it here.
        </EmptyState>
      ) : (
        <ul className="divide-y border-y">
          {saved.map((s) => (
            <li key={s.id} className="group flex items-start gap-5 py-5">
              <Link href={`/?article=${s.id}`} className="flex min-w-0 flex-1 gap-5">
                <div className="min-w-0 flex-1">
                  <p className="flex gap-3 text-[12.5px]">
                    <span className="font-display font-semibold">{s.source}</span>
                    <span className="text-text-tertiary" suppressHydrationWarning>
                      Saved {formatTimeAgo(s.saved_at).toLowerCase()}
                    </span>
                  </p>
                  <h2 className="mt-1 font-display text-[17px] font-semibold leading-snug group-hover:text-accent-secondary">
                    {s.title}
                  </h2>
                  {s.summary && (
                    <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-text-secondary">
                      {s.summary}
                    </p>
                  )}
                </div>
                {s.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image_url}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    alt=""
                    className="h-20 w-28 flex-shrink-0 rounded-lg bg-background-secondary object-cover"
                  />
                )}
              </Link>
              <button
                type="button"
                onClick={() => remove(s.id)}
                title="Remove from saved"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-tertiary opacity-0 transition hover:bg-background-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
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
