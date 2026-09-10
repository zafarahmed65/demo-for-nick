import type { View } from "./store";

/**
 * The anchored walkthrough.
 *
 * Each step points at a real control and waits. The visitor presses every
 * button themselves; the tour only points, explains and confirms — a demo you
 * merely watch is a slower video.
 *
 * Two rules shape the data below:
 *
 * 1. Most interesting controls are conditionally rendered — Accept exists only
 *    while a lead is awaiting, the stage buttons only once it is accepted. So a
 *    step declares the `view` it lives in and a `needs` predicate. When its
 *    anchor is not on screen the bubble points at `fallbackAnchor` instead,
 *    which is whatever makes the real anchor appear.
 *
 * 2. Completion is observed, never self-reported. `isDone` reads facts the
 *    store already holds, so a step cannot advance because someone clicked
 *    Next — only because the thing actually happened.
 */

export interface TourFacts {
  routedCount: number;
  hasEscalated: boolean;
  isAwaiting: boolean;
  isAccepted: boolean;
  closingsCount: number;
  hasRuntimeMarket: boolean;
  view: View;
}

export interface TourStep {
  key: string;
  /** data-tour value of the element to point at. */
  anchor: string;
  /** Where the anchor lives. */
  view: View;
  /** Shown instead when the real anchor is not rendered yet. */
  fallbackAnchor?: string;
  /** His brief, verbatim. Never translated — it is a quotation. */
  quote?: string;
  /** True once the visitor has genuinely done it. */
  isDone: (f: TourFacts) => boolean;
  /** Steps the walkthrough can set up itself, because waiting is the point. */
  scripted?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    key: "route",
    anchor: "trigger",
    view: "simulator",
    quote:
      "How would you architect lead routing so a lead reaches the right agent within 60 seconds…",
    isDone: (f) => f.routedCount > 0,
    scripted: true,
  },
  {
    key: "no-response",
    anchor: "countdown",
    view: "simulator",
    fallbackAnchor: "trigger",
    quote: "…and what happens when they don't respond?",
    isDone: (f) => f.hasEscalated,
  },
  {
    key: "accept",
    anchor: "accept",
    view: "simulator",
    fallbackAnchor: "trigger",
    isDone: (f) => f.isAccepted || f.closingsCount > 0,
  },
  {
    key: "close",
    anchor: "close-lead",
    view: "simulator",
    fallbackAnchor: "trigger",
    isDone: (f) => f.closingsCount > 0,
  },
  {
    key: "new-market",
    anchor: "add-jurisdiction",
    view: "jurisdictions",
    fallbackAnchor: "nav-jurisdictions",
    quote:
      "How would you model jurisdictions so that adding Ontario after we've launched in Quebec requires no code changes?",
    isDone: (f) => f.hasRuntimeMarket,
  },
  {
    key: "attribution",
    anchor: "nav-attribution",
    view: "attribution",
    quote:
      "How would you track a lead from ad click through to closed sale so I can calculate my true cost per closing?",
    // Final step: reaching the view is the whole of it.
    isDone: (f) => f.view === "attribution",
  },
];

/**
 * Broker responses for the walkthrough's lead.
 *
 * Nobody auto-accepts. Step 2 needs the first broker to stay silent so the
 * escalation is guaranteed, and step 3 needs the lead still waiting when the
 * visitor gets there — an auto-accept at level 1 would take the button away
 * before they could press it. Accepting is their job, not the simulation's.
 */
export const ROUTE_SCRIPT: ("accept" | "ignore")[] = [
  "ignore",
  "ignore",
  "ignore",
];
