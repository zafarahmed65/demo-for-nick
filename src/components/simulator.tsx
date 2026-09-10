"use client";

import { useEffect, useRef } from "react";
import {
  Play,
  RotateCcw,
  Check,
  X,
  ArrowRight,
  TimerOff,
  UserX,
  Globe2,
} from "lucide-react";
import { SCENARIO_KEYS, type ScenarioKey } from "@/lib/scenarios";
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
    <div className="relative size-[64px] shrink-0">
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
          className="font-mono text-md font-medium tabular"
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
      className="flex-1 min-h-0 flex flex-col"
      bodyClassName="flex-1 min-h-0"
    >
      <div
        ref={scroller}
        className="h-full overflow-y-auto scroll-slim px-3 py-2.5"
      >
        {trace.length === 0 ? (
          <p className="font-mono text-2xs text-ink-400 px-1 py-1">
            — {t("sim.empty")}
          </p>
        ) : (
          <ol className="space-y-[3px]">
            {trace.map((entry) => {
              const style = KIND_STYLE[entry.kind];
              /* Steps that arrived together fan in one after another. */
              const delay = (entry.batchIndex ?? 0) * 45;
              return (
                <li
                  key={entry.id}
                  className={`animate-trace-in flex items-start gap-2.5 px-1 py-[3px] rounded-xs ${
                    entry.kind === "escalate" || entry.kind === "hold"
                      ? "animate-beat"
                      : ""
                  }`}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <span className="font-mono text-2xs text-ink-400 tabular pt-[1px] shrink-0">
                    {stamp(entry.at)}
                  </span>
                  <span
                    className={`mt-[6px] size-[5px] rounded-full shrink-0 ${style.dot}`}
                  />
                  <span
                    className={`font-mono text-2xs leading-[18px] ${style.text} flex-1 min-w-0`}
                  >
                    {entry.message[locale]}
                  </span>
                  {entry.annotation && (
                    <span className="font-mono text-2xs text-ink-400 tabular shrink-0 pt-[1px]">
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
    t,
  } = useStore();

  if (phase.kind === "idle") {
    return <ScenarioBoard />;
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
          <p className="text-md font-medium text-ink-900 mt-1.5">
            {lead.sellerName} · {lead.municipality}
          </p>
          <p className="text-xs text-ink-500 mt-0.5 font-mono tabular">
            {lead.id} · {money}
          </p>
          <p className="text-xs text-danger-700 mt-2">
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
    return (
      <div className="animate-rise px-4 py-4 flex items-start gap-3">
        <div className="size-[64px] shrink-0 rounded-full border-2 border-ok-200 bg-ok-50 grid place-items-center">
          <Check size={22} className="text-ok-500" />
        </div>
        <div className="min-w-0">
          <Badge tone="ok">{t("journey.accepted")}</Badge>
          <p className="text-md font-medium text-ink-900 mt-1.5">
            {lead.sellerName} · {lead.municipality}
          </p>
          <p className="text-xs text-ink-500 mt-0.5 font-mono tabular">
            {lead.id} · {money}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <Avatar initials={agent?.initials ?? "?"} tone="accent" />
            <span className="text-xs text-ink-700">{agent?.name}</span>
            {phase.level > 0 && (
              <Badge tone="warn">
                {t("sim.level")} {phase.level}
              </Badge>
            )}
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
    <div className="animate-rise px-4 py-4 flex items-start gap-3.5">
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
        <p className="text-md font-medium text-ink-900 mt-1.5">
          {lead.sellerName} · {lead.municipality}
        </p>
        <p className="text-xs text-ink-500 mt-0.5 font-mono tabular">
          {lead.id} · {money}
        </p>

        <div className="flex items-center gap-2 mt-2.5">
          <Avatar initials={agent?.initials ?? "?"} tone="accent" />
          <div className="min-w-0">
            <p className="text-xs text-ink-800 leading-tight">{agent?.name}</p>
            <p className="text-2xs text-ink-500 leading-tight">
              {t("sim.assignedTo")}
            </p>
          </div>
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" variant="primary" onClick={accept}>
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

const SCENARIO_ICON: Record<ScenarioKey, typeof TimerOff> = {
  "no-response": TimerOff,
  "at-capacity": UserX,
  "new-market": Globe2,
};

/**
 * Shown whenever nothing is in flight. A cold visitor who presses the plain
 * trigger once will most likely see a broker accept in three seconds and learn
 * nothing; these put the interesting behaviour one click away instead.
 */
function ScenarioBoard() {
  const { runScenario, t } = useStore();
  return (
    <div className="px-4 py-4">
      <div className="flex items-baseline gap-2.5 mb-0.5">
        <h3 className="text-xs font-medium text-ink-800">{t("scenario.title")}</h3>
        <span className="text-2xs text-ink-400">{t("scenario.intro")}</span>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        {SCENARIO_KEYS.map((key) => {
          const Icon = SCENARIO_ICON[key];
          return (
            <li key={key}>
              <button
                onClick={() => runScenario(key)}
                className="group h-full w-full text-left p-3 rounded-md border border-[var(--hairline)] bg-ink-50 hover:bg-white hover:border-pine-300 transition-colors duration-150"
              >
                <span className="flex items-center gap-2">
                  <Icon size={13} className="text-ink-400 group-hover:text-pine-600 transition-colors duration-150" />
                  <span className="text-xs font-medium text-ink-900">
                    {t(`scenario.${key}.label`)}
                  </span>
                </span>
                <span className="block text-2xs text-ink-500 mt-1.5 leading-relaxed">
                  {t(`scenario.${key}.blurb`)}
                </span>
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-pine-700 mt-2">
                  {t("scenario.run")}
                  <ArrowRight size={10} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
    <div className="flex flex-col gap-3 min-h-0 flex-1">
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
            >
              <Play size={12} />
              {t("sim.trigger")}
              <ArrowRight size={12} className="opacity-60" />
            </Button>
          </div>
        }
      >
        <p className="px-4 pt-3 text-xs text-ink-600 leading-relaxed max-w-[76ch]">
          {t("sim.lede")}
        </p>

        <div className="px-4 pt-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="w-[180px]">
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
            <p className="text-2xs text-ink-400 pb-1.5 flex-1 min-w-[180px]">
              {t("sim.speedHint", { sla: jurisdiction.slaSeconds })}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-[var(--hairline)]">
          <AssignmentCard />
        </div>
      </Panel>

      <TraceLog />
    </div>
  );
}
