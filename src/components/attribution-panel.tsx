"use client";

import { MousePointerClick, FileInput, Route, UserCheck, Home, BadgeCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { SEED_CAMPAIGNS } from "@/lib/seed";
import { campaignRows, campaignTotals } from "@/lib/attribution";
import { formatMoney } from "@/lib/routing";
import { Panel, Badge } from "./ui";

/**
 * Cost per closing is the only number that matters here, and it is only
 * knowable because the campaign id is carried on the lead from the first
 * click through to the closed transaction — not reconstructed afterwards.
 */
export function AttributionPanel() {
  const { jurisdiction, locale, routedLeads, closings, agents, t } = useStore();

  // Seed figures are the historical baseline; this session adds to them, which
  // is what lets cost-per-closing move while someone is watching it.
  const rows = campaignRows(routedLeads, closings);
  const totals = campaignTotals(rows);

  const latest = closings.length > 0 ? closings[closings.length - 1] : null;
  const best = rows.reduce((a, b) => (a.costPerClosing <= b.costPerClosing ? a : b));
  const worst = rows.reduce((a, b) => (a.costPerClosing >= b.costPerClosing ? a : b));
  const money = (v: number) => formatMoney(v, jurisdiction, locale);

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-y-auto scroll-slim pr-0.5">
      <Panel title={t("attr.title")}>
        <p className="px-5 pb-4 text-small text-ink-500 leading-relaxed max-w-[76ch]">
          {t("attr.lede")}
        </p>

        <div className="overflow-x-auto scroll-slim border-t border-[var(--hairline)]">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                <Th align="left">{t("attr.campaign")}</Th>
                <Th>{t("attr.spend")}</Th>
                <Th>{t("attr.clicks")}</Th>
                <Th>{t("attr.leads")}</Th>
                <Th>{t("attr.closings")}</Th>
                <Th>{t("attr.cpl")}</Th>
                <Th emphasis dataTour="cost-per-closing">{t("attr.cpa")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--hairline)] hover:bg-ink-50 transition-colors duration-150"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-small text-ink-900 whitespace-nowrap">
                        {row.name}
                      </span>
                      {row.id === best.id && <Badge tone="ok">{t("attr.best")}</Badge>}
                      {row.id === worst.id && (
                        <Badge tone="danger">{t("attr.worst")}</Badge>
                      )}
                    </div>
                    <span className="text-micro text-ink-400">{row.channel}</span>
                  </td>
                  <Td>{money(row.spend)}</Td>
                  <Td muted>{row.clicks.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</Td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-small tabular text-ink-500">
                      {row.leads}
                    </span>
                    {row.sessionLeads > 0 && (
                      <span className="ml-1.5 font-mono text-micro tabular text-pine-700 font-medium">
                        +{row.sessionLeads}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-small tabular text-ink-800">
                      {row.closings}
                    </span>
                    {row.sessionClosings > 0 && (
                      <span className="ml-1.5 font-mono text-micro tabular text-pine-700 font-medium">
                        +{row.sessionClosings}
                      </span>
                    )}
                  </td>
                  <Td muted>{money(row.costPerLead)}</Td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`font-mono text-small tabular font-medium transition-colors duration-300 ${
                        row.sessionClosings > 0
                          ? "text-pine-700"
                          : row.id === best.id
                            ? "text-ok-700"
                            : row.id === worst.id
                              ? "text-danger-700"
                              : "text-ink-800"
                      }`}
                    >
                      {money(row.costPerClosing)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-ink-50">
                <td className="px-5 py-3 text-small font-medium text-ink-900 whitespace-nowrap">
                  {t("attr.total")}
                </td>
                <Td strong>{money(totals.spend)}</Td>
                <Td strong>{totals.clicks.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</Td>
                <Td strong>{totals.leads}</Td>
                <Td strong>{totals.closings}</Td>
                <Td strong>{money(totals.spend / totals.leads)}</Td>
                <td className="px-5 py-3 text-right">
                  <span className="font-mono text-small tabular font-semibold text-pine-700">
                    {money(totals.spend / totals.closings)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={t("attr.journey")}
        meta={latest ? latest.lead.id : t("attr.journeyEmpty")}
      >
        {latest ? (
          <>
            <ol className="px-5 pb-5 flex flex-wrap items-stretch gap-0">
              {(() => {
                /* The real lead: its own click id, its own routing decision,
                   the broker who actually took it, real timestamps. */
                const tag = locale === "fr" ? "fr-CA" : "en-CA";
                const stamp = (ms: number) =>
                  new Intl.DateTimeFormat(tag, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(ms));
                const broker = agents.find((a) => a.id === latest.agentId);
                const campaign = SEED_CAMPAIGNS.find(
                  (c) => c.id === latest.lead.campaignId,
                );

                return [
                  {
                    icon: MousePointerClick,
                    key: "click",
                    detail: `gclid=${latest.lead.gclid.slice(0, 14)}…`,
                    at: stamp(latest.lead.createdAt),
                  },
                  {
                    icon: FileInput,
                    key: "form",
                    detail: campaign?.name ?? latest.lead.campaignId,
                    at: stamp(latest.lead.createdAt),
                  },
                  {
                    icon: Route,
                    key: "routed",
                    detail: `${latest.lead.jurisdictionCode} · ${latest.lead.municipality} · ${latest.decisionMs.toFixed(1)} ms`,
                    at: stamp(latest.lead.createdAt),
                  },
                  {
                    icon: UserCheck,
                    key: "accepted",
                    detail: `${broker?.name ?? "—"} · ${(latest.acceptedAfterMs / 1000).toFixed(1)}${locale === "fr" ? " s" : "s"}`,
                    at: stamp(latest.acceptedAt),
                  },
                  {
                    icon: Home,
                    key: "listed",
                    detail: money(latest.lead.propertyValue),
                    at: stamp(latest.acceptedAt),
                  },
                  {
                    icon: BadgeCheck,
                    key: "closed",
                    detail: money(
                      latest.lead.propertyValue * jurisdiction.commissionRate,
                    ),
                    at: stamp(latest.closedAt),
                  },
                ].map((node, index, all) => {
                  const Icon = node.icon;
                  const last = index === all.length - 1;
                  return (
                    <li key={node.key} className="flex items-center min-w-0">
                      <div className="min-w-[124px]">
                        <div
                          className={`size-7 rounded-full grid place-items-center border ${
                            last
                              ? "bg-pine-600 border-pine-600 text-white"
                              : "bg-white border-ink-300 text-ink-500"
                          }`}
                        >
                          <Icon size={13} />
                        </div>
                        <p className="text-micro font-medium text-ink-800 mt-1.5">
                          {t(`journey.${node.key}`)}
                        </p>
                        <p className="font-mono text-micro text-ink-400 tabular truncate">
                          {node.detail}
                        </p>
                        <p className="text-micro text-ink-400">{node.at}</p>
                      </div>
                      {!last && (
                        <div className="h-px w-5 bg-ink-300 shrink-0 mb-9 -ml-4 mr-1" />
                      )}
                    </li>
                  );
                });
              })()}
            </ol>
            <p className="px-5 pb-5 text-micro text-ink-400 max-w-[76ch]">
              {locale === "fr"
                ? "L'identifiant de campagne est porté par le lead à chaque étape. Aucune reconstruction a posteriori : le coût par transaction est une jointure, pas une estimation."
                : "The campaign id is carried on the lead at every stage. Nothing is reconstructed after the fact — cost per closing is a join, not an estimate."}
            </p>
          </>
        ) : (
          <p className="px-5 pb-6 text-small text-ink-500 max-w-[76ch]">
            {t("attr.journeyHint")}
          </p>
        )}
      </Panel>
    </div>
  );
}

function Th({
  children,
  align = "right",
  emphasis,
  dataTour,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  emphasis?: boolean;
  dataTour?: string;
}) {
  return (
    <th
      data-tour={dataTour}
      className={`px-5 py-3 text-small font-medium whitespace-nowrap ${
        align === "left" ? "text-left" : "text-right"
      } ${emphasis ? "text-pine-700" : "text-ink-500"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  muted,
  strong,
}: {
  children: React.ReactNode;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <td className="px-5 py-3 text-right">
      <span
        className={`font-mono text-small tabular ${
          strong
            ? "text-ink-900 font-medium"
            : muted
              ? "text-ink-500"
              : "text-ink-800"
        }`}
      >
        {children}
      </span>
    </td>
  );
}
