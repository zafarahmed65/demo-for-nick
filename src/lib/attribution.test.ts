import { describe, expect, it } from "vitest";
import { campaignRows, campaignTotals, type ClosedLead } from "./attribution";
import type { Campaign, Lead } from "./types";

const CAMPAIGN: Campaign = {
  id: "cmp-test",
  name: "Test",
  channel: "Google Ads",
  spend: 4200,
  clicks: 1840,
  leads: 96,
  closings: 7,
};

function lead(campaignId = "cmp-test", id = "LD-1"): Lead {
  return {
    id,
    sellerName: "Seller",
    municipality: "Laval",
    jurisdictionCode: "QC",
    propertyValue: 450_000,
    locale: "fr",
    campaignId,
    gclid: "g",
    createdAt: 0,
  };
}

function closed(l: Lead): ClosedLead {
  return {
    lead: l,
    agentId: "ag-1",
    level: 0,
    decisionMs: 0.3,
    acceptedAfterMs: 2500,
    acceptedAt: 0,
    closedAt: 0,
  };
}

describe("cost per closing", () => {
  it("uses the seed baseline when the session is empty", () => {
    const [row] = campaignRows([], [], [CAMPAIGN]);
    expect(row.closings).toBe(7);
    expect(row.costPerClosing).toBeCloseTo(4200 / 7); // 600
    expect(row.sessionClosings).toBe(0);
  });

  it("moves by the arithmetically correct amount when a lead closes", () => {
    const l = lead();
    const [row] = campaignRows([l], [closed(l)], [CAMPAIGN]);
    expect(row.closings).toBe(8);
    // Not merely "different" — 4200/8 exactly.
    expect(row.costPerClosing).toBeCloseTo(525);
    expect(row.sessionClosings).toBe(1);
  });

  it("counts a routed lead against cost-per-lead even if it never closes", () => {
    const [row] = campaignRows([lead()], [], [CAMPAIGN]);
    expect(row.leads).toBe(97);
    expect(row.costPerLead).toBeCloseTo(4200 / 97);
    // The asymmetry is the point: leads move, closings do not.
    expect(row.closings).toBe(7);
  });

  it("attributes only to the campaign that owns the lead", () => {
    const other = lead("cmp-other", "LD-2");
    const [row] = campaignRows([other], [closed(other)], [CAMPAIGN]);
    expect(row.sessionLeads).toBe(0);
    expect(row.sessionClosings).toBe(0);
    expect(row.costPerClosing).toBeCloseTo(600);
  });

  it("reports Infinity rather than dividing by zero", () => {
    const [row] = campaignRows([], [], [{ ...CAMPAIGN, closings: 0 }]);
    expect(row.costPerClosing).toBe(Infinity);
  });

  it("totals spend across campaigns and divides by all closings", () => {
    const totals = campaignTotals(
      campaignRows([], [], [CAMPAIGN, { ...CAMPAIGN, id: "b", spend: 900, closings: 3 }]),
    );
    expect(totals.spend).toBe(5100);
    expect(totals.closings).toBe(10);
    expect(totals.costPerClosing).toBeCloseTo(510);
  });
});
