import type { PredictionMethod } from "@/types";

/** Shown wherever an outlook appears: it is a projection, not reporting. */
export const OUTLOOK_DISCLAIMER =
  "AI-generated projection by samā4. These are estimates of what could happen, not reporting or confirmed events.";

export const CONFIDENCE_HELP =
  "The model's own rating of its main projection. It is not a measured probability and has not been checked against outcomes.";

export const IMPACT_HELP =
  "The model's 0–100 estimate of how much the outcome could affect people. It ranks the Outlook list; it does not say how important or true the story is.";

export const REACTION_HELP =
  "Estimated by the model. Not a poll, survey or measurement of real people.";

export const PERSONA_HELP =
  "Fictional people written by samā4's AI to stand for different stakeholders. They are not real people, and their words are not real quotes.";

/** What the "how it was made" figure means for this outlook. */
export function methodSummary(
  method: PredictionMethod | undefined,
  agentCount: number,
  rounds: number,
  viewpoints: number,
): { label: string; value: string; help: string } {
  if (method === "simulation") {
    return {
      label: "Agents simulated",
      value: String(agentCount),
      help: `A simulation ran ${agentCount} AI agents reacting to the story over ${rounds} rounds. The ${viewpoints} viewpoints below were picked by the model as representative of them.`,
    };
  }
  return {
    label: "Viewpoints written",
    value: String(viewpoints),
    help: "No crowd simulation ran for this story. samā4's AI wrote these viewpoints directly from the story.",
  };
}

/** What the outlook was based on, and a warning when that was thin. */
export function basisNote(publisher: string, words: number, summaryOnly: boolean): string {
  if (summaryOnly || words === 0) {
    return `Based only on samā4's summary of the story; the full text from ${publisher} wasn't available. Treat it as a rough sketch.`;
  }
  const base = `Based only on the ${words}-word text samā4 has from ${publisher}.`;
  return words < 250
    ? `${base} That's a short excerpt, so treat this outlook as a rough sketch.`
    : base;
}
