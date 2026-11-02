-- Pharma CRM for Claude Code: a pharmaceutical or medtech field force in plain tables.
-- Territories, reps, products, practices and hospitals, healthcare professionals, calls and the
-- products detailed on them, starter pack requests and deliveries, sample lots and rep stock,
-- events and who came, transfers of value and the half-yearly transparency reports, and an
-- append-only activity log. The rules each view applies, with their sources, are in docs/compliance.md.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table settings (
  key text primary key,
  value text not null,
  note text
);

create or replace function setting_num(k text, dflt numeric) returns numeric language sql stable as $$
  select coalesce((select value::numeric from settings where key = k), dflt)
$$;

create table territories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name text not null,
  country text not null check (country in ('NZ', 'AU')),
  state text check (state is null or state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country = 'AU' or state is null)
);

create table reps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text,
  territory_id uuid references territories(id),
  -- New Zealand: the hawker's licence a rep carrying samples holds, or "company licence" when the
  -- rep is nominated on the company's licence (Medicines NZ Code Ed. 17 s 4.18.5).
  sample_licence text,
  licence_expires date,
  status text not null default 'active' check (status in ('active', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  strength text,
  form text,
  kind text not null default 'prescription' check (kind in ('prescription', 'otc', 'device')),
  -- Registered for supply (ARTG in Australia, Medsafe consent in New Zealand). Unregistered
  -- products can be discussed with care but never sampled.
  registered boolean not null default true,
  starter_packs boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Practices, hospitals, pharmacies and clinics: where healthcare professionals work.
create table accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'practice' check (kind in ('practice', 'hospital', 'pharmacy', 'clinic', 'other')),
  territory_id uuid references territories(id),
  address text,
  city text,
  state text,
  postcode text,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table hcps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  profession text not null check (profession in ('gp', 'specialist', 'nurse-practitioner', 'pharmacist', 'nurse', 'other')),
  specialty text,
  -- Can prescribe the products this company samples. Samples go to prescribers only.
  prescriber boolean not null default true,
  registration_number text,
  account_id uuid references accounts(id),
  territory_id uuid not null references territories(id),
  segment text not null default 'B' check (segment in ('A', 'B', 'C')),
  target_calls int not null default 1 check (target_calls between 0 and 20),
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'moved', 'retired')),
  contact_ok boolean not null default true,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  hcp_id uuid not null references hcps(id),
  rep_id uuid not null references reps(id),
  call_on date not null,
  channel text not null default 'face-to-face' check (channel in ('face-to-face', 'remote', 'phone', 'group')),
  notes text,
  next_step text,
  follow_up_on date,
  follow_up_done_on date,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table call_products (
  call_id uuid not null references calls(id),
  product_id uuid not null references products(id),
  primary key (call_id, product_id)
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  lot_number text not null,
  expires_on date not null,
  recalled_on date,
  recall_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, lot_number)
);

create table samples (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  hcp_id uuid not null references hcps(id),
  rep_id uuid not null references reps(id),
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  -- written: a written request from the prescriber; none: given without one (imported history).
  request_kind text not null default 'written' check (request_kind in ('written', 'none')),
  requested_on date,
  -- The name and address of the person supplied, as written on the request.
  request_address text,
  status text not null default 'requested' check (status in ('requested', 'delivered', 'cancelled')),
  delivered_on date,
  lot_id uuid references lots(id),
  receipt_signed_on date,
  recall_told_on date,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'delivered' or (delivered_on is not null and lot_id is not null))
);

