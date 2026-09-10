# Lead Engine Sandbox

A working demonstration of the three architectural questions in the brief: how a
jurisdiction is modelled, how a lead reaches the right broker inside the SLA, and
how an ad click stays attached to a closed sale.

It is a sandbox, not a product. There is no database, no auth and no marketing
site — everything is seeded in memory and resets on reload. That is deliberate:
the point is the engine, and the engine is what the brief asks about.

---

## What to look at, in order

**0 — Or just press a scenario.** The simulator opens with three guided
scenarios: a broker who does not respond, a broker at full capacity, and opening
a new market. Each one sets the board and stops — you still pull the trigger.
They exist because pressing the plain trigger once will most likely show a
broker accepting in three seconds, which teaches you nothing about the system.

**1 — Watch a lead get routed and escalated.** Open the routing simulator, set
demo speed to `6s`, press **Nouveau lead entrant**. The decision log prints with
real wall-clock timestamps: licence → geography → capacity → language → fair
rotation, then the countdown ring runs. The first broker in Laval is the least
loaded but the slowest to respond, so the SLA usually expires and the lead
escalates to the next broker on its own. Press **Refuser** three times instead
and the lead exhausts its escalations and lands in the hold queue with an admin
alert.

**2 — Add a market without touching code.** Go to *Juridictions* →
**Ajouter une juridiction**. The form is pre-filled with Florida at 1.5%. Submit
it. The jurisdiction appears, the interface switches to English because Florida's
default locale is English, currency becomes USD, a broker roster is created, and
routing a Miami lead works immediately. Nothing was deployed.

**3 — Switch Québec to Ontario.** Commission, workflow stages, terminology
(`courtier` / `agent`, `promesse d'achat` / `agreement of purchase and sale`),
legal disclosure and default language all change together, because they are all
fields on one record.

---

## Question 2 — modelling jurisdictions so Ontario needs no code change

A jurisdiction is a row, not a branch. [`src/lib/types.ts`](src/lib/types.ts)
defines it and [`src/lib/jurisdictions.ts`](src/lib/jurisdictions.ts) holds the
data — commission rate, market rate, SLA, escalation depth, default and required
locales, terminology, legal disclosure, workflow stages with their required
documents, and the municipality list.

The rule the codebase follows: **no file outside `jurisdictions.ts` may branch on
a jurisdiction code.** Grep for `"QC"` and you will find it in seed data and
tests, never in logic. The routing engine reads `jurisdiction.slaSeconds` and
`jurisdiction.escalationLevels`; the UI reads `jurisdiction.terminology`; the
savings figure reads `jurisdiction.commissionRate`. Adding Ontario is inserting a
record, which is exactly what the runtime form in
[`jurisdiction-panel.tsx`](src/components/jurisdiction-panel.tsx) does in front of
you.

In production this table lives in Postgres — see [`schema.sql`](schema.sql) —
with the workflow stages and their document requirements as child rows so you can
rename and reorder them from the admin console.

## Question 3 — reaching the right broker in 60 seconds, and what happens if nobody answers

[`src/lib/routing.ts`](src/lib/routing.ts) is one pure function,
`routeLead(lead, jurisdiction, agents)`. It applies four filters in a fixed order
and explains each one as it goes:

1. **Licence** — legal constraint, so it runs first
2. **Geography** — municipality coverage, empty coverage means the whole market
3. **Capacity** — a broker at their cap is protected from more work
4. **Language** — the seller is served in the language they arrived in

Survivors are ranked by last-assignment time, with load ratio breaking ties, so
distribution stays fair and the least-busy eligible broker wins. The decision
itself takes well under a millisecond; the 60 seconds is entirely the human
window.

**The function deliberately does not own the clock.** It returns the ordered list
of brokers to try; the caller drives escalation. That keeps the decision logic
pure and unit-testable without faking timers, and means the same function runs
unchanged in a queue worker or an edge function.

Escalation lives in [`src/lib/store.tsx`](src/lib/store.tsx), driven by one
interval and a set of absolute deadlines. When the deadline passes the lead moves
to the next broker; when a broker declines it moves immediately; when the
escalation levels are exhausted it enters the hold queue and an admin is alerted.
Nothing schedules its own `setTimeout`, so a stale timer from a previous
assignment can never race a current one.

In production the same shape holds with durable timers instead of an interval —
the deadline is a row, a worker sweeps expired deadlines, and notifications go out
over SMS, push and email in the broker's language.

## Question 4 — ad click through to closed sale

Attribution is a foreign key carried forward, not a report assembled afterwards.
The click identifier (`gclid` / UTM set) is captured at landing, stored on the
lead, and stays attached through routing, stage advancement and closing. Cost per
closing is then a join, not an estimate.

The *Attribution* view shows it over seed data. The insight it happens to
surface is the point of building it: the Meta campaign costs roughly six times
per closing what the referral programme does, despite a healthy-looking cost per
lead — which is invisible if you only measure to the lead.

[`schema.sql`](schema.sql) shows the durable version, with an
`attribution_touches` table so multi-touch attribution stays possible later
without a migration.

---

## What this is not

No authentication, no marketing site, no mobile app, no real notification
delivery, and no server-side database. Broker responsiveness is simulated so the
escalation path can be demonstrated on demand.

State persists in `localStorage`, so a market you add survives a reload —
**Réinitialiser** puts it back to seed. That is per-browser, not a backend.

## Running it

```bash
npm install
npm run dev
```

No environment variables, no services to configure.

## Tests

```bash
npm test
```

27 tests across two suites, with no mocking of the engine itself — `routeLead`
is pure, so it can be pinned down directly.

[`routing.test.ts`](src/lib/routing.test.ts) covers the four eligibility
filters, round-robin ranking, load-ratio tie-breaking and the empty-roster path.
Three cases are regression guards for bugs found while building this: French
agreement in the trace (`1 couvre` vs `4 couvrent`), French leaking into the
English trace, and the assumption that a jurisdiction is hard-coded — that last
one routes a jurisdiction invented at runtime, which turns the claim in
*Question 2* above into an executable assertion.

[`persistence.test.ts`](src/lib/persistence.test.ts) covers the defensive paths:
blocked storage, exceeded quota, malformed JSON, a stale schema version, and
server-side rendering where there is no `window`.

The suites were checked by mutation — removing the capacity filter, forcing
French plurals, leaking a French annotation into English, dropping the
round-robin sort, or removing stored-state validation each fail the tests.

## Stack

Next.js 16 (App Router), TypeScript in strict mode, Tailwind 4, Lucide icons.
No component library, no state library, no database.

Design tokens — palette, type scale, spacing, radii and motion — are defined once
in [`src/app/globals.css`](src/app/globals.css); every component inherits them.
Every user-visible string lives in [`src/locales`](src/locales), with French
rendered by default rather than behind a toggle.
