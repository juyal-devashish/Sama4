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
    <div className="border-y-2 border-foreground py-5">
      <p aria-live="polite" className="kicker">
        {open ? "That's it. Every story works like this." : "Try it: select the highlighted name."}
      </p>
      <p className="mt-2 text-[19px] leading-relaxed">
        Finance ministers met the{" "}
        <button
          type="button"
          className="term text-left font-editorial"
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
              className="mt-4 border-l-2 bg-background-secondary/60 p-4"
              style={{ borderLeftColor: color }}
            >
              <EntityBadge type="organization" />
              <p className="headline mt-1 text-[24px]">{NAME}</p>
              <p className="mt-1.5 text-[15.5px] leading-relaxed text-text-secondary">
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
