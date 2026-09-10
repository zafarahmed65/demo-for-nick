"use client";

import { useEffect, useRef } from "react";
import { Play, RotateCcw, Check, X, ArrowRight, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/routing";
import { Panel, Button, Segmented, Badge, Avatar, Field, inputClass } from "./ui";
import type { TraceEntry } from "@/lib/types";

/* ------------------------------------------------------------------
   Countdown ring — the SLA made visible. Pine while there is time,
   amber as it tightens, red at breach.
   ------------------------------------------------------------------ */
function CountdownRing({ ratio, seconds }: { ratio: number; seconds: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const tone =
    clamped > 0.5
      ? "var(--color-pine-500)"
      : clamped > 0.25
        ? "var(--color-warn-500)"
        : "var(--color-danger-500)";

  return (
    <div data-tour="countdown" className="relative size-[64px] shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--color-ink-150)"
          strokeWidth="4"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="font-mono text-body font-medium tabular"
          style={{ color: tone }}
        >
          {seconds}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Decision log — real timestamps, monospace, tabular numerals.
   ------------------------------------------------------------------ */
const KIND_STYLE: Record<TraceEntry["kind"], { dot: string; text: string }> = {
  intake: { dot: "bg-ink-400", text: "text-ink-700" },
  resolve: { dot: "bg-pine-400", text: "text-ink-700" },
  filter: { dot: "bg-ink-300", text: "text-ink-600" },
  assign: { dot: "bg-pine-600", text: "text-pine-800 font-medium" },
  waiting: { dot: "bg-warn-500", text: "text-warn-700" },
  escalate: { dot: "bg-danger-500", text: "text-danger-700 font-medium" },
  accept: { dot: "bg-ok-500", text: "text-ok-700 font-medium" },
  hold: { dot: "bg-danger-500", text: "text-danger-700 font-medium" },
};

function stamp(at: number): string {
  const d = new Date(at);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function TraceLog() {
  const { trace, locale, t } = useStore();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [trace.length]);

  return (
    <Panel
      title={t("trace.title")}
      meta={t("trace.subtitle")}
      className="xl:flex-1 xl:min-h-0 flex flex-col"
      bodyClassName="flex-1 min-h-0 min-h-[260px] xl:min-h-0"
    >
      <div
        ref={scroller}
        className="h-full overflow-y-auto scroll-slim px-5 pb-4"
      >
        {trace.length === 0 ? (
          <p className="font-mono text-micro text-ink-400 px-1 py-1">
            — {t("sim.empty")}
          </p>
        ) : (
          <ol className="space-y-1">
            {trace.map((entry) => {
              const style = KIND_STYLE[entry.kind];
              /* Steps that arrived together fan in one after another. */
              const delay = (entry.batchIndex ?? 0) * 45;
              return (
                <li
                  key={entry.id}
                  className={`animate-trace-in flex items-start gap-3 px-2 py-1 -mx-2 rounded-sm ${
                    entry.kind === "escalate" || entry.kind === "hold"
                      ? "animate-beat"
                      : ""
                  }`}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <span className="font-mono text-micro text-ink-400 tabular pt-[2px] shrink-0">
                    {stamp(entry.at)}
                  </span>
                  <span
                    className={`mt-[7px] size-[6px] rounded-full shrink-0 ${style.dot}`}
                  />
                  <span
                    className={`font-mono text-micro leading-5 ${style.text} flex-1 min-w-0`}
                  >
                    {entry.message[locale]}
                  </span>
                  {entry.annotation && (
                    <span className="font-mono text-micro text-ink-400 tabular shrink-0 pt-[1px]">
                      {entry.annotation[locale]}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------
   Assignment card — who has it, how long they have left, what they do.
   ------------------------------------------------------------------ */
function AssignmentCard() {
  const {
    phase,
    agents,
    now,
    slaMs,
    accept,
    decline,
    jurisdiction,
    held,
    locale,
    advanceStage,
    closeLead,
    t,
  } = useStore();

  if (phase.kind === "idle") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-14 px-6">
        <p className="text-title text-ink-900">{t("sim.empty")}</p>
        <p className="text-small text-ink-500 mt-1.5 max-w-[46ch]">
          {t("sim.emptyHint")}
        </p>
      </div>
    );
  }

  const lead = phase.kind === "awaiting" ? phase.state.lead : phase.lead;
  const money = formatMoney(lead.propertyValue, jurisdiction, locale);

  if (phase.kind === "held") {
    return (
      <div className="animate-rise px-4 py-4 flex items-start gap-3">
        <div className="size-[64px] shrink-0 rounded-full border-2 border-danger-200 grid place-items-center">
          <X size={20} className="text-danger-500" />
        </div>
        <div className="min-w-0">
          <Badge tone="danger">{t("hold.title")}</Badge>
          <p className="text-title font-medium text-ink-900 mt-2">
            {lead.sellerName} · {lead.municipality}
          </p>
          <p className="text-small text-ink-500 mt-0.5 font-mono tabular">
            {lead.id} · {money}
          </p>
          <p className="text-small text-danger-700 mt-2">
            {held.find((h) => h.lead.id === lead.id)?.reason === "unrouted"
              ? t("hold.unrouted")
              : t("hold.reason", { levels: jurisdiction.escalationLevels })}
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === "accepted") {
    const agent = agents.find((a) => a.id === phase.agentId);
    const stages = jurisdiction.workflow;
    const stage = stages[phase.stageIndex];
    const closed = phase.stageIndex === stages.length - 1;
    return (
      <div className="animate-rise px-4 py-4 flex items-start gap-3">
        <div className="size-[64px] shrink-0 rounded-full border-2 border-ok-200 bg-ok-50 grid place-items-center">
          <Check size={22} className="text-ok-500" />
        </div>
        <div className="min-w-0">
          <Badge tone="ok">{t("journey.accepted")}</Badge>
          <p className="text-title font-medium text-ink-900 mt-2">
            {lead.sellerName} · {lead.municipality}
          </p>
          <p className="text-small text-ink-500 mt-0.5 font-mono tabular">
            {lead.id} · {money}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <Avatar initials={agent?.initials ?? "?"} tone="accent" />
            <span className="text-small text-ink-700">{agent?.name}</span>
            {phase.level > 0 && (
              <Badge tone="warn">
                {t("sim.level")} {phase.level}
              </Badge>
            )}
          </div>

          {/* Stages come from this jurisdiction's configured workflow, so a
              lead in Ontario walks Ontario's stages. */}
          <div className="mt-3 pt-3 border-t border-[var(--hairline)]">
            <div className="flex items-baseline gap-2">
              <span className="text-micro uppercase tracking-[0.07em] text-ink-400 font-medium">
                {t("stage.title")}
              </span>
              <span className="font-mono text-micro text-ink-400 tabular">
                {phase.stageIndex + 1}/{stages.length}
              </span>
            </div>
            <p className="text-small text-ink-800 mt-1">{stage.label[locale]}</p>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {closed ? (
                <Badge tone="ok">
                  <Check size={9} className="mr-1" />
                  {t("stage.closed")}
                </Badge>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={advanceStage}>
                    {t("stage.next")}
                    <ChevronRight size={11} />
                  </Button>
                  <Button size="sm" variant="primary" onClick={closeLead} dataTour="close-lead">
                    <Check size={11} />
                    {t("stage.close")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { deadline, agentId, level } = phase.state;
  const remainingMs = Math.max(0, deadline - now);
  const ratio = remainingMs / slaMs;
  const seconds = Math.ceil(remainingMs / 1000);
  const agent = agents.find((a) => a.id === agentId);
  const tight = ratio <= 0.25;

  return (
    <div className="animate-rise px-5 py-5 flex items-start gap-5">
      <CountdownRing ratio={ratio} seconds={seconds} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={tight ? "danger" : "warn"}>
            {remainingMs === 0 ? t("sim.breached") : t("sim.awaiting")}
          </Badge>
          {level > 0 && (
            <Badge tone="danger">
              {t("sim.level")} {level}
            </Badge>
          )}
        </div>
        <p className="text-title font-medium text-ink-900 mt-2">
          {lead.sellerName} · {lead.municipality}
        </p>
        <p className="text-small text-ink-500 mt-0.5 font-mono tabular">
          {lead.id} · {money}
        </p>

        <div className="flex items-center gap-2.5 mt-4">
          <Avatar initials={agent?.initials ?? "?"} tone="accent" />
          <div className="min-w-0">
            <p className="text-small text-ink-800 leading-tight">{agent?.name}</p>
            <p className="text-micro text-ink-500 leading-tight">
              {t("sim.assignedTo")}
            </p>
          </div>
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" variant="primary" onClick={accept} dataTour="accept">
              <Check size={12} />
              {t("sim.accept")}
            </Button>
            <Button size="sm" variant="danger" onClick={decline}>
              <X size={12} />
              {t("sim.decline")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Simulator() {
  const {
    trigger,
    reset,
    speed,
    setSpeed,
    jurisdiction,
    municipality,
    setMunicipality,
    t,
    phase,
  } = useStore();

  return (
    <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1">
      <Panel
        title={t("sim.title")}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw size={12} />
              {t("sim.reset")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => trigger()}
              disabled={phase.kind === "awaiting"}
              dataTour="trigger"
            >
              <Play size={12} />
              {t("sim.trigger")}
              <ArrowRight size={12} className="opacity-60" />
            </Button>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-[190px]">
              <Field label={t("sim.municipality")}>
                <select
                  className={inputClass}
                  value={municipality}
                  onChange={(event) => setMunicipality(event.target.value)}
                >
                  {jurisdiction.municipalities.map((town) => (
                    <option key={town} value={town}>
                      {town}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="w-[240px]">
              <Segmented
                label={t("sim.speed")}
                value={String(speed)}
                onChange={(v) => setSpeed(Number(v))}
                options={[
                  { value: "1", label: `${jurisdiction.slaSeconds}s` },
                  { value: "4", label: `${Math.round(jurisdiction.slaSeconds / 4)}s` },
                  { value: "10", label: `${Math.round(jurisdiction.slaSeconds / 10)}s` },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--hairline)]">
          <AssignmentCard />
        </div>
      </Panel>

      <TraceLog />
    </div>
  );
}
