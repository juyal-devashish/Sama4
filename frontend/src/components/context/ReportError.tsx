"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { useReportExplanation } from "@/hooks/useReportExplanation";
import { ApiError } from "@/lib/api";
import type { ReportReason } from "@/types";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "wrong_thing", label: "It's about the wrong person or thing" },
  { value: "wrong_fact", label: "A fact is wrong" },
  { value: "outdated", label: "It's out of date" },
  { value: "other", label: "Something else" },
];

/** "Report an error" under an explanation: a reason, an optional note, then thanks. */
export function ReportError({
  entityId,
  entityName,
  articleId,
  explanation,
}: {
  entityId: string;
  entityName: string;
  articleId: string;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const report = useReportExplanation(entityId);
  const firstRadio = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) firstRadio.current?.focus();
  }, [open]);

  if (report.isSuccess) {
    return (
      <p role="status" className="mt-3 font-ui text-[12px] text-text-secondary">
        Thanks. We&apos;ll check the explanation of {entityName}.
      </p>
    );
  }

  if (!open) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label-ui link-ui inline-flex min-h-6 items-center gap-1.5 text-text-tertiary hover:text-foreground"
        >
          <Flag size={11} aria-hidden /> Report an error
        </button>
        <Link
          href="/how-explanations-work"
          className="label-ui link-ui inline-flex min-h-6 items-center text-text-tertiary hover:text-foreground"
        >
          How explanations are made
        </Link>
      </p>
    );
  }

  const failed = report.error
    ? report.error instanceof ApiError && report.error.status === 429
      ? "Too many reports from here. Try again later."
      : "The report didn't send. Try again."
    : null;

  return (
    <form
      className="mt-3 border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason || report.isPending) return;
        report.mutate({
          reason,
          article_id: articleId,
          explanation_text: explanation,
          note: note.trim() || undefined,
        });
      }}
    >
      <fieldset>
        <legend className="label-ui font-bold text-foreground">
          What&apos;s wrong with this explanation?
        </legend>
        <div className="mt-2 space-y-1.5">
          {REASONS.map((r, i) => (
            <label key={r.value} className="flex items-center gap-2 font-ui text-[13px]">
              <input
                ref={i === 0 ? firstRadio : undefined}
                type="radio"
                name={`report-reason-${entityId}`}
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label
        htmlFor={`report-note-${entityId}`}
        className="label-ui mt-3 block text-text-secondary"
      >
        Details (optional)
      </label>
      <textarea
        id={`report-note-${entityId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        className="mt-1 w-full border border-border bg-background px-2 py-1.5 font-ui text-[13px] text-foreground outline-none focus:border-foreground"
      />
      {failed && (
        <p role="alert" className="mt-2 font-ui text-[12px] text-error">
          {failed}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={!reason || report.isPending} className="btn-ink">
          {report.isPending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}
