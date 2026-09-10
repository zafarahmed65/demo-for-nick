import type { Agent, Jurisdiction } from "./types";

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
