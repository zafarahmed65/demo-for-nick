"use client";

import { MousePointerClick, FileInput, Route, UserCheck, Home, BadgeCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { SEED_CAMPAIGNS } from "@/lib/seed";
import { formatMoney } from "@/lib/routing";
import { Panel, Badge } from "./ui";

/**
 * Cost per closing is the only number that matters here, and it is only
 * knowable because the campaign id is carried on the lead from the first
 * click through to the closed transaction — not reconstructed afterwards.
 */
export function AttributionPanel() {
  const { jurisdiction, locale, t } = useStore();

  const rows = SEED_CAMPAIGNS.map((c) => ({
    ...c,
    costPerLead: c.spend / c.leads,
    costPerClosing: c.closings > 0 ? c.spend / c.closings : Infinity,
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + r.leads,
      closings: acc.closings + r.closings,
    }),
    { spend: 0, clicks: 0, leads: 0, closings: 0 },
  );

  const best = rows.reduce((a, b) => (a.costPerClosing <= b.costPerClosing ? a : b));
  const worst = rows.reduce((a, b) => (a.costPerClosing >= b.costPerClosing ? a : b));
  const money = (v: number) => formatMoney(v, jurisdiction, locale);

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-y-auto scroll-slim pr-0.5">
      <Panel title={t("attr.title")}>
        <p className="px-4 pt-3 pb-3 text-xs text-ink-600 leading-relaxed max-w-[76ch]">
          {t("attr.lede")}
        </p>

        <div className="overflow-x-auto scroll-slim border-t border-[var(--hairline)]">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                <Th align="left">{t("attr.campaign")}</Th>
                <Th>{t("attr.spend")}</Th>
                <Th>{t("attr.clicks")}</Th>
                <Th>{t("attr.leads")}</Th>
                <Th>{t("attr.closings")}</Th>
                <Th>{t("attr.cpl")}</Th>
                <Th emphasis>{t("attr.cpa")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--hairline)] hover:bg-ink-50 transition-colors duration-150"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-800">{row.name}</span>
                      {row.id === best.id && <Badge tone="ok">{t("attr.best")}</Badge>}
                      {row.id === worst.id && (
                        <Badge tone="danger">{t("attr.worst")}</Badge>
                      )}
                    </div>
                    <span className="text-2xs text-ink-400">{row.channel}</span>
                  </td>
                  <Td>{money(row.spend)}</Td>
                  <Td muted>{row.clicks.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</Td>
                  <Td muted>{row.leads}</Td>
                  <Td>{row.closings}</Td>
                  <Td muted>{money(row.costPerLead)}</Td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`font-mono text-xs tabular font-medium ${
                        row.id === best.id
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
                <td className="px-4 py-2.5 text-xs font-medium text-ink-900">
                  {t("attr.total")}
                </td>
                <Td strong>{money(totals.spend)}</Td>
                <Td strong>{totals.clicks.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</Td>
                <Td strong>{totals.leads}</Td>
                <Td strong>{totals.closings}</Td>
                <Td strong>{money(totals.spend / totals.leads)}</Td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-mono text-xs tabular font-semibold text-pine-700">
                    {money(totals.spend / totals.closings)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t("attr.journey")} meta="LD-4823">
        <ol className="px-4 py-4 flex flex-wrap items-stretch gap-0">
          {(() => {
            /* Dates and money are formatted from the active locale rather than
               written out, so the chain reads correctly in both languages. */
            const tag = locale === "fr" ? "fr-CA" : "en-CA";
            const day = (iso: string) =>
              new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(
                new Date(iso),
              );
            const time = (iso: string) =>
              new Intl.DateTimeFormat(tag, {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(iso));

            return [
              {
                icon: MousePointerClick,
                key: "click",
                detail: "gclid=Cj0KCQiA8…",
                at: `${day("2025-08-12T19:04")} · ${time("2025-08-12T19:04")}`,
              },
              {
                icon: FileInput,
                key: "form",
                detail: "utm_campaign=laval",
                at: `${day("2025-08-12T19:06")} · ${time("2025-08-12T19:06")}`,
              },
              {
                icon: Route,
                key: "routed",
                detail: "QC · Laval · 11 ms",
                at: `${day("2025-08-12T19:06")} · ${time("2025-08-12T19:06")}`,
              },
              {
                icon: UserCheck,
                key: "accepted",
                detail: `S. Gagnon · 41${locale === "fr" ? " s" : "s"}`,
                at: `${day("2025-08-12T19:07")} · ${time("2025-08-12T19:07")}`,
              },
              {
                icon: Home,
                key: "listed",
                detail: money(489_000),
                at: day("2025-08-19T10:00"),
              },
              {
                icon: BadgeCheck,
                key: "closed",
                detail: money(9_780),
                at: day("2025-10-02T10:00"),
              },
            ].map((node, index, all) => {
              const Icon = node.icon;
              const last = index === all.length - 1;
              return (
                <li key={node.key} className="flex items-center min-w-0">
                  <div className="min-w-[112px]">
                    <div
                      className={`size-7 rounded-full grid place-items-center border ${
                        last
                          ? "bg-pine-600 border-pine-600 text-white"
                          : "bg-white border-ink-300 text-ink-500"
                      }`}
                    >
                      <Icon size={13} />
                    </div>
                    <p className="text-2xs font-medium text-ink-800 mt-1.5">
                      {t(`journey.${node.key}`)}
                    </p>
                    <p className="font-mono text-2xs text-ink-400 tabular truncate">
                      {node.detail}
                    </p>
                    <p className="text-2xs text-ink-400">{node.at}</p>
                  </div>
                  {!last && (
                    <div className="h-px w-5 bg-ink-300 shrink-0 mb-9 -ml-4 mr-1" />
                  )}
                </li>
              );
            });
          })()}
        </ol>
        <p className="px-4 pb-3.5 text-2xs text-ink-500 max-w-[76ch]">
          {locale === "fr"
            ? "L'identifiant de campagne est porté par le lead à chaque étape. Aucune reconstruction a posteriori : le coût par transaction est une jointure, pas une estimation."
            : "The campaign id is carried on the lead at every stage. Nothing is reconstructed after the fact — cost per closing is a join, not an estimate."}
        </p>
      </Panel>
    </div>
  );
}

function Th({
  children,
  align = "right",
  emphasis,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  emphasis?: boolean;
}) {
  return (
    <th
      className={`px-4 py-2 text-2xs font-medium uppercase tracking-[0.07em] whitespace-nowrap ${
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
    <td className="px-4 py-2.5 text-right">
      <span
        className={`font-mono text-xs tabular ${
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
