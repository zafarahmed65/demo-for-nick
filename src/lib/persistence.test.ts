import { afterEach, describe, expect, it, vi } from "vitest";
import { clearState, loadState, saveState, type PersistedState } from "./persistence";
import { QUEBEC } from "./jurisdictions";
import { SEED_AGENTS } from "./seed";

/**
 * These cover the defensive paths, which are the whole reason this module
 * exists as a wrapper rather than as inline localStorage calls. A private
 * window, blocked site data or an exceeded quota must degrade to seed state.
 */

const KEY = "lead-engine.v3";

function stubStorage(impl: Partial<Storage>) {
  const store = { getItem: () => null, setItem: () => {}, removeItem: () => {}, ...impl };
  vi.stubGlobal("window", { localStorage: store });
  return store;
}

function validState(): PersistedState {
  return {
    version: 3,
    jurisdictions: [QUEBEC],
    agents: SEED_AGENTS,
    jurisdictionCode: "QC",
    locale: "fr",
    speed: 4,
    municipalityOverride: null,
    held: [],
    routedLeads: [],
    closings: [],
    hasEscalated: false,
    hasReassigned: false,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("round trip", () => {
  it("restores what it stored", () => {
    let written = "";
    stubStorage({
      setItem: (_k: string, v: string) => { written = v; },
      getItem: () => written,
    });

    const state = validState();
    saveState(state);
    const restored = loadState();

    expect(restored?.jurisdictionCode).toBe("QC");
    expect(restored?.jurisdictions[0].code).toBe("QC");
    expect(restored?.agents).toHaveLength(SEED_AGENTS.length);
    // Nested localized structures must survive serialization intact.
    expect(restored?.jurisdictions[0].terminology.agent.fr).toBe("courtier immobilier");
    expect(restored?.jurisdictions[0].workflow.length).toBe(QUEBEC.workflow.length);
  });

  it("returns null when nothing has been stored", () => {
    stubStorage({ getItem: () => null });
    expect(loadState()).toBeNull();
  });
});

describe("hostile storage", () => {
  it("returns null instead of throwing when reads are blocked", () => {
    stubStorage({
      getItem: () => { throw new DOMException("SecurityError"); },
    });
    expect(() => loadState()).not.toThrow();
    expect(loadState()).toBeNull();
  });

  it("swallows a quota error on write", () => {
    stubStorage({
      setItem: () => { throw new DOMException("QuotaExceededError"); },
    });
    expect(() => saveState(validState())).not.toThrow();
  });

  it("swallows a failure on clear", () => {
    stubStorage({
      removeItem: () => { throw new DOMException("SecurityError"); },
    });
    expect(() => clearState()).not.toThrow();
  });

  it("is inert when there is no window at all (server render)", () => {
    vi.stubGlobal("window", undefined);
    expect(loadState()).toBeNull();
    expect(() => saveState(validState())).not.toThrow();
    expect(() => clearState()).not.toThrow();
  });
});

describe("rejecting untrustworthy data", () => {
  const rejects = (raw: string) => {
    stubStorage({ getItem: () => raw });
    expect(loadState()).toBeNull();
  };

  it("rejects malformed JSON", () => rejects("{not json"));
  it("rejects a null payload", () => rejects("null"));
  it("rejects a stale schema version", () =>
    rejects(JSON.stringify({ ...validState(), version: 2 })));
  it("rejects an empty jurisdiction list", () =>
    rejects(JSON.stringify({ ...validState(), jurisdictions: [] })));
  it("rejects an unsupported locale", () =>
    rejects(JSON.stringify({ ...validState(), locale: "de" })));
  it("rejects a missing field", () => {
    const partial: Record<string, unknown> = { ...validState() };
    delete partial.agents;
    rejects(JSON.stringify(partial));
  });

  it("ignores a key written by a different version", () => {
    stubStorage({
      getItem: (k: string) => (k === KEY ? null : JSON.stringify(validState())),
    });
    expect(loadState()).toBeNull();
  });
});