-- Every movement of sample stock through a rep's hands. Positive in, negative out.
create table stock_moves (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  rep_id uuid not null references reps(id),
  lot_id uuid not null references lots(id),
  qty int not null check (qty <> 0),
  kind text not null check (kind in ('received', 'issued', 'returned', 'destroyed', 'adjusted')),
  moved_on date not null default current_date,
  sample_id uuid references samples(id),
  note text,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  title text not null,
  kind text not null check (kind in ('company-meeting', 'dinner-meeting', 'workshop', 'advisory-board', 'third-party-sponsorship')),
  country text not null check (country in ('NZ', 'AU')),
  territory_id uuid references territories(id),
  held_on date not null,
  venue text,
  education text,
  hours numeric(4,1),
  -- Food and drink per head, excluding gratuities and GST.
  meal_cents int check (meal_cents is null or meal_cents >= 0),
  takeaway boolean not null default false,
  entertainment boolean not null default false,
  status text not null default 'planned' check (status in ('planned', 'held', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  hcp_id uuid not null references hcps(id),
  role text not null default 'delegate' check (role in ('delegate', 'speaker', 'chair', 'advisor')),
  attended boolean,
  created_at timestamptz not null default now(),
  unique (event_id, hcp_id)
);

-- Reported each half-year to Disclosure Australia (Medicines Australia Code Ed. 20 s 14.4).
create table transparency_reports (
  id uuid primary key default gen_random_uuid(),
  period_from date not null unique check (extract(day from period_from) = 1 and extract(month from period_from) in (1, 7)),
  submitted_on date,
  declaration_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payments and transfers of value to a healthcare professional (s 14.1.2).
create table transfers (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  hcp_id uuid not null references hcps(id),
  event_id uuid references events(id),
  kind text not null check (kind in ('speaker-fee', 'consultancy', 'advisory-board', 'sponsorship', 'registration', 'travel', 'accommodation', 'market-research')),
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  currency text not null check (currency in ('NZD', 'AUD')),
  paid_on date not null,
  paid_to text not null default 'hcp' check (paid_to in ('hcp', 'third-party')),
  prescription_related boolean not null default true,
  identity_known boolean not null default true,
  notice_given_on date,
  review_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  ref text,
  detail text
);

create or replace function activity_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'The activity log is append-only';
end $$;
create trigger activity_no_update before update or delete on activity for each row execute function activity_append_only();

-- Call, sample, stock and payment records are kept (delivery records at least two years:
-- Medicines Australia Code Ed. 20 s 6.1.6). Cancel or reverse instead.
create or replace function records_kept() returns trigger language plpgsql as $$
begin
  raise exception 'Call, sample, stock and payment records are kept, not deleted. Cancel or reverse instead.';
end $$;
create trigger calls_kept before delete on calls for each row execute function records_kept();
create trigger samples_kept before delete on samples for each row execute function records_kept();
create trigger stock_kept before update or delete on stock_moves for each row execute function records_kept();
create trigger transfers_kept before delete on transfers for each row execute function records_kept();
create trigger attendees_kept before delete on attendees for each row execute function records_kept();

create trigger territories_touch before update on territories for each row execute function touch_updated_at();
create trigger reps_touch before update on reps for each row execute function touch_updated_at();
create trigger products_touch before update on products for each row execute function touch_updated_at();
create trigger accounts_touch before update on accounts for each row execute function touch_updated_at();
create trigger hcps_touch before update on hcps for each row execute function touch_updated_at();
create trigger calls_touch before update on calls for each row execute function touch_updated_at();
create trigger lots_touch before update on lots for each row execute function touch_updated_at();
create trigger samples_touch before update on samples for each row execute function touch_updated_at();
create trigger events_touch before update on events for each row execute function touch_updated_at();
create trigger reports_touch before update on transparency_reports for each row execute function touch_updated_at();
create trigger transfers_touch before update on transfers for each row execute function touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['settings', 'territories', 'reps', 'products', 'accounts', 'hcps', 'calls', 'call_products', 'lots', 'samples',
    'stock_moves', 'events', 'attendees', 'transparency_reports', 'transfers', 'activity'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;

create index calls_hcp on calls (hcp_id, call_on);
create index samples_hcp on samples (hcp_id);
create index moves_rep on stock_moves (rep_id, lot_id);
create index transfers_hcp on transfers (hcp_id, paid_on);

-- The half-year a payment falls in, and when its report is due to Disclosure Australia:
-- 1 January to 30 June by 31 October; 1 July to 31 December by 30 April (s 14.4).
create or replace function tov_period_from(d date) returns date language sql immutable as $$
  select make_date(extract(year from d)::int, case when extract(month from d) <= 6 then 1 else 7 end, 1)
$$;
create or replace function tov_due_on(p date) returns date language sql immutable as $$
  select case when extract(month from p) = 1 then make_date(extract(year from p)::int, 10, 31)
    else make_date(extract(year from p)::int + 1, 4, 30) end
$$;

-- Every healthcare professional with where they work, who covers them, and this cycle's calls.
create view v_hcps as
select h.id, h.code, h.name, h.profession, h.specialty, h.prescriber, h.registration_number, h.segment, h.target_calls, h.email, h.phone,
  h.status, h.contact_ok, h.external_id, h.account_id, h.territory_id,
  a.code as account_code, a.name as account,
  nullif(concat_ws(', ', a.address, a.city, a.state, a.postcode), '') as practice_address,
  t.code as territory, t.country, t.state, r.code as rep_code, r.name as rep,
  (select count(*) from calls c where c.hcp_id = h.id and c.call_on > current_date - setting_num('cycle_days', 56)::int)::int as cycle_calls,
  (select max(c.call_on) from calls c where c.hcp_id = h.id) as last_call_on
from hcps h
join territories t on t.id = h.territory_id
left join accounts a on a.id = h.account_id
left join lateral (select * from reps x where x.territory_id = h.territory_id and x.status = 'active' order by x.code limit 1) r on true;

-- Sample stock each rep holds, by lot.
create view v_rep_stock as
select r.id as rep_id, r.code as rep_code, r.name as rep, l.id as lot_id, p.code as product, p.name || coalesce(' ' || p.strength, '') as product_name,
  l.lot_number, l.expires_on, l.recalled_on, sum(m.qty)::int as on_hand,
  case when l.recalled_on is not null then 'recalled' when l.expires_on < current_date then 'expired'
    when l.expires_on <= current_date + setting_num('short_dated_days', 90)::int then 'short-dated' else 'good' end as standing
from stock_moves m join reps r on r.id = m.rep_id join lots l on l.id = m.lot_id join products p on p.id = l.product_id
group by r.id, r.code, r.name, l.id, p.code, p.name, p.strength, l.lot_number, l.expires_on, l.recalled_on
having sum(m.qty) <> 0;

create view v_samples as
select s.id, s.ref, h.code as hcp_code, h.name as hcp, h.profession, h.prescriber, t.code as territory, t.country,
  r.code as rep_code, r.name as rep, r.sample_licence, r.licence_expires,
  p.code as product, p.name || coalesce(' ' || p.strength, '') as product_name, p.registered,
  s.quantity, s.request_kind, s.requested_on, s.request_address, s.status, s.delivered_on,
  l.lot_number, l.expires_on as lot_expires, l.recalled_on, s.receipt_signed_on, s.recall_told_on, s.hcp_id, s.rep_id, s.lot_id
from samples s join hcps h on h.id = s.hcp_id join territories t on t.id = h.territory_id
join reps r on r.id = s.rep_id join products p on p.id = s.product_id left join lots l on l.id = s.lot_id;

-- Reportable transfers: Australian healthcare professionals, prescription medicines, and market
-- research only where the professional's identity is known (s 14.1.2).
create view v_reportable as
select x.*, h.code as hcp_code, h.name as hcp, h.profession, v.practice_address, e.ref as event_ref, e.title as event,
  tov_period_from(x.paid_on) as period_from, tov_due_on(tov_period_from(x.paid_on)) as due_on
from transfers x join v_hcps v on v.id = x.hcp_id join hcps h on h.id = x.hcp_id left join events e on e.id = x.event_id
where v.country = 'AU' and x.prescription_related and (x.kind <> 'market-research' or x.identity_known);

-- Each half-year with reportable transfers, and where its report stands.
create view v_transparency as
select p.period_from, (p.period_from + interval '6 months' - interval '1 day')::date as period_to, tov_due_on(p.period_from) as due_on,
  p.transfers, p.amount_cents, p.reviews_sent, r.submitted_on, r.declaration_on,
  case
    when r.declaration_on is not null then 'declared'
    when r.submitted_on is not null then 'submitted'
    when current_date <= (p.period_from + interval '6 months' - interval '1 day')::date then 'period open'
    when current_date > tov_due_on(p.period_from) then 'overdue'
    else 'due'
  end as standing
from (select period_from, count(*)::int as transfers, sum(amount_cents)::int as amount_cents,
        count(*) filter (where review_sent_on is not null)::int as reviews_sent
      from v_reportable group by period_from) p
left join transparency_reports r on r.period_from = p.period_from;

-- Every rule breach or rule clock in the records, with its source. /compliance and /attention read this.
-- severity: breach (it happened against the rule), due (act now to stay inside it).
create view v_issues as
-- Australia: a written request before supply (s 6.1.5).
select 'breach' as severity, 'starter pack supplied without a written request first' as rule, 'Medicines Australia Code Ed. 20 s 6.1.5' as source,
  s.country, s.ref, s.hcp as who, s.product_name || ' x' || s.quantity || ' delivered ' || s.delivered_on ||
    case when s.requested_on is null then ', no request on file' else ', request dated ' || s.requested_on end as detail
from v_samples s where s.country = 'AU' and s.status = 'delivered' and (s.request_kind = 'none' or s.requested_on is null or s.requested_on > s.delivered_on)
union all
select 'breach', 'starter pack request without the name and address of the person supplied', 'Medicines Australia Code Ed. 20 s 6.1.5',
  s.country, s.ref, s.hcp, s.product_name || ' x' || s.quantity || ': the request has no address'
from v_samples s where s.country = 'AU' and s.status = 'delivered' and s.request_kind = 'written' and s.requested_on <= s.delivered_on and coalesce(s.request_address, '') = ''
union all
-- New Zealand: prescribers only, licensed reps, signed receipts (s 4.18).
select 'breach', 'sample given to a health professional without prescribing rights', 'Medicines NZ Code of Practice Ed. 17 s 4.18.1',
  s.country, s.ref, s.hcp, s.profession || ', ' || s.product_name || ' x' || s.quantity || ' on ' || s.delivered_on
from v_samples s where s.country = 'NZ' and s.status = 'delivered' and not s.prescriber
union all
select 'breach', 'sample issued by a rep without a current licence', 'Medicines NZ Code of Practice Ed. 17 s 4.18.5',
  s.country, s.ref, s.rep, coalesce('licence ' || s.sample_licence || ' expired ' || s.licence_expires, 'no licence on file') || ', issued ' || s.delivered_on
from v_samples s where s.country = 'NZ' and s.status = 'delivered' and (s.sample_licence is null or (s.licence_expires is not null and s.licence_expires < s.delivered_on))
union all
select 'breach', 'sample given without a signed receipt', 'Medicines NZ Code of Practice Ed. 17 s 4.18.6',
  s.country, s.ref, s.hcp, s.product_name || ' x' || s.quantity || ' delivered ' || s.delivered_on || ' by ' || s.rep
from v_samples s where s.country = 'NZ' and s.status = 'delivered' and s.receipt_signed_on is null
union all
select 'breach', 'sample of a product not registered for supply',
  case when s.country = 'NZ' then 'Medicines NZ Code of Practice Ed. 17 s 4.18.3' else 'Medicines Australia Code Ed. 20 s 6 (registered medicines only)' end,
  s.country, s.ref, s.hcp, s.product_name || ' delivered ' || s.delivered_on
from v_samples s where s.status = 'delivered' and not s.registered
union all
select 'breach', 'sample supplied from an expired lot',
  case when s.country = 'NZ' then 'Medicines NZ Code of Practice Ed. 17 s 4.18.3' else 'Medicines Australia Code Ed. 20 s 6.1.3' end,
  s.country, s.ref, s.hcp, 'lot ' || s.lot_number || ' expired ' || s.lot_expires || ', delivered ' || s.delivered_on
from v_samples s where s.status = 'delivered' and s.lot_expires < s.delivered_on
union all
-- Recalls: the stock and every professional who received the lot (NZ s 4.18.7).
select 'due', 'recalled lot still in a rep''s stock', 'Medicines NZ Code of Practice Ed. 17 s 4.18.7; your recall procedure',
  t.country, k.lot_number, k.rep, k.product_name || ' x' || k.on_hand || ' recalled ' || k.recalled_on
from v_rep_stock k join reps r on r.id = k.rep_id left join territories t on t.id = r.territory_id where k.recalled_on is not null and k.on_hand > 0
union all
select 'due', 'professional given a recalled lot not yet told', 'Medicines NZ Code of Practice Ed. 17 s 4.18.7; your recall procedure',
  s.country, s.ref, s.hcp, 'lot ' || s.lot_number || ' (' || s.product_name || ') recalled ' || s.recalled_on || ', delivered ' || s.delivered_on
from v_samples s where s.status = 'delivered' and s.recalled_on is not null and s.recall_told_on is null
union all
select 'due', 'expired sample stock still with a rep', 'Medicines Australia Code Ed. 20 s 6.1.3; Medicines NZ Code Ed. 17 s 4.18.7',
  t.country, k.lot_number, k.rep, k.product_name || ' x' || k.on_hand || ' expired ' || k.expires_on
from v_rep_stock k join reps r on r.id = k.rep_id left join territories t on t.id = r.territory_id where k.recalled_on is null and k.expires_on < current_date and k.on_hand > 0
union all
-- Hospitality.
select 'breach', 'hospitality over the cap', 'Medicines Australia Code Ed. 20 s 4.5.3; Code Tool Kit, Hospitality and Venues',
  e.country, e.ref, e.title, 'food and drink ' || to_char(e.meal_cents / 100.0, 'FM999990.00') || ' a head against the cap of ' || to_char(setting_num('hospitality_cap_cents_au', 14000) / 100.0, 'FM999990.00') || ' (AUD, excluding gratuities and GST)'
from events e where e.country = 'AU' and e.status <> 'cancelled' and e.meal_cents > setting_num('hospitality_cap_cents_au', 14000)
union all
select 'breach', 'takeaway meal at a company meeting', 'Medicines NZ Code of Practice Ed. 17 s 4.8.2.2', e.country, e.ref, e.title, 'held ' || e.held_on
from events e where e.country = 'NZ' and e.status <> 'cancelled' and e.takeaway
union all
select 'breach', 'entertainment at an event',
  case when e.country = 'AU' then 'Medicines Australia Code Ed. 20 s 4.5.5' else 'Medicines NZ Code of Practice Ed. 17 s 4.8.3.1' end,
  e.country, e.ref, e.title, 'held ' || e.held_on
from events e where e.status <> 'cancelled' and e.entertainment
union all
-- Transfers of value (Australia).
select 'breach', 'transfer of value made before the professional was given notice of disclosure', 'Medicines Australia Code Ed. 20 s 14.1.6',
  'AU', x.ref, x.hcp, x.kind || ' ' || x.currency || ' ' || to_char(x.amount_cents / 100.0, 'FM999990.00') || ' paid ' || x.paid_on || coalesce(', notice ' || x.notice_given_on, ', no notice on file')
from v_reportable x where x.notice_given_on is null or x.notice_given_on > x.paid_on
union all
select case when current_date > x.due_on - 42 then 'breach' else 'due' end,
  case when current_date > x.due_on - 42 then 'professional has less than six weeks to review before the report is due' else 'send the professional their data to review' end,
  'Medicines Australia Code Ed. 20 s 14.1.5', 'AU', x.ref, x.hcp, 'send by ' || (x.due_on - 42) || ' for the report due ' || x.due_on
from v_reportable x left join transparency_reports r on r.period_from = x.period_from
where x.review_sent_on is null and r.submitted_on is null and current_date >= x.due_on - 70
union all
select 'breach', 'report submitted before the professional had six weeks to review', 'Medicines Australia Code Ed. 20 s 14.1.5', 'AU', x.ref, x.hcp,
  coalesce('review sent ' || x.review_sent_on, 'no review sent') || ', report submitted ' || r.submitted_on
from v_reportable x join transparency_reports r on r.period_from = x.period_from
where r.submitted_on is not null and (x.review_sent_on is null or x.review_sent_on > r.submitted_on - 42)
union all
select case when v.standing = 'overdue' then 'breach' else 'due' end, 'transparency report to Disclosure Australia', 'Medicines Australia Code Ed. 20 s 14.4',
  'AU', 'H' || case when extract(month from v.period_from) = 1 then '1' else '2' end || '-' || extract(year from v.period_from), 'Disclosure Australia',
  v.transfers || ' transfers for ' || v.period_from || ' to ' || v.period_to || ', due ' || v.due_on
from v_transparency v where v.standing = 'overdue' or (v.standing = 'due' and v.due_on <= current_date + 30)
union all
select case when coalesce(r.declaration_on, current_date) > r.submitted_on + 7 then 'breach' else 'due' end, 'company declaration after submission', 'Medicines Australia Code Ed. 20 s 14 (declaration within seven calendar days)',
  'AU', 'H' || case when extract(month from r.period_from) = 1 then '1' else '2' end || '-' || extract(year from r.period_from), 'Medicines Australia',
  'submitted ' || r.submitted_on || coalesce(', declared ' || r.declaration_on, ', declaration due ' || (r.submitted_on + 7))
from transparency_reports r where r.submitted_on is not null and (r.declaration_on is null or r.declaration_on > r.submitted_on + 7);
