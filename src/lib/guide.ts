import type { Locale, LocalizedText } from "./types";
import type { ScenarioKey } from "./scenarios";
import type { View } from "./store";

/**
 * The guided walkthrough.
 *
 * Each step quotes the client's brief verbatim and then puts the thing that
 * answers it one press away. The quotes are deliberately NOT localized: they
 * are quotations attributed to him, and translating a person's own words back
 * at them destroys the entire effect.
 *
 * Completion is *observed*, never self-reported. Every step's predicate reads
 * facts the store already holds, so a step cannot be marked done unless the
 * thing actually happened — which is the whole point of showing rather than
 * telling.
 */

/** What the store knows about what the visitor has actually made happen. */
export interface GuideFacts {
  localeSwitched: boolean;
  hasRouted: boolean;
  hasEscalated: boolean;
  hasReassigned: boolean;
  hasRuntimeMarket: boolean;
  hasClosing: boolean;
}

export interface GuideStep {
  key: string;
  /** His words, verbatim, in the language he wrote them. */
  quote: string;
  view: View;
  /** Optional scenario the "show me" button runs. */
  scenario?: ScenarioKey;
  /** True once the visitor has genuinely done it. */
  isDone: (facts: GuideFacts) => boolean;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    key: "french-default",
    quote:
      "Quebec language law requires French-predominant public content, so French is the default experience, not a toggle.",
    view: "simulator",
    isDone: (f) => f.localeSwitched,
  },
  {
    key: "sixty-seconds",
    quote:
      "How would you architect lead routing so a lead reaches the right agent within 60 seconds…",
    view: "simulator",
    isDone: (f) => f.hasRouted,
  },
  {
    key: "no-response",
    quote: "…and what happens when they don't respond?",
    view: "simulator",
    scenario: "no-response",
    isDone: (f) => f.hasEscalated,
  },
  {
    key: "capacity-override",
    quote:
      "Automatic routing by jurisdiction, geography, capacity and round-robin, with full manual override.",
    view: "simulator",
    scenario: "at-capacity",
    isDone: (f) => f.hasReassigned,
  },
  {
    key: "new-market",
    quote:
      "How would you model jurisdictions so that adding Ontario after we've launched in Quebec requires no code changes?",
    view: "jurisdictions",
    scenario: "new-market",
    isDone: (f) => f.hasRuntimeMarket,
  },
  {
    key: "attribution",
    quote:
      "How would you track a lead from ad click through to closed sale so I can calculate my true cost per closing?",
    view: "attribution",
    isDone: (f) => f.hasClosing,
  },
];

/** Copy key for a step, so all instruction text stays in the locale files. */
export function stepCopy(step: GuideStep, part: "instruction" | "outcome"): string {
  return `guide.${step.key}.${part}`;
}

/** Attribution line under the quote, localized. */
export const QUOTE_SOURCE: LocalizedText = {
  fr: "votre appel d'offres",
  en: "your brief",
};

export function quoteSource(locale: Locale): string {
  return QUOTE_SOURCE[locale];
}
