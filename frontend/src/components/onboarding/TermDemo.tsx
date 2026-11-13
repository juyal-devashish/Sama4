"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EntityBadge } from "@/components/ui/entity-badge";
import { entityColor } from "@/lib/utils";

const NAME = "International Monetary Fund";

/** A one-sentence story with one highlighted term: the intro teaches by letting you try it. */
export function TermDemo() {
  const [open, setOpen] = useState(false);
  const color = entityColor("organization");

  return (
    <div className="rounded-xl border bg-surface p-5">
      <p aria-live="polite" className="font-editorial text-[13px] font-medium text-text-tertiary">
        {open ? "That's it. Every story works like this." : "Try it: select the highlighted name."}
      </p>
      <p className="mt-2 text-[17px] leading-relaxed">
        Finance ministers met the{" "}
        <button
          type="button"
          className="term text-left font-ui"
          style={{ ["--term-color" as string]: color }}
          aria-expanded={open}
          aria-controls={open ? "term-demo-explainer" : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          {NAME}
        </button>{" "}
        on Tuesday to discuss a new loan.
      </p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="term-demo-explainer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="mt-4 rounded-lg border-l-2 bg-background-secondary/60 p-4"
              style={{ borderLeftColor: color }}
            >
              <EntityBadge type="organization" />
              <p className="mt-1 font-editorial text-[15px] font-semibold">{NAME}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
                An international organization, founded in 1944, that lends money to countries in
                financial trouble and keeps watch over the world economy.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
