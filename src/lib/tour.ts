import type { View } from "./store";
import type { NewJurisdictionInput } from "./store";

/**
 * The guided walkthrough, as a script of beats.
 *
 * The visitor has consented to being shown around, so the tour drives: it
 * presses the buttons, moves between screens, and narrates what just happened.
 * They watch, and can take over at any point with Pause.
 *
 * Every beat ends either when something observably true happens (`until`) or
 * after a fixed time (`hold`). When a beat has both, `hold` is a ceiling — so a
 * beat can never stall the tour if its condition somehow does not arrive.
 */

export interface TourFacts {
  routedCount: number;
  hasEscalated: boolean;
  isAwaiting: boolean;
  isAccepted: boolean;
  closingsCount: number;
  heldCount: number;
  hasRuntimeMarket: boolean;
  view: View;
}

/** What a beat is allowed to do to the console. */
export interface TourActions {
  reset: () => void;
  setSpeed: (n: number) => void;
  setView: (v: View) => void;
  armScript: (s: ("accept" | "ignore")[]) => void;
  armEscalationWindow: (ms: number | null) => void;
  trigger: () => void;
  accept: () => void;
  closeLead: () => void;
  triggerUnroutable: () => void;
  reassignFirstHeld: () => void;
  openJurisdictionForm: (open: boolean) => void;
  createFlorida: () => void;
}

export interface Beat {
  key: string;
  /** data-tour name to ring and attach the caption to. */
  anchor?: string;
  /** Screen this beat happens on; the tour navigates there itself. */
  view?: View;
  /** Performed once, this many ms after the beat opens. */
  act?: (a: TourActions) => void;
  actAfter?: number;
  /** Advance as soon as this is true. */
  until?: (f: TourFacts) => boolean;
  /** Advance after this long — and, alongside `until`, a stall ceiling. */
  hold?: number;
}

export const FLORIDA: NewJurisdictionInput = {
  code: "FL",
  name: "Florida",
  country: "US",
  currencyCode: "USD",
  commissionRate: 0.015,
  marketCommissionRate: 0.06,
  slaSeconds: 60,
  defaultLocale: "en",
  preset: "us-standard",
  municipalities: ["Miami", "Orlando", "Tampa", "Jacksonville"],
};

/** Nobody answers on their own: the tour decides when the lead is accepted. */
const SILENT: ("accept" | "ignore")[] = ["ignore", "ignore", "ignore"];

export const BEATS: Beat[] = [
  {
    key: "market",
    view: "simulator",
    anchor: "market-rail",
    act: (a) => {
      a.reset();
      a.setSpeed(10);
    },
    hold: 4500,
  },
  {
    key: "route",
    anchor: "trigger",
    act: (a) => {
      a.armScript(SILENT);
      // Short first window so the timeout is quick to watch; a patient one
      // afterwards so the tour can narrate the escalation and then accept,
      // instead of the lead falling through every broker into the queue.
      a.armEscalationWindow(60_000);
      a.trigger();
    },
    actAfter: 1600,
    until: (f) => f.routedCount > 0,
    hold: 6000,
  },
  { key: "decision-log", anchor: "trace", hold: 7000 },
  { key: "assigned", anchor: "roster-active", hold: 4500 },
  {
    key: "countdown",
    anchor: "countdown",
    until: (f) => f.hasEscalated,
    hold: 12000,
  },
  { key: "escalated", anchor: "roster-active", hold: 5000 },
  {
    key: "accept",
    anchor: "accept",
    act: (a) => a.accept(),
    actAfter: 2600,
    until: (f) => f.isAccepted,
    hold: 7000,
  },
  { key: "load", anchor: "roster-active", hold: 4500 },
  {
    key: "close",
    anchor: "close-lead",
    act: (a) => a.closeLead(),
    actAfter: 3000,
    until: (f) => f.closingsCount > 0,
    hold: 7000,
  },
  {
    key: "unroutable",
    anchor: "hold-queue",
    act: (a) => {
      a.armEscalationWindow(null);
      a.triggerUnroutable();
    },
    actAfter: 1200,
    until: (f) => f.heldCount > 0,
    hold: 6000,
  },
  { key: "hold-explained", anchor: "hold-queue", hold: 5500 },
  {
    key: "override",
    anchor: "reassign",
    act: (a) => a.reassignFirstHeld(),
    actAfter: 3200,
    until: (f) => f.heldCount === 0,
    hold: 7000,
  },
  {
    key: "jurisdictions",
    view: "jurisdictions",
    anchor: "add-jurisdiction",
    act: (a) => a.openJurisdictionForm(true),
    actAfter: 2200,
    hold: 5000,
  },
  {
    key: "create-market",
    view: "jurisdictions",
    anchor: "add-jurisdiction",
    act: (a) => a.createFlorida(),
    actAfter: 1800,
    until: (f) => f.hasRuntimeMarket,
    hold: 6000,
  },
  { key: "market-created", view: "jurisdictions", anchor: "market-rail", hold: 5000 },
  {
    key: "attribution",
    view: "attribution",
    anchor: "cost-per-closing",
    hold: 8000,
  },
  { key: "done", hold: 0 },
];

/** His brief, verbatim, shown on the beats that answer a specific question. */
export const BEAT_QUOTES: Record<string, string> = {
  route:
    "How would you architect lead routing so a lead reaches the right agent within 60 seconds…",
  countdown: "…and what happens when they don't respond?",
  unroutable:
    "Automatic routing by jurisdiction, geography, capacity and round-robin, with full manual override.",
  jurisdictions:
    "How would you model jurisdictions so that adding Ontario after we've launched in Quebec requires no code changes?",
  attribution:
    "How would you track a lead from ad click through to closed sale so I can calculate my true cost per closing?",
};
