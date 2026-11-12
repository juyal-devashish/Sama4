"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Circle, Loader2, Minus, Send } from "lucide-react";
import {
  useAgentInterview,
  useCancelPrediction,
  usePrediction,
  usePredictionChat,
  usePredictionStatus,
  useTriggerSimulation,
} from "@/hooks/usePrediction";
import { RUNNING_PREDICTION_STATES, cn } from "@/lib/utils";
import {
  CONFIDENCE_HELP,
  IMPACT_HELP,
  OUTLOOK_DISCLAIMER,
  PERSONA_HELP,
  REACTION_HELP,
  basisNote,
  methodSummary,
  progressSteps,
} from "@/lib/outlook";
import { PrimaryButton, SecondaryButton } from "@/components/ui/states";
import type { AgentPerspective, PredictionDetail } from "@/types";

const STANCE: Record<string, { label: string; color: string }> = {
  positive: { label: "Supportive", color: "var(--success)" },
  negative: { label: "Opposed", color: "var(--error)" },
  neutral: { label: "Neutral", color: "var(--text-tertiary)" },
  mixed: { label: "Mixed", color: "var(--entity-event)" },
};

const OUTCOME_LABELS = ["Most likely", "Possible", "Less likely"];

const STATUS_COPY: Record<string, string> = {
  queued: "Waiting to start",
  building_graph: "Mapping who is involved",
  simulating: "Simulating reactions",
  generating_report: "Writing the outlook",
};

/** "What might happen next": multi-agent prediction for one story. */
export type OutlookBasis = { publisher: string; words: number; summaryOnly: boolean };

