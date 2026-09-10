import { describe, expect, it } from "vitest";
import { routeLead } from "./routing";
import { QUEBEC } from "./jurisdictions";
import { singleBrokerMunicipality } from "./scenarios";
import { SEED_AGENTS } from "./seed";
import type { Agent, Jurisdiction, Lead, Locale, TraceEntry } from "./types";

/**
 * Tests for the routing engine.
 *
 * routeLead is pure — no clock, no I/O — which is exactly why it can be pinned
 * down this precisely. The last three cases are regression guards for bugs that
 * actually shipped during this build: French agreement, French leaking into the
 * English trace, and the assumption that a jurisdiction is hard-coded.
 */

function agent(overrides: Partial<Agent> & { id: string }): Agent {
  return {
    name: overrides.id,
    initials: "XX",
    jurisdictions: ["QC"],
    coverage: [],
    languages: ["fr"],
    activeFiles: 0,
    capacity: 10,
    lastAssignedAt: 0,
    responsiveness: 1,
    ...overrides,
  };
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "LD-0001",
    sellerName: "Test Seller",
    municipality: "Laval",
    jurisdictionCode: "QC",
    propertyValue: 450_000,
    locale: "fr",
    campaignId: "cmp-test",
    gclid: "test",
    createdAt: 0,
    ...overrides,
  };
}

const ids = (agents: Agent[]) => agents.map((a) => a.id);
const find = (steps: TraceEntry[], fragment: string) =>
  steps.find((s) => s.message.fr.includes(fragment) || s.message.en.includes(fragment));

