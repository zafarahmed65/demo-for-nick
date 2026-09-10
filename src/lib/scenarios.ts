import type { Agent, Jurisdiction } from "./types";

/**
 * Guided scenarios.
 *
 * A first-time visitor who presses the trigger once will most likely watch a
 * broker accept in three seconds and conclude the system "assigns leads" —
 * never seeing escalation, capacity exhaustion or runtime jurisdictions. These
 * scenarios exist so the interesting behaviour cannot be missed.
 *
 * They set the board up and then stop. The visitor still pulls every trigger,
 * because a demo you watch is just a slower video.
 */

export type ScenarioKey = "no-response" | "at-capacity" | "new-market";

export const SCENARIO_KEYS: ScenarioKey[] = [
  "no-response",
  "at-capacity",
  "new-market",
];

/**
 * How a broker will answer when a scenario needs a guaranteed outcome, indexed
 * by escalation level. Real responsiveness is a dice roll; a scenario promising
 * "the broker does not respond" cannot afford one.
 */
export type ForcedResponse = "accept" | "ignore";

export const FORCED_BY_SCENARIO: Partial<Record<ScenarioKey, ForcedResponse[]>> = {
  // First broker stays silent so the SLA expires; the second one accepts, so
  // the visitor sees the whole arc rather than a lead falling into the queue.
  "no-response": ["ignore", "accept"],
};

/**
 * A town covered by exactly one licensed broker. Filling that broker's cap
 * makes the town unroutable, which is the clearest demonstration of why a
 * capacity limit matters: the system stops and escalates to a human instead of
 * quietly overloading someone.
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