export function OutlookSection({
  articleId,
  articleTitle,
  basis,
}: {
  articleId: string;
  articleTitle: string;
  /** The text the outlook is generated from, so the reader can judge how thin it was. */
  basis: OutlookBasis;
}) {
  const { data: prediction, refetch } = usePrediction(articleId);
  const trigger = useTriggerSimulation();
  const cancel = useCancelPrediction(articleId);
  const running = !!prediction && RUNNING_PREDICTION_STATES.includes(prediction.status);
  const { data: status } = usePredictionStatus(prediction?.id ?? "", running);
  const current = status?.status ?? prediction?.status ?? "";
  // A run just started but not loaded yet: keep Run disabled so it can't be started twice.
  const starting =
    trigger.isPending || (trigger.isSuccess && !running && prediction?.id !== trigger.data?.id);
  const cancelled = cancel.isSuccess && cancel.variables === prediction?.id && !running;

  // Statuses this run has been seen in, so skipped steps aren't shown as done.
  const seen = useRef<{ id?: string; statuses: Set<string> }>({ statuses: new Set() });
  if (prediction && seen.current.id !== prediction.id) {
    seen.current = { id: prediction.id, statuses: new Set() };
  }
  if (current) seen.current.statuses.add(current);

  // Tell screen-reader users when a run they started finishes while they read on.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (status?.status === "completed" || status?.status === "failed") refetch();
    if (status?.status === "completed") setAnnouncement("The outlook for this story is ready.");
    if (status?.status === "failed") setAnnouncement("The outlook for this story didn't finish.");
  }, [status?.status, refetch]);

  return (
    <section id="outlook" aria-labelledby="outlook-title" className="scroll-mt-20 border-t pt-10">
      <h2 id="outlook-title" className="font-display text-[22px] font-semibold tracking-[-0.01em]">
        What might happen next
      </h2>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-text-tertiary">
        {OUTLOOK_DISCLAIMER}
      </p>

      {prediction?.status === "completed" ? (
        <OutlookReport prediction={prediction} articleTitle={articleTitle} basis={basis} />
      ) : running ? (
        <div className="mt-4 rounded-xl border px-4 py-3.5">
          <ol aria-label="Outlook progress" className="space-y-1.5 text-[14px]">
            {progressSteps(current, seen.current.statuses).map((step) => (
              <li
                key={step.label}
                aria-current={step.state === "current" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2.5",
                  step.state === "current" ? "font-medium text-foreground" : "text-text-tertiary",
                )}
              >
                {step.state === "current" ? (
                  <Loader2 size={15} className="animate-spin text-accent-primary" aria-hidden />
                ) : step.state === "done" ? (
                  <Check size={15} className="text-success" aria-hidden />
                ) : step.state === "skipped" ? (
                  <Minus size={15} aria-hidden />
                ) : (
                  <Circle size={13} className="mx-px" aria-hidden />
                )}
                <span>
                  {step.label}
                  {step.state === "skipped" && " (skipped)"}
                  {step.state === "done" && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13.5px] text-text-secondary" role="status">
            {STATUS_COPY[current] ?? "Working"}. This usually takes a few minutes; you can keep
            reading.
          </p>
          <SecondaryButton
            className="mt-3"
            disabled={cancel.isPending}
            onClick={() => prediction && cancel.mutate(prediction.id)}
          >
            {cancel.isPending ? "Cancelling" : "Cancel outlook"}
          </SecondaryButton>
          {cancel.isError && (
            <p className="mt-2 text-[13px] text-error">
              Couldn&apos;t cancel. It may have just finished; reload to check.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
            {cancelled
              ? "You cancelled the outlook. You can run it again whenever you like."
              : prediction?.status === "failed"
                ? "The last outlook for this story didn't finish. You can run it again."
                : "samā4 can simulate how the people and groups in this story are likely to react, and what that could lead to. It takes a few minutes."}
          </p>
          <PrimaryButton
            className="mt-4"
            disabled={starting}
            onClick={() => trigger.mutate({ articleId })}
          >
            {starting && <Loader2 size={14} className="animate-spin" />}
            {starting
              ? "Starting"
              : prediction?.status === "failed"
                ? "Run outlook again"
                : "Run outlook"}
          </PrimaryButton>
          {trigger.isError && (
            <p className="mt-2 text-[13px] text-error">
              The outlook didn&apos;t start. Check the server and try again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function parseSentiment(
  raw?: string,
): { positive: number; neutral: number; negative: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.positive === "number") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function OutlookReport({
  prediction,
  articleTitle,
  basis,
}: {
  prediction: PredictionDetail;
  articleTitle: string;
  basis: OutlookBasis;
}) {
  const sentiment = parseSentiment(prediction.sentiment_distribution);
  const confidence =
    prediction.confidence_score != null ? Math.round(prediction.confidence_score * 100) : null;
  const method = methodSummary(
    prediction.method,
    prediction.agent_count,
    prediction.simulation_rounds,
    prediction.agent_perspectives.length,
  );

  return (
    <div className="mt-4 space-y-10">
      <div>
        <p className="mb-4 rounded-lg bg-background-secondary px-3.5 py-2.5 text-[13.5px] leading-relaxed text-text-secondary">
          {basisNote(basis.publisher, basis.words, basis.summaryOnly)}
        </p>
        {prediction.prediction_summary && (
          <p className="text-[17px] leading-[1.7]">{prediction.prediction_summary}</p>
        )}
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          {confidence != null && (
            <Stat label="Model confidence" value={`${confidence}%`} help={CONFIDENCE_HELP} />
          )}
          <Stat
            label="Impact (estimate)"
            value={`${Math.round(prediction.impact_score)} / 100`}
            help={IMPACT_HELP}
          />
          <Stat label={method.label} value={method.value} help={method.help} />
        </dl>
      </div>

      {prediction.predicted_outcomes.length > 0 && (
        <div>
          <h3 className="font-display text-[15px] font-semibold">Possible outcomes</h3>
          <ol className="mt-3 space-y-3">
            {prediction.predicted_outcomes.map((o, i) => (
              <li key={i} className="grid grid-cols-[96px_1fr] gap-4 text-[15px] leading-relaxed">
                <span
                  className={cn(
                    "pt-0.5 font-display text-[12.5px] font-semibold",
                    i === 0 ? "text-success" : i === 1 ? "text-entity-event" : "text-text-tertiary",
                  )}
                >
                  {OUTCOME_LABELS[Math.min(i, 2)]}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {prediction.key_findings.length > 0 && (
        <div>
          <h3 className="font-display text-[15px] font-semibold">Key findings</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed marker:text-text-tertiary">
            {prediction.key_findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {sentiment && (
        <div>
          <h3 className="font-display text-[15px] font-semibold">Estimated public reaction</h3>
          <p className="mt-1 text-[13.5px] text-text-tertiary">{REACTION_HELP}</p>
          <div
            className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-background-secondary"
            aria-hidden
          >
            <div style={{ width: `${sentiment.positive}%`, backgroundColor: "var(--success)" }} />
            <div
              style={{ width: `${sentiment.neutral}%`, backgroundColor: "var(--text-tertiary)" }}
            />
            <div style={{ width: `${sentiment.negative}%`, backgroundColor: "var(--error)" }} />
          </div>
          <p className="mt-2 flex gap-5 text-[13px] text-text-secondary">
            <span>Positive {sentiment.positive}%</span>
            <span>Neutral {sentiment.neutral}%</span>
            <span>Negative {sentiment.negative}%</span>
          </p>
        </div>
      )}

      {prediction.agent_perspectives.length > 0 && (
        <div>
          <h3 className="font-display text-[15px] font-semibold">Simulated viewpoints</h3>
          <p className="mt-1 max-w-[62ch] text-[13.5px] text-text-tertiary">
            {PERSONA_HELP} Open one to ask it a question.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {prediction.agent_perspectives.map((a) => (
              <Stakeholder key={a.id} agent={a} predictionId={prediction.id} />
            ))}
          </div>
        </div>
      )}

      <OutlookChat predictionId={prediction.id} articleTitle={articleTitle} />
    </div>
  );
}

function Stat({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-text-tertiary">{label}</dt>
      <dd className="font-display text-[20px] font-semibold tabular-nums">{value}</dd>
      <dd className="mt-1 text-[12.5px] leading-snug text-text-secondary">{help}</dd>
    </div>
  );
}

function Stakeholder({ agent, predictionId }: { agent: AgentPerspective; predictionId: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const interview = useAgentInterview();
  const stance = STANCE[agent.stance] ?? STANCE.neutral;

  const ask = async () => {
    const q = question.trim();
    if (!q || interview.isPending) return;
    setQuestion("");
    try {
      const res = await interview.mutateAsync({
        prediction_id: predictionId,
        agent_perspective_id: agent.id,
        question: q,
      });
      setAnswers((prev) => [...prev, { q, a: res.response }]);
    } catch {
      setAnswers((prev) => [...prev, { q, a: "No answer came back. Ask again in a moment." }]);
    }
  };

  return (
    <div className={cn("rounded-xl border bg-surface", open && "lg:col-span-2")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-[14px] font-semibold"
          style={{ backgroundColor: "var(--background-secondary)", color: stance.color }}
          aria-hidden
        >
          {agent.agent_name.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-display text-[14px] font-semibold">
              {agent.agent_name}
            </span>
            <span className="flex-shrink-0 text-[12px] font-medium" style={{ color: stance.color }}>
              {stance.label}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
            <span className="flex-shrink-0 rounded border px-1.5 text-[10.5px] font-medium">
              AI persona
            </span>
            <span className="truncate">{agent.agent_role}</span>
          </span>
          {!open && agent.key_argument && (
            <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-snug text-text-secondary">
              {agent.key_argument}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "mt-1 flex-shrink-0 text-text-tertiary transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="text-[14.5px] leading-[1.65]">{agent.perspective_text}</p>
          {agent.key_argument && (
            <blockquote
              className="mt-3 border-l-2 pl-3 text-[14px] italic text-text-secondary"
              style={{ borderColor: stance.color }}
            >
              {agent.key_argument}
            </blockquote>
          )}
          {answers.map((x, i) => (
            <div key={i} className="mt-4">
              <p className="font-display text-[13.5px] font-semibold">{x.q}</p>
              <p className="mt-1 text-[14px] leading-[1.6] text-foreground">{x.a}</p>
            </div>
          ))}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask ${agent.agent_name} a question`}
              aria-label={`Ask ${agent.agent_name} a question`}
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-[13.5px] outline-none placeholder:text-text-tertiary focus:border-accent-secondary"
            />
            <SecondaryButton type="submit" disabled={!question.trim() || interview.isPending}>
              {interview.isPending ? <Loader2 size={14} className="animate-spin" /> : "Ask"}
            </SecondaryButton>
          </form>
        </div>
      )}
    </div>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function OutlookChat({
  predictionId,
  articleTitle,
}: {
  predictionId: string;
  articleTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = usePredictionChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, chat.isPending]);

  const send = async () => {
    const text = input.trim();
    if (!text || chat.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    try {
      const res = await chat.mutateAsync({
        prediction_id: predictionId,
        message: text,
        history: next,
      });
      setMessages([...next, { role: "assistant", content: res.response }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "No answer came back. Ask again in a moment." },
      ]);
    }
  };

  return (
    <div className="rounded-xl border bg-background-secondary/50">
      <div className="px-5 pt-4">
        <h3 className="font-display text-[15px] font-semibold">Ask about this outlook</h3>
        {messages.length === 0 && (
          <p className="mt-1 text-[13.5px] text-text-tertiary">
            For example: what would change the outcome of &ldquo;
            {articleTitle.length > 60 ? `${articleTitle.slice(0, 60)}…` : articleTitle}&rdquo;?
          </p>
        )}
      </div>
      {messages.length > 0 && (
        <div aria-live="polite" className="space-y-3 px-5 pt-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-[1.6]",
                  m.role === "user" ? "bg-accent-primary text-on-accent" : "border bg-surface",
                )}
              >
                {m.content}
              </p>
            </div>
          ))}
          {chat.isPending && (
            <p className="inline-flex items-center gap-2 text-[13.5px] text-text-tertiary">
              <Loader2 size={13} className="animate-spin" /> Writing an answer
            </p>
          )}
          <div ref={endRef} />
        </div>
      )}
      <form
        className="flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What happens if…"
          aria-label="Ask about this outlook"
          className="h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3.5 text-[14px] outline-none placeholder:text-text-tertiary focus:border-accent-secondary"
        />
        <button
          type="submit"
          disabled={!input.trim() || chat.isPending}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send size={15} />
          <span className="sr-only">Send</span>
        </button>
      </form>
    </div>
  );
}