describe("eligibility filters", () => {
  it("excludes brokers not licensed in the jurisdiction", () => {
    const plan = routeLead(lead(), QUEBEC, [
      agent({ id: "qc", jurisdictions: ["QC"] }),
      agent({ id: "on", jurisdictions: ["ON"] }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["qc"]);
  });

  it("excludes brokers who do not cover the municipality", () => {
    const plan = routeLead(lead({ municipality: "Laval" }), QUEBEC, [
      agent({ id: "laval", coverage: ["Laval"] }),
      agent({ id: "quebec-city", coverage: ["Québec"] }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["laval"]);
  });

  it("treats empty coverage as serving the whole jurisdiction", () => {
    const plan = routeLead(lead({ municipality: "Gatineau" }), QUEBEC, [
      agent({ id: "everywhere", coverage: [] }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["everywhere"]);
  });

  it("excludes brokers at or over capacity", () => {
    const plan = routeLead(lead(), QUEBEC, [
      agent({ id: "room", activeFiles: 9, capacity: 10 }),
      agent({ id: "exactly-full", activeFiles: 10, capacity: 10 }),
      agent({ id: "over", activeFiles: 11, capacity: 10 }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["room"]);
  });

  it("excludes brokers who do not speak the seller's language", () => {
    const plan = routeLead(lead({ locale: "en" }), QUEBEC, [
      agent({ id: "bilingual", languages: ["fr", "en"] }),
      agent({ id: "fr-only", languages: ["fr"] }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["bilingual"]);
  });
});

describe("ranking", () => {
  it("puts the least recently assigned broker first", () => {
    const plan = routeLead(lead(), QUEBEC, [
      agent({ id: "recent", lastAssignedAt: 5_000 }),
      agent({ id: "stale", lastAssignedAt: 1_000 }),
      agent({ id: "middle", lastAssignedAt: 3_000 }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["stale", "middle", "recent"]);
  });

  it("breaks ties on load ratio, not absolute file count", () => {
    const plan = routeLead(lead(), QUEBEC, [
      // 8/20 = 0.4 load, but more files in absolute terms than the other.
      agent({ id: "big-desk", activeFiles: 8, capacity: 20, lastAssignedAt: 0 }),
      // 5/10 = 0.5 load.
      agent({ id: "small-desk", activeFiles: 5, capacity: 10, lastAssignedAt: 0 }),
    ]);
    expect(ids(plan.escalationOrder)).toEqual(["big-desk", "small-desk"]);
  });
});

describe("no eligible broker", () => {
  it("returns an empty order and emits a hold step", () => {
    const plan = routeLead(lead(), QUEBEC, [
      agent({ id: "full", activeFiles: 10, capacity: 10 }),
    ]);
    expect(plan.escalationOrder).toHaveLength(0);
    expect(plan.steps.at(-1)?.kind).toBe("hold");
  });

  it("emits no hold step when someone is eligible", () => {
    const plan = routeLead(lead(), QUEBEC, [agent({ id: "free" })]);
    expect(plan.steps.some((s) => s.kind === "hold")).toBe(false);
    expect(plan.steps.at(-1)?.kind).toBe("assign");
  });
});

describe("decision trace", () => {
  it("applies filters in the documented order", () => {
    const plan = routeLead(lead(), QUEBEC, [agent({ id: "a" })]);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "intake",
      "resolve",
      "filter", // licence
      "filter", // geography
      "filter", // capacity
      "filter", // language
      "assign",
    ]);
  });

  it("reports the decision as sub-millisecond work", () => {
    const plan = routeLead(lead(), QUEBEC, [agent({ id: "a" })]);
    expect(plan.decisionMs).toBeLessThan(50);
  });

  // --- Regression guards -------------------------------------------------

  it("agrees French verbs and adjectives with the count", () => {
    const one = routeLead(lead(), QUEBEC, [agent({ id: "solo", coverage: ["Laval"] })]);
    expect(find(one.steps, "couvre")?.message.fr).toContain("1 couvre Laval");
    expect(find(one.steps, "admissible")?.message.fr).toContain("1 admissible");

    const many = routeLead(lead(), QUEBEC, [
      agent({ id: "a", coverage: ["Laval"] }),
      agent({ id: "b", coverage: ["Laval"] }),
      agent({ id: "c", coverage: ["Laval"] }),
    ]);
    expect(find(many.steps, "couvrent")?.message.fr).toContain("3 couvrent Laval");
    expect(find(many.steps, "admissibles")?.message.fr).toContain("3 admissibles");
  });

  it("never leaks French into the English trace", () => {
    const plan = routeLead(lead({ locale: "en" }), QUEBEC, [
      agent({ id: "a", languages: ["fr", "en"] }),
    ]);
    const french = /\b(courtiers?|restants?|décision|Filtre|Juridiction|admissibles?|couvrent?)\b/i;
    for (const entry of plan.steps) {
      expect(entry.message.en).not.toMatch(french);
      if (entry.annotation) {
        expect(entry.annotation.en).not.toMatch(french);
        // Both locales must always be present, never a bare string.
        expect(entry.annotation.fr).toBeTypeOf("string");
      }
    }
  });

  it("routes a jurisdiction invented at runtime, with no code change", () => {
    // The shape the admin form produces: different country, currency, rate,
    // language and workflow. Nothing about it exists in the codebase.
    const florida: Jurisdiction = {
      code: "FL",
      name: { fr: "Floride", en: "Florida" },
      country: "US",
      currencyCode: "USD",
      defaultLocale: "en",
      requiredLocales: ["en"],
      commissionRate: 0.015,
      marketCommissionRate: 0.06,
      slaSeconds: 45,
      escalationLevels: 2,
      terminology: {
        agent: { fr: "courtier", en: "agent" },
        agentPlural: { fr: "courtiers", en: "agents" },
      },
      legalDisclosure: { fr: "—", en: "—" },
      workflow: [
        { key: "new", label: { fr: "Nouveau", en: "New" }, requiredDocuments: [] },
      ],
      municipalities: ["Miami", "Orlando"],
      createdAtRuntime: true,
    };

    const plan = routeLead(
      lead({ jurisdictionCode: "FL", municipality: "Miami", locale: "en" as Locale }),
      florida,
      [
        agent({ id: "fl-1", jurisdictions: ["FL"], languages: ["en"] }),
        agent({ id: "qc-1", jurisdictions: ["QC"], languages: ["en"] }),
      ],
    );

    expect(ids(plan.escalationOrder)).toEqual(["fl-1"]);
    // Currency, rate and SLA all come from the record, not from a branch.
    expect(find(plan.steps, "Jurisdiction")?.message.en).toContain("SLA 45s");
    expect(find(plan.steps, "Jurisdiction")?.message.en).toContain("1.5%");
    // US formatting, not the "450 000 $" Quebec form.
    expect(find(plan.steps, "Lead received")?.message.en).toContain("$450,000");
  });
});

describe("scenario helpers", () => {
  it("finds a town covered by exactly one licensed broker", () => {
    const found = singleBrokerMunicipality(QUEBEC, SEED_AGENTS);
    expect(found).not.toBeNull();
    const covering = SEED_AGENTS.filter(
      (a) =>
        a.jurisdictions.includes("QC") &&
        (a.coverage.length === 0 || a.coverage.includes(found!.town)),
    );
    // The scenario depends on this being exactly one — with two, filling one
    // broker's cap would not make the town unroutable and the demo would lie.
    expect(covering).toHaveLength(1);
    expect(covering[0].id).toBe(found!.agent.id);
  });

  it("returns null when every town has depth", () => {
    const everywhere = [
      { ...SEED_AGENTS[0], coverage: [] },
      { ...SEED_AGENTS[1], coverage: [] },
    ];
    expect(singleBrokerMunicipality(QUEBEC, everywhere)).toBeNull();
  });
});
