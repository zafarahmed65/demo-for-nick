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
    <div className="flex flex-col gap-3 h-full min-h-0">
      <Panel
        title={t("roster.title")}
        meta={`${roster.length}`}
        className="flex-1 min-h-0 flex flex-col"
        bodyClassName="flex-1 min-h-0 overflow-y-auto scroll-slim"
      >
        <ul className="divide-y divide-[var(--hairline)]">
          {roster.map((agent) => {
            const full = agent.activeFiles >= agent.capacity;
            const active = agent.id === activeAgentId;
            return (
              <li
                key={agent.id}
                className={`px-3 py-2.5 transition-colors duration-150 ${
                  active ? "bg-pine-50" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    initials={agent.initials}
                    tone={active ? "accent" : full ? "warn" : "neutral"}
                  />
                  <span className="text-xs text-ink-800 font-medium truncate flex-1 min-w-0">
                    {agent.name}
                  </span>
                  <span className="font-mono text-2xs text-ink-500 tabular shrink-0">
                    {agent.activeFiles}/{agent.capacity}
                  </span>
                </div>

                <div className="mt-1.5 pl-8">
                  <Meter value={agent.activeFiles} max={agent.capacity} />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {full ? (
                      <Badge tone="danger">{t("roster.atCapacity")}</Badge>
                    ) : (
                      <Badge tone="ok">{t("roster.available")}</Badge>
                    )}
                    <span className="text-2xs text-ink-400 truncate">
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
        title={t("hold.title")}
        meta={held.length > 0 ? String(held.length) : undefined}
        className="shrink-0"
      >
        {held.length === 0 ? (
          <div className="px-3 py-4 flex items-center gap-2 text-ink-400">
            <Inbox size={14} />
            <span className="text-2xs">{t("hold.empty")}</span>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--hairline)] max-h-[152px] overflow-y-auto scroll-slim">
            {held.map((entry) => (
              <li key={entry.lead.id} className="px-3 py-2.5 animate-rise">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-danger-500 shrink-0" />
                  <span className="text-xs text-ink-800 truncate flex-1 min-w-0">
                    {entry.lead.sellerName}
                  </span>
                  <span className="font-mono text-2xs text-ink-400 tabular">
                    {entry.lead.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 pl-5">
                  <span className="text-2xs text-ink-500 flex-1 truncate">
                    {entry.reason === "unrouted"
                      ? t("hold.unrouted")
                      : t("hold.reason", { levels: entry.escalations })}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => reassignHeld(entry.lead.id)}
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
