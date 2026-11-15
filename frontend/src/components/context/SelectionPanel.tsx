"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useSelectionExplanation } from "@/hooks/useSelectionExplanation";
import { ApiError } from "@/lib/api";
import type { ContextData } from "@/types";
import { ExplanationSources } from "./ContextPanel";

interface Props {
  text: string;
  articleId: string;
  onClose: () => void;
  onAnnounce?: (message: string) => void;
}

/** Margin panel for text the reader selected themselves (not a highlighted term). */
export function SelectionPanel({ text, articleId, onClose, onAnnounce }: Props) {
  const { data, isLoading, isError, error, refetch } = useSelectionExplanation(articleId, text);

  useEffect(() => {
    if (!onAnnounce) return;
    if (isLoading) onAnnounce(`Loading an explanation of ${text}.`);
    else if (isError || !data) onAnnounce(`The explanation of ${text} didn't load.`);
    else if (!data.reliable) onAnnounce(`No reliable information on ${text}.`);
    else onAnnounce(`Explanation of ${text} loaded.`);
  }, [isLoading, isError, data, text, onAnnounce]);

  const asContext: ContextData | null = data
    ? {
        text: data.explanation,
        generated_at: data.generated_at,
        source: "selection",
        cached: data.cached,
        sources: data.sources,
      }
    : null;
  const busy = error instanceof ApiError && (error.status === 429 || error.status === 503);

  return (
    <div className="flex h-full flex-col">
      <div className="h-[3px] flex-shrink-0 bg-border" aria-hidden />
      <div className="flex items-center justify-between px-6 pb-1 pt-5">
        <span className="kicker">Selected text</span>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="-mr-2 flex h-8 w-8 items-center justify-center text-text-tertiary transition-colors hover:text-foreground"
        >
          <X size={16} />
          <span className="sr-only">Close explanation</span>
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-6">
        <h2 className="headline mt-1 break-words text-[26px]">&ldquo;{text}&rdquo;</h2>

        {isLoading ? (
          <div className="mt-5 space-y-2.5" aria-hidden>
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : isError || !data ? (
          <div className="mt-5 text-[15px] leading-relaxed text-text-secondary">
            <p>
              {busy
                ? "Samā4 can't explain more text right now. Try again in a little while."
                : "The explanation didn't load."}
            </p>
            <button type="button" onClick={() => refetch()} className="btn-outline mt-3">
              Try again
            </button>
          </div>
        ) : data.reliable && asContext ? (
          <>
            <p className="mt-4 text-[16.5px] leading-[1.6] text-foreground">{data.explanation}</p>
            <ExplanationSources context={asContext} />
            <p className="mt-3 font-ui text-[11.5px] leading-snug text-text-tertiary">
              Written by AI from the story and the sources above. It can be wrong; check the story.
            </p>
          </>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            Samā4 has no reliable information on this text, so it isn&apos;t guessing. Try selecting
            just a name or term, or read the story for what it says.
          </p>
        )}
      </div>
    </div>
  );
}
