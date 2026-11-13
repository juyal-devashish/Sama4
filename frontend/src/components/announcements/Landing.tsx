"use client";

import { memo, useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useJoinWaitlist } from "@/hooks/useJoinWaitlist";
import { ApiError } from "@/lib/api";
import "./landing.css";
import { LANDING_MARKUP } from "./landingMarkup";

/**
 * The original sama4.online waitlist page, kept as-is but themed with the app's
 * tokens (see landing.css). Markup is static and trusted (landingMarkup.ts); this
 * component re-attaches the page's behaviour, scoped to its own root element.
 */
export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const join = useJoinWaitlist();
  const joinRef = useRef(join.mutateAsync);
  joinRef.current = join.mutateAsync;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(sel: string) => el.querySelector<T>(sel);
    const cleanups: (() => void)[] = [];
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const on = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn);
      cleanups.push(() => target.removeEventListener(type, fn));
    };
    const observe = (
      targets: Element[],
      fn: (entry: IntersectionObserverEntry, obs: IntersectionObserver) => void,
      threshold: number,
    ) => {
      const obs = new IntersectionObserver((entries) => entries.forEach((e) => fn(e, obs)), {
        threshold,
      });
      targets.forEach((t) => obs.observe(t));
      cleanups.push(() => obs.disconnect());
    };

    // ── Interactive demo: highlight terms one by one, show context cards ──
    const terms = Array.from(el.querySelectorAll<HTMLElement>(".demo-term"));
    const status = $<HTMLElement>("#demoStatus");
    const statusText = $<HTMLElement>("#statusText");
    const card = $<HTMLElement>("#demoContextCard");
    const badge = $<HTMLElement>("#appBadge");
    const showCard = (term: HTMLElement) => {
      if (!card) return;
      card.replaceChildren(
        ...(
          [
            ["context-card-type", term.dataset.type],
            ["context-card-title", term.dataset.title],
            ["context-card-body", term.dataset.desc],
          ] as const
        ).map(([cls, text]) => {
          const div = document.createElement("div");
          div.className = cls;
          div.textContent = text ?? "";
          return div;
        }),
      );
      requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("visible")));
    };
    const hideCard = () => card?.classList.remove("visible");
    let played = false;
    const runDemo = () => {
      if (played) return;
      played = true;
      if (statusText) statusText.textContent = "Scanning article…";
      terms.forEach((term, i) => {
        later(
          () => {
            term.classList.add("highlighted");
            term.style.animation = "s4-highlightIn 0.4s ease forwards";
            if (i < 3) {
              showCard(term);
              later(hideCard, 2000);
            }
            if (i === terms.length - 1) {
              later(() => {
                if (statusText) statusText.textContent = `${terms.length} terms contextualized`;
                status?.classList.add("done");
                if (badge) badge.style.display = "";
              }, 600);
            }
          },
          1200 + i * 900,
        );
      });
    };
    terms.forEach((term) => {
      // Hover is a shortcut; a click (or tap) shows the card too.
      on(term, "mouseenter", () => term.classList.contains("highlighted") && showCard(term));
      on(term, "click", () => term.classList.contains("highlighted") && showCard(term));
      on(term, "mouseleave", hideCard);
    });
    const demo = $(".hero-demo");
    if (demo)
      observe(
        [demo],
        (e, obs) => {
          if (e.isIntersecting) {
            later(runDemo, 800);
            obs.disconnect();
          }
        },
        0.3,
      );

    // ── In-page anchors: scroll inside the app's content pane, keep the URL clean ──
    el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
      on(a, "click", (ev) => {
        const target = el.querySelector(a.getAttribute("href") ?? "");
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );

    // Stats render their final values in the markup: no count-up from a misleading
    // zero (and nothing to animate for readers who prefer reduced motion).

    // ── Scroll reveal ──
    observe(
      Array.from(el.querySelectorAll(".reveal")),
      (e) => e.isIntersecting && e.target.classList.add("visible"),
      0.1,
    );

    // ── Waitlist form → POST /api/v1/waitlist ──
    const form = $<HTMLFormElement>("#waitlistForm");
    const success = $<HTMLElement>("#formSuccess");
    const error = $<HTMLElement>("#formError");
    if (form) {
      const field = form.querySelector<HTMLInputElement>('input[type="email"]');
      if (field)
        on(field, "input", () => {
          form.classList.remove("error");
          field.removeAttribute("aria-invalid");
          if (error) error.textContent = "";
        });
      on(form, "submit", async (ev) => {
        ev.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[type="email"]');
        if (!input) return;
        const showError = (message: string) => {
          form.classList.add("error");
          input.setAttribute("aria-invalid", "true");
          if (error) error.textContent = message;
          input.focus();
        };
        form.classList.remove("error");
        input.removeAttribute("aria-invalid");
        if (error) error.textContent = "";
        // The form is novalidate so these messages are ours: visible, inline and
        // announced (role=alert), instead of the browser's tooltip.
        input.value = input.value.trim();
        if (!input.value) return showError("Enter your email address.");
        if (input.validity.typeMismatch)
          return showError("That doesn't look like an email address. Try name@example.com.");
        form.classList.add("loading");
        input.disabled = true;
        try {
          const res = await joinRef.current(input.value);
          form.style.display = "none";
          const label = el.querySelector<HTMLElement>(".waitlist-label");
          if (label) label.style.display = "none";
          if (success) {
            // Show first, then set the text, so the role=status region announces it.
            const message =
              res.status === "exists"
                ? "✓ You're already on the list."
                : (success.textContent ?? "");
            success.style.display = "block";
            success.textContent = "";
            requestAnimationFrame(() => (success.textContent = message));
          }
        } catch (err) {
          form.classList.remove("loading");
          input.disabled = false;
          showError(
            err instanceof ApiError && err.status === 429
              ? "Too many tries from this network. Try again in an hour."
              : err instanceof ApiError && err.status === 422
                ? "That doesn't look like an email address. Try name@example.com."
                : "Something went wrong and you're not on the list yet. Please try again.",
          );
        }
      });
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    root.current?.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      {/* The page's only navigation besides the app's sidebar. Below `sm` the on-page
          links are display:none, which also hides them from assistive tech. */}
      <header className="sticky top-0 z-[101] flex h-12 items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="label-ui flex h-9 items-center gap-1.5 text-text-secondary hover:text-foreground"
        >
          <ArrowLeft size={13} aria-hidden /> Back to today&apos;s stories
        </Link>
        <nav aria-label="On this page" className="ml-auto hidden items-center gap-1 sm:flex">
          {[
            ["#how", "How it works"],
            ["#features", "Features"],
            ["#waitlist", "Get early access"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={jump(href)}
              className="label-ui flex h-9 items-center px-3 text-text-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <LandingMarkup rootRef={root} />
    </div>
  );
}

/**
 * Static, trusted markup generated from the original page (no user input).
 *
 * Memoized so it never re-renders: the effect above attaches listeners to these
 * nodes, and a re-render (e.g. the waitlist request changing state) made React
 * re-apply the HTML, replacing the nodes, so error and success messages were
 * written to detached elements and never shown.
 */
const LandingMarkup = memo(function LandingMarkup({
  rootRef,
}: {
  rootRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={rootRef}
      className="s4-landing"
      dangerouslySetInnerHTML={{ __html: LANDING_MARKUP }}
    />
  );
});
