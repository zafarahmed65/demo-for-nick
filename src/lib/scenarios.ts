import type { Agent, Jurisdiction } from "./types";

/** How a broker answers when the outcome is scripted rather than rolled. */
export type ScriptedResponse = "accept" | "ignore" | "decline";

/**
 * The first four leads tell a story.
 *
 * Left to chance, pressing the trigger rolls each broker's responsiveness, so
 * two people clicking the same button see different things and a recording is
 * never repeatable. These four walk through the behaviours the brief actually
 * asks about, in the order you would want to be shown them. Press five onwards
 * is random again — a demo that loops through four fixed outcomes forever stops
 * looking like an engine.
 */
export const DEMO_SEQUENCE: (ScriptedResponse[] | null)[] = [
  // 1 — the happy path: routed and accepted inside the window.
  ["accept"],
  // 2 — declined, rerouted immediately, taken by the next broker.
  ["decline", "accept"],
  // 3 — silence, the deadline passes, it escalates on its own.
  ["ignore", "accept"],
  // 4 — nobody takes it: hold queue, and a human has to step in.
  ["ignore", "ignore", "ignore"],
];

/**
 * A town covered by exactly one licensed broker.
 *
 * Filling that broker's capacity makes the town unroutable, which is the
 * clearest way to show why a capacity limit matters: the system stops and
 * escalates to a human rather than quietly overloading someone.
 */
export function singleBrokerMunicipality(
  jurisdiction: Jurisdiction,
  agents: Agent[],
): { town: string; agent: Agent } | null {
  const licensed = agents.filter((a) =>
    a.jurisdictions.includes(jurisdiction.code),
  );
  for (const town of jurisdiction.municipalities) {
    const covering = licensed.filter(
      (a) => a.coverage.length === 0 || a.coverage.includes(town),
    );
    if (covering.length === 1) return { town, agent: covering[0] };
  }
  return null;
}
