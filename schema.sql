-- Lead Engine — durable data model
--
-- The sandbox in this repository runs entirely in memory; this file is the
-- production shape of the same model. It is included so the data design can be
-- reviewed independently of the demo.
--
-- The organising idea is that a jurisdiction is a row and everything that varies
-- by market hangs off it. Adding Ontario, or Florida, inserts rows. No enum is
-- widened, no code path is branched, no migration is required to open a market.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Jurisdictions
-- ---------------------------------------------------------------------------

create table jurisdictions (
  id                      uuid primary key default gen_random_uuid(),
  code                    text        not null unique,          -- 'QC', 'ON', 'FL'
  country                 text        not null,
  currency_code           text        not null,
  commission_rate         numeric(5,4) not null,                -- 0.0200 = 2%
  market_commission_rate  numeric(5,4) not null,
  sla_seconds             integer     not null default 60,
  escalation_levels       smallint    not null default 2,
  default_locale          text        not null,                 -- FR in Quebec
  is_active               boolean     not null default true,
  created_at              timestamptz not null default now(),
  constraint commission_below_market
    check (commission_rate < market_commission_rate)
);

-- Locales a jurisdiction is legally obliged to publish. Quebec requires FR.
create table jurisdiction_locales (
  jurisdiction_id uuid not null references jurisdictions on delete cascade,
  locale          text not null,
  is_required     boolean not null default true,
  primary key (jurisdiction_id, locale)
);

-- Every user-visible string is a row, never a hard-coded literal. This is what
-- makes adding Spanish a data task rather than a refactor.
create table translations (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid references jurisdictions on delete cascade,  -- null = global
  namespace       text not null,        -- 'terminology', 'disclosure', 'ui'
  key             text not null,
  locale          text not null,
  value           text not null,
  unique (jurisdiction_id, namespace, key, locale)
);

create table municipalities (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references jurisdictions on delete cascade,
  name            text not null,
  slug            text not null,        -- drives the landing-page route
  unique (jurisdiction_id, slug)
);

-- ---------------------------------------------------------------------------
-- Workflow — renameable and reorderable from the admin console
-- ---------------------------------------------------------------------------

create table workflow_stages (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references jurisdictions on delete cascade,
  key             text not null,
  position        integer not null,
  is_terminal     boolean not null default false,
  unique (jurisdiction_id, key),
  unique (jurisdiction_id, position) deferrable initially deferred
);

-- Field and document requirements are rows, so the admin can add a requirement
-- to a stage without a deploy.
create table stage_requirements (
  id                uuid primary key default gen_random_uuid(),
  stage_id          uuid not null references workflow_stages on delete cascade,
  requirement_type  text not null check (requirement_type in ('field', 'document')),
  key               text not null,
  is_mandatory      boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Brokers
-- ---------------------------------------------------------------------------

create table agents (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  email             text not null unique,
  phone             text,
  capacity          integer not null default 10,
  active_file_count integer not null default 0,
  -- Round-robin fairness is read straight off this column.
  last_assigned_at  timestamptz,
  is_accepting      boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint capacity_positive check (capacity > 0)
);

create table agent_licences (
  agent_id        uuid not null references agents on delete cascade,
  jurisdiction_id uuid not null references jurisdictions on delete cascade,
  licence_number  text,
  expires_on      date,
  primary key (agent_id, jurisdiction_id)
);

create table agent_locales (
  agent_id uuid not null references agents on delete cascade,
  locale   text not null,
  primary key (agent_id, locale)
);

-- No rows for an agent means they serve their whole jurisdiction.
create table agent_coverage (
  agent_id        uuid not null references agents on delete cascade,
  municipality_id uuid not null references municipalities on delete cascade,
  primary key (agent_id, municipality_id)
);

-- ---------------------------------------------------------------------------
-- Attribution sources
--
-- Declared before leads, because a lead carries its originating campaign from
-- the moment it is created.
-- ---------------------------------------------------------------------------

create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  channel    text not null,
  external_id text,                                -- id in Google Ads / Meta
  created_at timestamptz not null default now()
);

create table campaign_spend (
  campaign_id uuid not null references campaigns on delete cascade,
  spend_date  date not null,
  amount      numeric(12,2) not null,
  clicks      integer not null default 0,
  primary key (campaign_id, spend_date)
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table leads (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,          -- 'LD-4821'
  jurisdiction_id  uuid not null references jurisdictions,
  municipality_id  uuid references municipalities,
  stage_id         uuid references workflow_stages,
  assigned_agent_id uuid references agents,
  seller_name      text not null,
  seller_email     text,
  seller_phone     text,
  locale           text not null,                 -- language the seller arrived in
  property_value   numeric(12,2),
  status           text not null default 'routing'
                     check (status in ('routing','awaiting','accepted','held','closed','lost')),
  -- Attribution is attached at creation and never recomputed.
  campaign_id      uuid references campaigns,
  click_id         text,                          -- gclid / fbclid
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);

create index leads_routing_idx on leads (jurisdiction_id, status);
create index leads_agent_idx   on leads (assigned_agent_id) where status = 'awaiting';

-- One row per assignment attempt. The SLA is a column, not a timer held in a
-- process, so escalation survives a restart: a worker sweeps expired deadlines.
create table lead_assignments (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references leads on delete cascade,
  agent_id         uuid not null references agents,
  escalation_level smallint not null default 0,
  assigned_at      timestamptz not null default now(),
  respond_by       timestamptz not null,
  responded_at     timestamptz,
  outcome          text check (outcome in ('accepted','declined','expired')),
  unique (lead_id, escalation_level)
);

-- Drives the escalation sweep. Partial index keeps it small.
create index assignments_due_idx
  on lead_assignments (respond_by)
  where responded_at is null;

-- The decision trace, persisted. This is the audit trail the brief asks for.
create table routing_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads on delete cascade,
  kind       text not null,      -- 'filter' | 'assign' | 'escalate' | 'accept' | 'hold'
  detail     jsonb not null,
  agent_id   uuid references agents,
  created_at timestamptz not null default now()
);

create index routing_events_lead_idx on routing_events (lead_id, created_at);

create table documents (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads on delete cascade,
  requirement_id uuid references stage_requirements,
  storage_path   text not null,
  uploaded_by    uuid,
  uploaded_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Attribution touches
-- ---------------------------------------------------------------------------

-- Kept separate from leads.campaign_id so multi-touch attribution is possible
-- later without a migration: leads.campaign_id stays the first touch.
create table attribution_touches (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references leads on delete cascade,
  campaign_id  uuid references campaigns,
  touch_type   text not null,      -- 'click' | 'form' | 'call' | 'referral'
  click_id     text,
  landing_path text,
  occurred_at  timestamptz not null default now()
);

-- Cost per closing, calculated rather than estimated, because the campaign is
-- still attached to the lead at the moment it closes.
create view campaign_performance as
select
  c.id,
  c.name,
  c.channel,
  coalesce(sum(s.amount), 0)                             as spend,
  coalesce(sum(s.clicks), 0)                             as clicks,
  count(distinct l.id)                                   as leads,
  count(distinct l.id) filter (where l.status = 'closed') as closings,
  coalesce(sum(s.amount), 0)
    / nullif(count(distinct l.id), 0)                    as cost_per_lead,
  coalesce(sum(s.amount), 0)
    / nullif(count(distinct l.id)
        filter (where l.status = 'closed'), 0)           as cost_per_closing
from campaigns c
left join campaign_spend s on s.campaign_id = c.id
left join leads l          on l.campaign_id = c.id
group by c.id, c.name, c.channel;
