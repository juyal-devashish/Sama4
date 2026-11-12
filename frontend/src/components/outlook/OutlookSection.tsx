"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Send } from "lucide-react";
import {
  useAgentInterview,
  usePrediction,
  usePredictionChat,
  usePredictionStatus,
  useTriggerSimulation,
} from "@/hooks/usePrediction";
import { RUNNING_PREDICTION_STATES, cn } from "@/lib/utils";
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
export function OutlookSection({
  articleId,
  articleTitle,
}: {
  articleId: string;
  articleTitle: string;
}) {
  const { data: prediction, refetch } = usePrediction(articleId);
  const trigger = useTriggerSimulation();
  const running = !!prediction && RUNNING_PREDICTION_STATES.includes(prediction.status);
  const { data: status } = usePredictionStatus(prediction?.id ?? "", running);

  useEffect(() => {
    if (status?.status === "completed" || status?.status === "failed") refetch();
  }, [status?.status, refetch]);

  return (
    <section id="outlook" aria-labelledby="outlook-title" className="scroll-mt-20 border-t pt-10">
      <h2 id="outlook-title" className="font-display text-[22px] font-semibold tracking-[-0.01em]">
        What might happen next
      </h2>

      {prediction?.status === "completed" ? (
        <OutlookReport prediction={prediction} articleTitle={articleTitle} />
      ) : running ? (
        <div className="mt-4 flex items-center gap-3 text-[14.5px] text-text-secondary">
          <Loader2 size={16} className="animate-spin text-accent-primary" />
          <span>
            {status?.progress_message ||
              STATUS_COPY[status?.status ?? prediction!.status] ||
              "Working"}
            . This usually takes a few minutes; you can keep reading.
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
            {prediction?.status === "failed"
              ? "The last outlook for this story didn't finish. You can run it again."
              : "samā4 can simulate how the people and groups in this story are likely to react, and what that could lead to. It takes a few minutes."}
          </p>
          <PrimaryButton
            className="mt-4"
            disabled={trigger.isPending}
            onClick={() => trigger.mutate({ articleId })}
          >
            {trigger.isPending && <Loader2 size={14} className="animate-spin" />}
            {trigger.isPending
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
}: {
  prediction: PredictionDetail;
  articleTitle: string;
}) {
  const sentiment = parseSentiment(prediction.sentiment_distribution);
  const confidence =
    prediction.confidence_score != null ? Math.round(prediction.confidence_score * 100) : null;

  return (
    <div className="mt-4 space-y-10">
      <div>
        {prediction.prediction_summary && (
          <p className="text-[17px] leading-[1.7]">{prediction.prediction_summary}</p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
          {confidence != null && <Stat label="Confidence" value={`${confidence}%`} />}
          <Stat label="Impact" value={`${Math.round(prediction.impact_score)} / 100`} />
          <Stat label="Perspectives simulated" value={String(prediction.agent_count)} />
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
          <h3 className="font-display text-[15px] font-semibold">Public reaction</h3>
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
          <h3 className="font-display text-[15px] font-semibold">How people involved see it</h3>
          <p className="mt-1 text-[13.5px] text-text-tertiary">
            Open a perspective to ask that person a question.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-text-tertiary">{label}</dt>
      <dd className="font-display text-[20px] font-semibold tabular-nums">{value}</dd>
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
          <span className="block truncate text-[12.5px] text-text-tertiary">
            {agent.agent_role}
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
        <div className="space-y-3 px-5 pt-4">
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
