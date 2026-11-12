"use client";

import { useEffect, useRef } from "react";
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

    // ── Mobile menu ──
    const burger = $<HTMLElement>("#hamburger");
    const menu = $<HTMLElement>("#mobileMenu");
    if (burger && menu) {
      on(burger, "click", () => {
        burger.classList.toggle("active");
        menu.classList.toggle("open");
      });
      menu.querySelectorAll("a").forEach((a) =>
        on(a, "click", () => {
          burger.classList.remove("active");
          menu.classList.remove("open");
        }),
      );
    }

    // ── In-page anchors: scroll inside the app's content pane, keep the URL clean ──
    el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
      on(a, "click", (ev) => {
        const target = el.querySelector(a.getAttribute("href") ?? "");
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );

    // ── Stats count-up ──
    const stats = Array.from(el.querySelectorAll<HTMLElement>(".stat-number[data-target]"));
    const countUp = (s: HTMLElement) => {
      const target = parseFloat(s.dataset.target ?? "0");
      const { suffix = "", prefix = "" } = s.dataset;
      const isFloat = target % 1 !== 0;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / 1600, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        s.textContent =
          prefix + (isFloat ? (target * eased).toFixed(1) : Math.round(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const statsRow = $(".stats-row");
    if (statsRow && stats.length)
      observe(
        [statsRow],
        (e, obs) => {
          if (e.isIntersecting) {
            stats.forEach((s, i) => later(() => countUp(s), i * 150));
            obs.disconnect();
          }
        },
        0.3,
      );

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
      on(form, "submit", async (ev) => {
        ev.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[type="email"]');
        if (!input) return;
        form.classList.remove("error");
        error?.classList.remove("visible");
        form.classList.add("loading");
        input.disabled = true;
        try {
          const res = await joinRef.current(input.value);
          form.style.display = "none";
          if (success) {
            if (res.status === "exists") success.textContent = "✓ You're already on the list.";
            success.style.display = "block";
          }
        } catch (err) {
          form.classList.remove("loading");
          form.classList.add("error");
          input.disabled = false;
          if (error) {
            error.textContent =
              err instanceof ApiError && err.status === 429
                ? "Too many tries from this network. Try again in an hour."
                : err instanceof ApiError && err.status === 422
                  ? "That doesn't look like a valid email address."
                  : "Something went wrong. Please try again.";
            error.classList.add("visible");
          }
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
      {/* The original page's own top nav is hidden in the app (landing.css); this bar
          uses the app's chrome so it's clear the sidebar is the navigation. */}
      <header className="sticky top-0 z-[101] flex h-14 items-center gap-2 border-b bg-surface/90 px-4 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="-ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-text-secondary hover:bg-background-secondary hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden /> Back to today&apos;s stories
        </Link>
        <nav aria-label="On this page" className="ml-auto hidden items-center gap-1 sm:flex">
          {[
            ["#how", "How it works"],
            ["#features", "Features"],
            ["#waitlist", "Join the waitlist"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={jump(href)}
              className="flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-text-secondary hover:bg-background-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      {/* Static, trusted markup generated from the original page (no user input). */}
      <div ref={root} className="s4-landing" dangerouslySetInnerHTML={{ __html: LANDING_MARKUP }} />
    </div>
  );
}
