"use client";

import { Inbox, MapPin } from "lucide-react";
import { useStore } from "@/lib/store";
import { Panel, Badge, Avatar, Meter, Button } from "./ui";

/** Right-hand inspector: who is available, and what nobody picked up. */
export function Inspector() {
  const { agents, jurisdiction, phase, held, reassignHeld, t } = useStore();

  const roster = agents.filter((a) => a.jurisdictions.includes(jurisdiction.code));
  const activeAgentId =
    phase.kind === "awaiting"
      ? phase.state.agentId
      : phase.kind === "accepted"
        ? phase.agentId
        : null;

  return (
    <div className="flex flex-col gap-4 xl:h-full xl:min-h-0">
      <Panel
        title={t("roster.title")}
        meta={`${roster.length}`}
        className="xl:flex-1 xl:min-h-0 flex flex-col"
        bodyClassName="xl:flex-1 xl:min-h-0 xl:overflow-y-auto scroll-slim"
      >
        <ul className="divide-y divide-[var(--hairline)]">
          {roster.map((agent) => {
            const full = agent.activeFiles >= agent.capacity;
            const active = agent.id === activeAgentId;
            return (
              <li
                key={agent.id}
                data-tour={active ? "roster-active" : undefined}
                className={`px-5 py-3.5 transition-colors duration-150 ${
                  active ? "bg-pine-50" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={agent.initials}
                    tone={active ? "accent" : full ? "warn" : "neutral"}
                  />
                  <span className="text-small text-ink-800 font-medium truncate flex-1 min-w-0">
                    {agent.name}
                  </span>
                  <span className="font-mono text-micro text-ink-500 tabular shrink-0">
                    {agent.activeFiles}/{agent.capacity}
                  </span>
                </div>

                <div className="mt-2 pl-[38px]">
                  <Meter value={agent.activeFiles} max={agent.capacity} />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {full ? (
                      <Badge tone="danger">{t("roster.atCapacity")}</Badge>
                    ) : (
                      <Badge tone="ok">{t("roster.available")}</Badge>
                    )}
                    <span className="text-micro text-ink-400 truncate">
                      {agent.coverage.length > 0
                        ? agent.coverage.join(" · ")
                        : jurisdiction.name.en}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        dataTour="hold-queue"
        title={t("hold.title")}
        meta={held.length > 0 ? String(held.length) : undefined}
        className="shrink-0"
      >
        {held.length === 0 ? (
          <div className="px-5 pb-5 flex items-center gap-2.5 text-ink-400">
            <Inbox size={15} />
            <span className="text-small">{t("hold.empty")}</span>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--hairline)] max-h-[152px] overflow-y-auto scroll-slim">
            {held.map((entry) => (
              <li key={entry.lead.id} className="px-5 py-3.5 animate-rise">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-danger-500 shrink-0" />
                  <span className="text-small text-ink-800 truncate flex-1 min-w-0">
                    {entry.lead.sellerName}
                  </span>
                  <span className="font-mono text-micro text-ink-400 tabular">
                    {entry.lead.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-[22px]">
                  <span className="text-micro text-ink-500 flex-1 truncate">
                    {entry.reason === "unrouted"
                      ? t("hold.unrouted")
                      : t("hold.reason", { levels: entry.escalations })}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => reassignHeld(entry.lead.id)}
                    dataTour="reassign"
                  >
                    {t("hold.reassign")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
