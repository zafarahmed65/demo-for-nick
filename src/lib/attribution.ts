import { SEED_CAMPAIGNS } from "./seed";
import type { Campaign, Lead } from "./types";

/**
 * Attribution maths.
 *
 * The campaign id is stamped onto a lead the moment it is created and is still
 * attached when that lead closes, so cost per closing is a join rather than an
 * estimate. Seed figures are the historical baseline; anything closed during
 * this session is added on top, which is what lets the number visibly move
 * while someone is watching.
 */

export interface ClosedLead {
  lead: Lead;
  agentId: string;
  /** Escalation level the accepting broker was on. */
  level: number;
  /** How long routeLead itself took, in ms. */
  decisionMs: number;
  /** How long the broker took to accept, in ms. */
  acceptedAfterMs: number;
  acceptedAt: number;
  closedAt: number;
}

export interface CampaignRow extends Campaign {
  costPerLead: number;
  costPerClosing: number;
  /** Leads and closings contributed by this session, for the delta badge. */
  sessionLeads: number;
  sessionClosings: number;
}

/**
 * Merge the seed baseline with this session's activity.
 *
 * `routed` is every lead created this session; `closed` is the subset that
 * reached a terminal workflow stage. A lead counts toward its campaign's lead
 * total as soon as it exists, and toward closings only once it closes — which
 * is exactly the asymmetry that makes cost-per-closing worth measuring.
 */
export function campaignRows(
  routed: Lead[],
  closed: ClosedLead[],
  baseline: Campaign[] = SEED_CAMPAIGNS,
): CampaignRow[] {
  return baseline.map((campaign) => {
    const sessionLeads = routed.filter((l) => l.campaignId === campaign.id).length;
    const sessionClosings = closed.filter(
      (c) => c.lead.campaignId === campaign.id,
    ).length;

    const leads = campaign.leads + sessionLeads;
    const closings = campaign.closings + sessionClosings;

    return {
      ...campaign,
      leads,
      closings,
      sessionLeads,
      sessionClosings,
      costPerLead: leads > 0 ? campaign.spend / leads : 0,
      costPerClosing: closings > 0 ? campaign.spend / closings : Infinity,
    };
  });
}

export interface CampaignTotals {
  spend: number;
  clicks: number;
  leads: number;
  closings: number;
  costPerLead: number;
  costPerClosing: number;
}

export function campaignTotals(rows: CampaignRow[]): CampaignTotals {
  const spend = rows.reduce((n, r) => n + r.spend, 0);
  const clicks = rows.reduce((n, r) => n + r.clicks, 0);
  const leads = rows.reduce((n, r) => n + r.leads, 0);
  const closings = rows.reduce((n, r) => n + r.closings, 0);
  return {
    spend,
    clicks,
    leads,
    closings,
    costPerLead: leads > 0 ? spend / leads : 0,
    costPerClosing: closings > 0 ? spend / closings : Infinity,
  };
}
