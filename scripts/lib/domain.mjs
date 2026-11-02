// The rules of the field force desk. scripts/crm.mjs is a thin shell over run().
// Every write names an actor and leaves a row in the append-only activity log.
// Dates are calendar dates (YYYY-MM-DD). The rules and their sources are in docs/compliance.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './db.mjs';
import { parseCsv, pick } from './csv.mjs';
import { price as money } from './format.mjs';

export const today = () => new Date().toISOString().slice(0, 10);

export function date(v, label) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error(`--${label} must be a date (YYYY-MM-DD)`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw Error(`--${label} must be a date (YYYY-MM-DD)`);
  return s;
}
const pastDate = (v, label) => {
  const d = v === undefined || v === true ? today() : date(v, label);
  if (d > today()) throw Error(`--${label} cannot be in the future: record it once it has happened`);
  return d;
};
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);

// "1450.00" or "$1,450" -> 145000 cents. Never guesses at a blank.
export function cents(v, label) {
  const s = String(v ?? '').replace(/[$,\s]/g, '').replace(/^(NZD|AUD)/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`--${label} must be an amount like 1450.00`);
  return Math.round(parseFloat(s) * 100);
}
function int(v, label, { min = 0, max = 100000 } = {}) {
  const n = Number(v);
  if (v === undefined || v === true || String(v).trim() === '' || !Number.isInteger(n) || n < min || n > max) throw Error(`--${label} must be a whole number from ${min} to ${max}`);
  return n;
}
function need(flags, ...keys) {
  for (const k of keys) if (flags[k] === undefined || flags[k] === true || String(flags[k]).trim() === '') throw Error(`--${k} is required`);
}
function oneOf(v, allowed, label) {
  if (!allowed.includes(v)) throw Error(`--${label} must be one of: ${allowed.join(', ')}`);
  return v;
}
const text = (v) => (v === undefined || v === true ? null : String(v).trim() || null);
const flag = (v) => v === true || ['yes', 'true', '1'].includes(String(v ?? '').toLowerCase());

// "H1-2026" -> 2026-01-01, "H2-2026" -> 2026-07-01.
export function period(v) {
  const m = String(v ?? '').trim().toUpperCase().match(/^H([12])-(\d{4})$/);
  if (!m) throw Error('--period must be a half-year like H1-2026 (January to June) or H2-2026 (July to December)');
  return `${m[2]}-${m[1] === '1' ? '01' : '07'}-01`;
}
const periodTo = (p) => (iso(p).slice(5, 7) === '01' ? `${iso(p).slice(0, 4)}-06-30` : `${iso(p).slice(0, 4)}-12-31`);
const periodName = (p) => `H${iso(p).slice(5, 7) === '01' ? 1 : 2}-${iso(p).slice(0, 4)}`;

const COUNTRIES = ['NZ', 'AU'];
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const PROFESSIONS = ['gp', 'specialist', 'nurse-practitioner', 'pharmacist', 'nurse', 'other'];
const ACCOUNT_KINDS = ['practice', 'hospital', 'pharmacy', 'clinic', 'other'];
const PRODUCT_KINDS = ['prescription', 'otc', 'device'];
const CHANNELS = ['face-to-face', 'remote', 'phone', 'group'];
const MOVE_KINDS = ['received', 'returned', 'destroyed', 'adjusted'];
const EVENT_KINDS = ['company-meeting', 'dinner-meeting', 'workshop', 'advisory-board', 'third-party-sponsorship'];
const ROLES = ['delegate', 'speaker', 'chair', 'advisor'];
const TOV_KINDS = ['speaker-fee', 'consultancy', 'advisory-board', 'sponsorship', 'registration', 'travel', 'accommodation', 'market-research'];

async function tx(db, fn) {
  await db.exec('begin');
  try { const r = await fn(); await db.exec('commit'); return r; } catch (e) { await db.exec('rollback'); throw e; }
}
async function log(db, actor, action, ref, detail) {
  await db.query('insert into activity (actor, action, ref, detail) values ($1,$2,$3,$4)', [actor, action, ref, detail]);
}
function actorOf(flags) {
  need(flags, 'actor');
  return String(flags.actor).trim();
}
async function nextRef(db, table, prefix, width) {
  const [r] = await db.query(`select coalesce(max(substring(ref from '[0-9]+$')::int), 0) + 1 as n from ${table} where ref ~ $1`, [`^${prefix}[0-9]+$`]);
  return `${prefix}${String(r.n).padStart(width, '0')}`;
}
async function nextCode(db, table, prefix, width = 3) {
  const [r] = await db.query(`select coalesce(max(substring(code from '[0-9]+$')::int), 0) + 1 as n from ${table} where code ~ $1`, [`^${prefix}[0-9]+$`]);
  return `${prefix}${String(r.n).padStart(width, '0')}`;
}

// Resolve one record from a code, reference, id or name. Exact (case-insensitive) beats partial;
// more than one partial match lists the candidates and fails.
function choose(rows, term, what, label) {
  const t = String(term ?? '').trim().toLowerCase();
  if (!t || t === 'true') throw Error(`Name the ${what.toLowerCase()}`);
  const exact = rows.filter((r) => label(r).some((x) => x && String(x).toLowerCase() === t));
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : rows.filter((r) => label(r).some((x) => x && String(x).toLowerCase().includes(t)));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw Error(`${what} "${term}" not found`);
  throw Error(`"${term}" is ambiguous: ${partial.map((r) => label(r).filter(Boolean).slice(0, 2).join(' / ')).join('; ')}`);
}
export const territory = async (db, term) => choose(await db.query('select * from territories order by code'), term, 'Territory', (r) => [r.code, r.name, r.id]);
export const rep = async (db, term) => choose(await db.query('select r.*, t.code as territory, t.country from reps r left join territories t on t.id = r.territory_id order by r.code'), term, 'Rep', (r) => [r.code, r.name, r.id]);
export const product = async (db, term) => choose(await db.query(`select *, name || coalesce(' ' || strength, '') as label from products order by code`), term, 'Product', (r) => [r.code, r.label, r.id]);
export const account = async (db, term) => choose(await db.query('select a.*, t.code as territory, t.country from accounts a left join territories t on t.id = a.territory_id order by a.code'), term, 'Account', (r) => [r.code, r.name, r.external_id, r.id]);
export const hcp = async (db, term) => choose(await db.query('select * from v_hcps order by code'), term, 'Professional', (r) => [r.code, r.name, r.name.replace(/^Dr /, ''), r.registration_number, r.external_id, r.id]);
const call_ = async (db, term) => choose(await db.query('select c.*, h.name as hcp from calls c join hcps h on h.id = c.hcp_id order by c.ref'), term, 'Call', (r) => [r.ref, r.external_id, r.id]);
const lot = async (db, term) => choose(await db.query('select l.*, p.code as product, p.name || coalesce(\' \' || p.strength, \'\') as product_name from lots l join products p on p.id = l.product_id order by l.lot_number'), term, 'Lot', (r) => [r.lot_number, r.id]);
const sample = async (db, term) => choose(await db.query('select * from v_samples order by ref'), term, 'Sample', (r) => [r.ref, r.id]);
const event = async (db, term) => choose(await db.query('select * from events order by ref'), term, 'Event', (r) => [r.ref, r.title, r.id]);
const transfer = async (db, term) => choose(await db.query('select x.*, h.name as hcp from transfers x join hcps h on h.id = x.hcp_id order by x.ref'), term, 'Transfer', (r) => [r.ref, r.id]);
const setting = async (db, key, dflt) => Number((await db.query('select value from settings where key = $1', [key]))[0]?.value ?? dflt);
const cur = (country) => (country === 'NZ' ? 'NZD' : 'AUD');

function outFile(dir, name, body) {
  const base = process.env.OUTPUT_DIR || REPO_ROOT;
  mkdirSync(path.join(base, dir), { recursive: true });
  const file = path.join(base, dir, name);
  writeFileSync(file, body, { mode: 0o600 });
  return path.relative(base, file).replace(/\\/g, '/');
}
const draftFile = (name, body) => outFile('drafts', name, body);

// ------------------------------------------------------------------ reads

const ATTENTION = `
  select case when severity = 'breach' then 0 else 1 end as rank, case when severity = 'breach' then 'breach: ' else 'act now: ' end || rule as item, ref, who || ': ' || detail || '. ' || source as detail
    from v_issues
  union all
  select 2, 'starter packs waiting', s.ref, s.hcp || ' (' || s.territory || '): ' || s.product_name || ' x' || s.quantity || ' requested ' || s.requested_on || ', ' || (current_date - s.requested_on) || ' days ago, rep ' || s.rep
    from v_samples s where s.status = 'requested' and s.requested_on < current_date - setting_num('sample_deliver_days', 7)::int
  union all
  select 2, 'rep licence expiring', r.code, r.name || ': ' || r.sample_licence || ' runs out ' || r.licence_expires || '. Medicines NZ Code Ed. 17 s 4.18.5'
    from reps r join territories t on t.id = r.territory_id
    where t.country = 'NZ' and r.status = 'active' and r.licence_expires between current_date and current_date + setting_num('licence_warn_days', 30)::int
  union all
  select 3, 'short-dated stock', k.lot_number, k.rep || ': ' || k.product_name || ' x' || k.on_hand || ' expires ' || k.expires_on
    from v_rep_stock k where k.standing = 'short-dated' and k.on_hand > 0
  union all
  select 3, 'follow-up overdue', c.ref, h.name || ' (' || t.code || '): ' || coalesce(c.next_step, 'follow up') || ', was due ' || c.follow_up_on || ', rep ' || r.name
    from calls c join hcps h on h.id = c.hcp_id join territories t on t.id = h.territory_id join reps r on r.id = c.rep_id
    where c.follow_up_on < current_date and c.follow_up_done_on is null
  union all
  select 4, 'A-segment not seen this cycle', code, name || ' (' || territory || ', ' || coalesce(specialty, profession) || '): last call ' || coalesce(last_call_on::text, 'never') || ', target ' || target_calls || ' a cycle'
    from v_hcps where status = 'active' and segment = 'A' and target_calls > 0 and cycle_calls = 0
  union all
  select 4, 'attendance not recorded', e.ref, e.title || ' was held ' || e.held_on || ': ' || count(*) || ' invited with no attendance recorded'
    from events e join attendees a on a.event_id = e.id where e.held_on < current_date and e.status <> 'cancelled' and a.attended is null group by e.ref, e.title, e.held_on
`;

export const QUESTIONS = [
  { question: 'Which A-segment professionals have not been seen this cycle, by territory?', sql: `
    select territory, code, name, coalesce(specialty, profession) as specialty, account, last_call_on, (current_date - last_call_on)::int as days_since
    from v_hcps where segment = 'A' and status = 'active' and target_calls > 0 and cycle_calls = 0 order by territory, days_since desc nulls first` },
  { question: 'How does reach and frequency compare with the plan, by territory and segment?', sql: `
    select territory, segment, count(*)::int as professionals, sum(target_calls)::int as target_calls, sum(cycle_calls)::int as calls_made,
      count(*) filter (where cycle_calls > 0)::int as reached, round(100.0 * count(*) filter (where cycle_calls >= target_calls) / count(*))::int as pct_on_target
    from v_hcps where status = 'active' and target_calls > 0 group by territory, segment order by territory, segment` },
  { question: 'Which products were detailed most in the last 90 days, by specialty?', sql: `
    select coalesce(h.specialty, h.profession) as specialty, p.code as product, count(*)::int as details, count(distinct c.hcp_id)::int as professionals
    from calls c join call_products cp on cp.call_id = c.id join products p on p.id = cp.product_id join hcps h on h.id = c.hcp_id
    where c.call_on >= current_date - 90 group by 1, 2 order by details desc limit 10` },
  { question: 'Which prescribers took starter packs and have had no call since?', sql: `
    select s.ref, s.hcp, s.territory, s.product_name, s.delivered_on, (current_date - s.delivered_on)::int as days_since, s.rep
    from v_samples s where s.status = 'delivered' and not exists (select 1 from calls c where c.hcp_id = s.hcp_id and c.call_on > s.delivered_on)
    order by s.delivered_on` },
  { question: 'How many days from a starter pack request to delivery, by rep?', sql: `
    select rep, count(*) filter (where status = 'delivered')::int as delivered, round(avg(delivered_on - requested_on) filter (where status = 'delivered'), 1) as avg_days,
      max(delivered_on - requested_on) filter (where status = 'delivered') as slowest_days, count(*) filter (where status = 'requested')::int as waiting
    from v_samples where requested_on is not null group by rep order by avg_days desc nulls last` },
  { question: 'How much sample stock is short-dated, expired or recalled, by rep?', sql: `
    select rep, sum(on_hand) filter (where standing = 'good')::int as good, sum(on_hand) filter (where standing = 'short-dated')::int as short_dated,
      sum(on_hand) filter (where standing = 'expired')::int as expired, sum(on_hand) filter (where standing = 'recalled')::int as recalled
    from v_rep_stock group by rep order by rep` },
  { question: 'Who received the most in transfers of value in the last 12 months, and for what?', sql: `
    select h.name as professional, x.currency, count(*)::int as transfers, sum(x.amount_cents)::int as total_cents, string_agg(distinct x.kind, ', ') as kinds
    from transfers x join hcps h on h.id = x.hcp_id where x.paid_on >= current_date - 365 group by h.name, x.currency order by total_cents desc limit 10` },
  { question: 'What did each event cost per professional who came, against the hospitality cap?', sql: `
    select e.ref, e.title, e.country, e.held_on, count(a.*) filter (where a.attended)::int as attended, e.meal_cents as food_per_head_cents,
      case when e.country = 'AU' then setting_num('hospitality_cap_cents_au', 14000)::int end as cap_cents,
      (select coalesce(sum(x.amount_cents), 0) from transfers x where x.event_id = e.id)::int as paid_to_professionals_cents,
      case when e.country = 'NZ' then 'NZD' else 'AUD' end as currency
    from events e left join attendees a on a.event_id = e.id where e.status = 'held' group by e.id order by e.held_on desc` },
  { question: 'Which A and B professionals have gone quiet after being seen before?', sql: `
    select territory, code, name, segment, coalesce(specialty, profession) as specialty, last_call_on, (current_date - last_call_on)::int as days_quiet, rep
    from v_hcps where status = 'active' and segment in ('A', 'B') and last_call_on < current_date - setting_num('quiet_days', 60)::int order by days_quiet desc` },
  { question: 'Which practices have several prescribers but only one of them seen this cycle?', sql: `
    select account, territory, count(*)::int as prescribers, count(*) filter (where cycle_calls > 0)::int as seen,
      string_agg(name, ', ' order by name) filter (where cycle_calls = 0) as not_seen
    from v_hcps where status = 'active' and prescriber and account is not null group by account, territory
    having count(*) > 1 and count(*) filter (where cycle_calls > 0) <= 1 order by prescribers desc` },
];

export const reads = {
  async territories(db) {
    return db.query(`select t.code, t.name, t.country, t.state, (select string_agg(r.name, ', ') from reps r where r.territory_id = t.id and r.status = 'active') as reps,
      count(h.*) filter (where h.status = 'active')::int as professionals, count(h.*) filter (where h.status = 'active' and h.segment = 'A')::int as a_segment,
      count(h.*) filter (where h.status = 'active' and h.cycle_calls < h.target_calls)::int as behind_target, coalesce(sum(h.cycle_calls), 0)::int as calls_this_cycle
      from territories t left join v_hcps h on h.territory_id = t.id group by t.id order by t.code`);
  },
  async territory(db, [term]) {
    const t = await territory(db, term);
    return {
      territory: t,
      professionals: await db.query('select code, name, segment, target_calls as target, cycle_calls as calls, last_call_on, account from v_hcps where territory_id = $1 and status = $2 order by segment, name', [t.id, 'active']),
      samples_open: await db.query(`select ref, hcp, product_name, quantity, requested_on from v_samples where territory = $1 and status = 'requested' order by requested_on`, [t.code]),
      events_coming: await db.query(`select ref, title, held_on, kind from events where territory_id = $1 and status = 'planned' order by held_on`, [t.id]),
    };
  },
  async reps(db) {
    return db.query(`select r.code, r.name, t.code as territory, t.country, r.status, r.sample_licence as licence, r.licence_expires,
      (select count(*) from calls c where c.rep_id = r.id and c.call_on > current_date - setting_num('cycle_days', 56)::int)::int as calls_this_cycle,
      (select coalesce(sum(on_hand), 0) from v_rep_stock k where k.rep_id = r.id)::int as sample_units
      from reps r left join territories t on t.id = r.territory_id order by r.code`);
  },
  async rep(db, [term]) {
    const r = await rep(db, term);
    return {
      rep: r,
      stock: await db.query('select product, lot_number, expires_on, on_hand, standing from v_rep_stock where rep_id = $1 order by product', [r.id]),
      recent_calls: await db.query('select c.ref, c.call_on, h.name as professional, c.channel, c.next_step from calls c join hcps h on h.id = c.hcp_id where c.rep_id = $1 order by c.call_on desc limit 10', [r.id]),
      samples_open: await db.query(`select ref, hcp, product_name, quantity, requested_on from v_samples where rep_id = $1 and status = 'requested' order by requested_on`, [r.id]),
    };
  },
  async products(db) {
    return db.query(`select p.code, p.name, p.strength, p.form, p.kind, p.registered, p.starter_packs,
      (select coalesce(sum(on_hand), 0) from v_rep_stock k where k.product = p.code)::int as units_with_reps,
      (select count(*) from call_products cp join calls c on c.id = cp.call_id where cp.product_id = p.id and c.call_on >= current_date - 90)::int as details_90_days
      from products p order by p.code`);
  },
  async accounts(db, a, f) {
    const t = f.territory ? await territory(db, f.territory) : null;
    return db.query(`select a.code, a.name, a.kind, t.code as territory, a.city, (select count(*) from hcps h where h.account_id = a.id and h.status = 'active')::int as professionals,
      (select max(c.call_on) from calls c join hcps h on h.id = c.hcp_id where h.account_id = a.id) as last_call_on
      from accounts a left join territories t on t.id = a.territory_id where ($1::uuid is null or a.territory_id = $1) order by a.code`, [t?.id ?? null]);
  },
  async account(db, [term]) {
    const a = await account(db, term);
    return { account: a, professionals: await db.query('select code, name, profession, specialty, prescriber, segment, cycle_calls as calls, last_call_on, status from v_hcps where account_id = $1 order by name', [a.id]) };
  },
  async hcps(db, a, f) {
    const t = f.territory ? await territory(db, f.territory) : null;
    const seg = f.segment ? oneOf(String(f.segment).toUpperCase(), ['A', 'B', 'C'], 'segment') : null;
    return db.query(`select code, name, profession, specialty, segment, target_calls as target, cycle_calls as calls, last_call_on, account, territory, status
      from v_hcps where ($1::uuid is null or territory_id = $1) and ($2::text is null or segment = $2) and ($3::text is null or specialty ilike '%' || $3 || '%')
        and (status = 'active' or $4) order by territory, segment, name`, [t?.id ?? null, seg, text(f.specialty), flag(f.all)]);
  },
  async hcp(db, [term]) {
    const h = await hcp(db, term);
    return {
      professional: h,
      calls: await db.query(`select c.ref, c.call_on, r.name as rep, c.channel, (select string_agg(p.code, ', ') from call_products cp join products p on p.id = cp.product_id where cp.call_id = c.id) as products,
        c.notes, c.next_step, c.follow_up_on from calls c join reps r on r.id = c.rep_id where c.hcp_id = $1 order by c.call_on desc limit 10`, [h.id]),
      samples: await db.query('select ref, product_name, quantity, requested_on, status, delivered_on, lot_number, receipt_signed_on from v_samples where hcp_id = $1 order by coalesce(delivered_on, requested_on) desc', [h.id]),
      events: await db.query('select e.ref, e.title, e.held_on, a.role, a.attended from attendees a join events e on e.id = a.event_id where a.hcp_id = $1 order by e.held_on desc', [h.id]),
      transfers: await db.query('select ref, kind, description, amount_cents, currency, paid_on, notice_given_on, review_sent_on from transfers where hcp_id = $1 order by paid_on desc', [h.id]),
    };
  },
  async calls(db, a, f) {
    const days = f.days ? int(f.days, 'days', { min: 1, max: 3650 }) : 30;
    const r = f.rep ? await rep(db, f.rep) : null;
    const h = f.hcp ? await hcp(db, f.hcp) : null;
    return db.query(`select c.ref, c.call_on, h.name as professional, t.code as territory, r.name as rep, c.channel,
      (select string_agg(p.code, ', ') from call_products cp join products p on p.id = cp.product_id where cp.call_id = c.id) as products, c.next_step, c.follow_up_on
      from calls c join hcps h on h.id = c.hcp_id join territories t on t.id = h.territory_id join reps r on r.id = c.rep_id
      where c.call_on >= current_date - $1::int and ($2::uuid is null or c.rep_id = $2) and ($3::uuid is null or c.hcp_id = $3) order by c.call_on desc, c.ref`, [days, r?.id ?? null, h?.id ?? null]);
  },
  // The week's call plan for a territory or a rep: who is behind target, follow-ups falling due,
  // starter packs to deliver and events to brief.
  async 'call-plan'(db, a, f) {
    const days = f.days ? int(f.days, 'days', { min: 1, max: 60 }) : 7;
    let t = f.territory ? await territory(db, f.territory) : null;
    if (!t && f.rep) { const r = await rep(db, f.rep); if (!r.territory_id) throw Error(`${r.name} has no territory`); t = { id: r.territory_id }; }
    const tid = t?.id ?? null;
    return {
      behind_target: await db.query(`select code, name, segment, coalesce(specialty, profession) as specialty, account, target_calls - cycle_calls as calls_short, last_call_on, territory
        from v_hcps where status = 'active' and cycle_calls < target_calls and ($1::uuid is null or territory_id = $1)
        order by segment, last_call_on nulls first`, [tid]),
      follow_ups: await db.query(`select c.ref, h.name as professional, c.next_step, c.follow_up_on from calls c join hcps h on h.id = c.hcp_id
        where c.follow_up_done_on is null and c.follow_up_on <= current_date + $2::int and ($1::uuid is null or h.territory_id = $1) order by c.follow_up_on`, [tid, days]),
      starter_packs_to_deliver: await db.query(`select s.ref, s.hcp, s.product_name, s.quantity, s.requested_on from v_samples s join hcps h on h.id = s.hcp_id
        where s.status = 'requested' and ($1::uuid is null or h.territory_id = $1) order by s.requested_on`, [tid]),
      events_coming: await db.query(`select e.ref, e.title, e.held_on, (select count(*) from attendees a where a.event_id = e.id)::int as invited from events e
        where e.status = 'planned' and e.held_on <= current_date + 30 and ($1::uuid is null or e.territory_id = $1) order by e.held_on`, [tid]),
    };
  },
  async coverage(db, a, f) {
    const t = f.territory ? await territory(db, f.territory) : null;
    return db.query(`select territory, segment, count(*)::int as professionals, sum(target_calls)::int as target_calls, sum(cycle_calls)::int as calls_made,
      count(*) filter (where cycle_calls > 0)::int as reached, round(100.0 * count(*) filter (where cycle_calls > 0) / count(*))::int as reach_pct,
      round(100.0 * count(*) filter (where cycle_calls >= target_calls) / count(*))::int as on_target_pct
      from v_hcps where status = 'active' and target_calls > 0 and ($1::uuid is null or territory_id = $1) group by territory, segment order by territory, segment`, [t?.id ?? null]);
  },
  async 'follow-ups'(db, a, f) {
    const r = f.rep ? await rep(db, f.rep) : null;
    return db.query(`select c.ref, c.follow_up_on, case when c.follow_up_on < current_date then 'overdue' else 'due' end as standing, h.name as professional, r.name as rep, c.next_step
      from calls c join hcps h on h.id = c.hcp_id join reps r on r.id = c.rep_id
      where c.follow_up_on is not null and c.follow_up_done_on is null and ($1::uuid is null or c.rep_id = $1) order by c.follow_up_on`, [r?.id ?? null]);
  },
  async samples(db, a, f) {
    const r = f.rep ? await rep(db, f.rep) : null;
    const h = f.hcp ? await hcp(db, f.hcp) : null;
    return db.query(`select ref, hcp, territory, product_name as product, quantity, request_kind as request, requested_on, status, delivered_on, lot_number, receipt_signed_on as signed, rep
      from v_samples where ($1::uuid is null or rep_id = $1) and ($2::uuid is null or hcp_id = $2) and (not $3 or status = 'requested')
      order by coalesce(delivered_on, requested_on) desc nulls first, ref`, [r?.id ?? null, h?.id ?? null, flag(f.open)]);
  },
  async 'rep-stock'(db, a, f) {
    const r = f.rep ? await rep(db, f.rep) : null;
    return db.query('select rep, product_name as product, lot_number, expires_on, on_hand, standing from v_rep_stock where ($1::uuid is null or rep_id = $1) order by rep, product, expires_on', [r?.id ?? null]);
  },
  async lots(db) {
    return db.query(`select l.lot_number, p.code as product, l.expires_on, l.recalled_on,
      (select coalesce(sum(on_hand), 0) from v_rep_stock k where k.lot_id = l.id)::int as with_reps,
      (select coalesce(sum(quantity), 0) from samples s where s.lot_id = l.id and s.status = 'delivered')::int as given_out
      from lots l join products p on p.id = l.product_id order by p.code, l.expires_on`);
  },
  // Every professional who received a lot, and every rep still holding it.
  async recall(db, [term]) {
    const l = await lot(db, term);
    return {
      lot: { lot_number: l.lot_number, product: l.product_name, expires_on: l.expires_on, recalled_on: l.recalled_on, note: l.recall_note },
      given_to: await db.query('select ref, hcp, territory, quantity, delivered_on, rep, recall_told_on as told from v_samples where lot_id = $1 and status = $2 order by delivered_on', [l.id, 'delivered']),
      still_with_reps: await db.query('select rep, on_hand from v_rep_stock where lot_id = $1 and on_hand > 0 order by rep', [l.id]),
    };
  },
  async events(db, a, f) {
    return db.query(`select e.ref, e.title, e.kind, e.country, e.held_on, e.status, e.meal_cents as food_per_head_cents, case when e.country = 'NZ' then 'NZD' else 'AUD' end as currency,
      (select count(*) from attendees a where a.event_id = e.id)::int as invited, (select count(*) from attendees a where a.event_id = e.id and a.attended)::int as attended
      from events e where (not $1 or (e.status = 'planned' and e.held_on >= current_date)) order by e.held_on desc`, [flag(f.upcoming)]);
  },
  async event(db, [term]) {
    const e = await event(db, term);
    return {
      event: e,
      attendees: await db.query('select h.code, h.name, h.profession, a.role, a.attended from attendees a join hcps h on h.id = a.hcp_id where a.event_id = $1 order by a.role, h.name', [e.id]),
      transfers: await db.query('select x.ref, h.name as professional, x.kind, x.amount_cents, x.currency, x.paid_on from transfers x join hcps h on h.id = x.hcp_id where x.event_id = $1 order by x.ref', [e.id]),
      issues: await db.query('select severity, rule, detail, source from v_issues where ref = $1', [e.ref]),
    };
  },
  async transfers(db, a, f) {
    const p = f.period ? period(f.period) : null;
    const h = f.hcp ? await hcp(db, f.hcp) : null;
    return db.query(`select x.ref, h.name as professional, x.kind, x.amount_cents, x.currency, x.paid_on, x.paid_to, e.ref as event, x.notice_given_on as notice, x.review_sent_on as review_sent,
      (x.ref in (select ref from v_reportable)) as reportable
      from transfers x join hcps h on h.id = x.hcp_id left join events e on e.id = x.event_id
      where ($1::date is null or tov_period_from(x.paid_on) = $1) and ($2::uuid is null or x.hcp_id = $2) order by x.paid_on desc`, [p, h?.id ?? null]);
  },
  async transparency(db) {
    const rows = await db.query('select * from v_transparency order by period_from desc');
    return rows.map((r) => ({ period: periodName(r.period_from), ...r }));
  },
  async compliance(db, a, f) {
    const c = f.country ? oneOf(String(f.country).toUpperCase(), COUNTRIES, 'country') : null;
    return db.query(`select severity, rule, ref, who, detail, source from v_issues where ($1::text is null or country = $1) order by case severity when 'breach' then 0 else 1 end, rule, ref`, [c]);
  },
  async attention(db) {
    return db.query(`select item, ref, detail from (${ATTENTION}) a order by rank, item, ref`);
  },
  async insights(db) {
    const out = [];
    for (const q of QUESTIONS) out.push({ question: q.question, rows: await db.query(q.sql) });
    return out;
  },
  async activity(db, a, f) {
    const days = f.days ? int(f.days, 'days', { min: 1, max: 3650 }) : 7;
    return db.query(`select to_char(at, 'YYYY-MM-DD HH24:MI') as at, actor, action, ref, detail from activity where at >= now() - ($1::int * interval '1 day') order by at desc`, [days]);
  },
  async settings(db) {
    return db.query('select key, value, note from settings order by key');
  },
};

// ------------------------------------------------------------------ writes

export const writes = {
  async 'add-territory'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'code', 'name', 'country');
    const country = oneOf(String(f.country).toUpperCase(), COUNTRIES, 'country');
    const state = f.state ? oneOf(String(f.state).toUpperCase(), STATES, 'state') : null;
    if (country === 'NZ' && state) throw Error('A New Zealand territory has no state');
    const code = String(f.code).toUpperCase();
    return tx(db, async () => {
      await db.query('insert into territories (code, name, country, state) values ($1,$2,$3,$4)', [code, text(f.name), country, state]);
      await log(db, actor, 'add-territory', code, text(f.name));
      return { territory: code, country, state };
    });
  },
  async 'add-rep'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'name', 'territory');
    const t = await territory(db, f.territory);
    const code = text(f.code) || await nextCode(db, 'reps', 'R-', 2);
    const expires = f['licence-expires'] ? date(f['licence-expires'], 'licence-expires') : null;
    return tx(db, async () => {
      await db.query('insert into reps (code, name, email, territory_id, sample_licence, licence_expires) values ($1,$2,$3,$4,$5,$6)', [code, text(f.name), text(f.email), t.id, text(f.licence), expires]);
      await log(db, actor, 'add-rep', code, `${text(f.name)}, ${t.code}`);
      return { rep: code, territory: t.code, licence: text(f.licence), note: t.country === 'NZ' && !text(f.licence) ? 'No sample licence: this rep cannot issue samples in New Zealand until one is recorded (Medicines NZ Code Ed. 17 s 4.18.5)' : undefined };
    });
  },
  async 'rep-status'(db, [term], f) {
    const actor = actorOf(f);
    const r = await rep(db, term);
    const status = f.status ? oneOf(String(f.status), ['active', 'left'], 'status') : r.status;
    const t = f.territory ? await territory(db, f.territory) : null;
    const expires = f['licence-expires'] ? date(f['licence-expires'], 'licence-expires') : iso(r.licence_expires);
    return tx(db, async () => {
      await db.query('update reps set status = $2, territory_id = coalesce($3, territory_id), sample_licence = coalesce($4, sample_licence), licence_expires = $5 where id = $1',
        [r.id, status, t?.id ?? null, text(f.licence), expires]);
      await log(db, actor, 'rep-status', r.code, [f.status && `status ${status}`, t && `territory ${t.code}`, f.licence && `licence ${f.licence}`, f['licence-expires'] && `licence to ${expires}`].filter(Boolean).join(', ') || 'no change');
      return (await rep(db, r.code));
    });
  },
  async 'add-product'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'code', 'name');
    const kind = f.kind ? oneOf(String(f.kind), PRODUCT_KINDS, 'kind') : 'prescription';
    const registered = f.registered === undefined ? true : flag(f.registered);
    const packs = flag(f['starter-packs']);
    if (packs && !registered) throw Error('An unregistered product cannot have starter packs');
    return tx(db, async () => {
      await db.query('insert into products (code, name, strength, form, kind, registered, starter_packs) values ($1,$2,$3,$4,$5,$6,$7)', [String(f.code).toUpperCase(), text(f.name), text(f.strength), text(f.form), kind, registered, packs]);
      await log(db, actor, 'add-product', String(f.code).toUpperCase(), text(f.name));
      return { product: String(f.code).toUpperCase(), registered, starter_packs: packs };
    });
  },
  async 'add-account'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'name', 'territory');
    const t = await territory(db, f.territory);
    const kind = f.kind ? oneOf(String(f.kind), ACCOUNT_KINDS, 'kind') : 'practice';
    const code = text(f.code) || await nextCode(db, 'accounts', 'A-', 2);
    return tx(db, async () => {
      await db.query('insert into accounts (code, name, kind, territory_id, address, city, state, postcode) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [code, text(f.name), kind, t.id, text(f.address), text(f.city), t.state || text(f.state), text(f.postcode)]);
      await log(db, actor, 'add-account', code, text(f.name));
      return { account: code, name: text(f.name), territory: t.code };
    });
  },
  async 'add-hcp'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'name', 'profession');
    const profession = oneOf(String(f.profession), PROFESSIONS, 'profession');
    const acc = f.account ? await account(db, f.account) : null;
    const t = f.territory ? await territory(db, f.territory) : acc?.territory_id ? { id: acc.territory_id } : null;
    if (!t) throw Error('--territory is required when there is no --account');
    const segment = f.segment ? oneOf(String(f.segment).toUpperCase(), ['A', 'B', 'C'], 'segment') : 'B';
    const target = f.target !== undefined ? int(f.target, 'target', { min: 0, max: 20 }) : { A: 2, B: 1, C: 0 }[segment];
    const prescriber = f.prescriber !== undefined ? flag(f.prescriber) : ['gp', 'specialist', 'nurse-practitioner'].includes(profession);
    const code = text(f.code) || await nextCode(db, 'hcps', 'H-');
    return tx(db, async () => {
      await db.query(`insert into hcps (code, name, profession, specialty, prescriber, registration_number, account_id, territory_id, segment, target_calls, email, phone)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [code, text(f.name), profession, text(f.specialty), prescriber, text(f.registration), acc?.id ?? null, t.id, segment, target, text(f.email), text(f.phone)]);
      await log(db, actor, 'add-hcp', code, `${text(f.name)}, ${profession}${acc ? `, ${acc.name}` : ''}`);
      return { professional: code, name: text(f.name), prescriber, segment, target_calls: target };
    });
  },
  async 'hcp-status'(db, [term], f) {
    const actor = actorOf(f);
    const h = await hcp(db, term);
    const status = f.status ? oneOf(String(f.status), ['active', 'moved', 'retired'], 'status') : h.status;
    const segment = f.segment ? oneOf(String(f.segment).toUpperCase(), ['A', 'B', 'C'], 'segment') : h.segment;
    const target = f.target !== undefined ? int(f.target, 'target', { min: 0, max: 20 }) : h.target_calls;
    const contact = f['contact-ok'] !== undefined ? flag(f['contact-ok']) : h.contact_ok;
    const prescriber = f.prescriber !== undefined ? flag(f.prescriber) : h.prescriber;
    const acc = f.account ? await account(db, f.account) : null;
    return tx(db, async () => {
      await db.query('update hcps set status = $2, segment = $3, target_calls = $4, contact_ok = $5, prescriber = $6, account_id = coalesce($7, account_id), territory_id = coalesce($8, territory_id) where id = $1',
        [h.id, status, segment, target, contact, prescriber, acc?.id ?? null, acc?.territory_id ?? null]);
      await log(db, actor, 'hcp-status', h.code, `status ${status}, segment ${segment}, target ${target}, contact ${contact ? 'yes' : 'no'}, prescriber ${prescriber ? 'yes' : 'no'}${acc ? `, moved to ${acc.name}` : ''}`);
      return (await hcp(db, h.code));
    });
  },
  async 'log-call'(db, [term], f) {
    const actor = actorOf(f);
    need(f, 'rep');
    const h = await hcp(db, term);
    if (h.status !== 'active') throw Error(`${h.name} is ${h.status}. Update them with /hcp-status first.`);
    const r = await rep(db, f.rep);
    const on = pastDate(f.date, 'date');
    const channel = f.channel ? oneOf(String(f.channel), CHANNELS, 'channel') : 'face-to-face';
    const prods = [];
    for (const p of String(text(f.products) || '').split(',').map((x) => x.trim()).filter(Boolean)) prods.push(await product(db, p));
    const follow = f['follow-up'] ? date(f['follow-up'], 'follow-up') : null;
    if (follow && follow < on) throw Error('--follow-up cannot be before the call');
    return tx(db, async () => {
      const ref = await nextRef(db, 'calls', 'C-', 4);
      const [c] = await db.query('insert into calls (ref, hcp_id, rep_id, call_on, channel, notes, next_step, follow_up_on) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
        [ref, h.id, r.id, on, channel, text(f.notes), text(f['next-step']), follow]);
      for (const p of prods) await db.query('insert into call_products (call_id, product_id) values ($1,$2) on conflict do nothing', [c.id, p.id]);
      await log(db, actor, 'log-call', ref, `${h.name} by ${r.name}${prods.length ? `: ${prods.map((p) => p.code).join(', ')}` : ''}`);
      const unregistered = prods.filter((p) => !p.registered).map((p) => p.code);
      return { call: ref, professional: h.name, products: prods.map((p) => p.code), follow_up_on: follow,
        warning: unregistered.length ? `${unregistered.join(', ')} is not registered: promotion before approval is restricted. Check the call notes with your medical or compliance lead.` : undefined };
    });
  },
  async 'follow-up-done'(db, [term], f) {
    const actor = actorOf(f);
    const c = await call_(db, term);
    if (!c.follow_up_on) throw Error(`${c.ref} has no follow-up`);
    if (c.follow_up_done_on) throw Error(`${c.ref} follow-up was done on ${iso(c.follow_up_done_on)}`);
    const on = pastDate(f.date, 'date');
    return tx(db, async () => {
      await db.query('update calls set follow_up_done_on = $2 where id = $1', [c.id, on]);
      await log(db, actor, 'follow-up-done', c.ref, `${c.hcp}: ${c.next_step || 'follow up'}`);
      return { call: c.ref, done_on: on };
    });
  },
  async 'add-lot'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'product', 'lot', 'expires');
    const p = await product(db, f.product);
    const expires = date(f.expires, 'expires');
    return tx(db, async () => {
      await db.query('insert into lots (product_id, lot_number, expires_on) values ($1,$2,$3)', [p.id, String(f.lot).trim(), expires]);
      await log(db, actor, 'add-lot', String(f.lot).trim(), `${p.label}, expires ${expires}`);
      return { lot: String(f.lot).trim(), product: p.label, expires_on: expires };
    });
  },
  async 'recall-lot'(db, [term], f) {
    const actor = actorOf(f);
    need(f, 'note');
    const l = await lot(db, term);
    if (l.recalled_on) throw Error(`${l.lot_number} was recalled on ${iso(l.recalled_on)}`);
    const on = pastDate(f.date, 'date');
    return tx(db, async () => {
      await db.query('update lots set recalled_on = $2, recall_note = $3 where id = $1', [l.id, on, text(f.note)]);
      await log(db, actor, 'recall-lot', l.lot_number, text(f.note));
      return reads.recall(db, [l.lot_number]);
    });
  },
  async 'move-stock'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'rep', 'lot', 'qty', 'kind');
    const r = await rep(db, f.rep);
    const l = await lot(db, f.lot);
    const kind = oneOf(String(f.kind), MOVE_KINDS, 'kind');
    let qty = int(f.qty, 'qty', { min: kind === 'adjusted' ? -100000 : 1 });
    if (qty === 0) throw Error('--qty cannot be 0');
    if (kind === 'returned' || kind === 'destroyed') qty = -qty;
    if (kind === 'received' && l.recalled_on) throw Error(`${l.lot_number} is recalled: it cannot go out to a rep`);
    if (kind === 'received' && iso(l.expires_on) < today()) throw Error(`${l.lot_number} expired on ${iso(l.expires_on)}: it cannot go out to a rep`);
    if (kind === 'adjusted') need(f, 'note');
    const [held] = await db.query('select coalesce(sum(qty), 0)::int as n from stock_moves where rep_id = $1 and lot_id = $2', [r.id, l.id]);
    if (held.n + qty < 0) throw Error(`${r.name} holds ${held.n} of ${l.lot_number}: cannot take out ${-qty}`);
    return tx(db, async () => {
      const ref = await nextRef(db, 'stock_moves', 'M-', 4);
      await db.query('insert into stock_moves (ref, rep_id, lot_id, qty, kind, moved_on, note) values ($1,$2,$3,$4,$5,$6,$7)', [ref, r.id, l.id, qty, kind, pastDate(f.date, 'date'), text(f.note)]);
      await log(db, actor, 'move-stock', ref, `${r.name} ${kind} ${Math.abs(qty)} of ${l.lot_number}`);
      return { move: ref, rep: r.name, lot: l.lot_number, kind, qty, on_hand: held.n + qty };
    });
  },
  async 'request-sample'(db, [term], f) {
    const actor = actorOf(f);
    need(f, 'product', 'qty', 'rep');
    const h = await hcp(db, term);
    const p = await product(db, f.product);
    const r = await rep(db, f.rep);
    const qty = int(f.qty, 'qty', { min: 1, max: 100 });
    if (h.status !== 'active') throw Error(`${h.name} is ${h.status}`);
    if (!h.prescriber) throw Error(`${h.name} (${h.profession}) cannot prescribe: starter packs go to prescribers only (Medicines NZ Code Ed. 17 s 4.18.1; house rule in Australia)`);
    if (!p.registered) throw Error(`${p.label} is not registered for supply: it cannot be sampled`);
    if (!p.starter_packs) throw Error(`${p.label} has no starter packs`);
    const on = pastDate(f.date, 'date');
    const address = text(f.address) || [h.name, h.account, h.practice_address].filter(Boolean).join(', ');
    if (!h.practice_address && !text(f.address)) throw Error(`No practice address for ${h.name}: give --address as written on the request`);
    return tx(db, async () => {
      const ref = await nextRef(db, 'samples', 'S-', 4);
      await db.query(`insert into samples (ref, hcp_id, rep_id, product_id, quantity, request_kind, requested_on, request_address) values ($1,$2,$3,$4,$5,'written',$6,$7)`,
        [ref, h.id, r.id, p.id, qty, on, address]);
      await log(db, actor, 'request-sample', ref, `${h.name}: ${p.label} x${qty}`);
      return { sample: ref, professional: h.name, product: p.label, quantity: qty, requested_on: on, request_address: address, next: `Deliver with /deliver-sample ${ref} --lot=<lot>` };
    });
  },
  async 'deliver-sample'(db, [term], f) {
    const actor = actorOf(f);
    need(f, 'lot');
    const s = await sample(db, term);
    if (s.status !== 'requested') throw Error(`${s.ref} is ${s.status}`);
    const l = await lot(db, f.lot);
    const on = pastDate(f.date, 'date');
    const [p] = await db.query('select id from products where code = $1', [s.product]);
    if (l.product_id !== p.id) throw Error(`${l.lot_number} is ${l.product_name}, not ${s.product_name}`);
    if (l.recalled_on) throw Error(`${l.lot_number} is recalled: quarantine it and pick another lot`);
    if (iso(l.expires_on) < on) throw Error(`${l.lot_number} expired on ${iso(l.expires_on)}`);
    if (iso(s.requested_on) > on) throw Error(`The written request is dated ${iso(s.requested_on)}: a starter pack goes after the request, never before (Medicines Australia Code Ed. 20 s 6.1.5)`);
    if (s.country === 'NZ') {
      if (!s.sample_licence) throw Error(`${s.rep} has no sample licence on file: a rep carrying samples holds a hawker's licence or is nominated on the company licence (Medicines NZ Code Ed. 17 s 4.18.5)`);
      if (s.licence_expires && iso(s.licence_expires) < on) throw Error(`${s.rep}'s licence ${s.sample_licence} expired on ${iso(s.licence_expires)} (Medicines NZ Code Ed. 17 s 4.18.5)`);
    }
    const signed = f.signed === undefined ? null : f.signed === true ? on : date(f.signed, 'signed');
    if (signed && signed < on) throw Error('--signed cannot be before delivery');
    const [held] = await db.query('select coalesce(sum(qty), 0)::int as n from stock_moves where rep_id = $1 and lot_id = $2', [s.rep_id, l.id]);
    if (held.n < s.quantity) throw Error(`${s.rep} holds ${held.n} of ${l.lot_number}: not enough for ${s.quantity}`);
    return tx(db, async () => {
      await db.query(`update samples set status = 'delivered', delivered_on = $2, lot_id = $3, receipt_signed_on = $4 where id = $1`, [s.id, on, l.id, signed]);
      const ref = await nextRef(db, 'stock_moves', 'M-', 4);
      await db.query(`insert into stock_moves (ref, rep_id, lot_id, qty, kind, moved_on, sample_id) values ($1,$2,$3,$4,'issued',$5,$6)`, [ref, s.rep_id, l.id, -s.quantity, on, s.id]);
      await log(db, actor, 'deliver-sample', s.ref, `${s.hcp}: ${s.product_name} x${s.quantity}, lot ${l.lot_number}${signed ? ', receipt signed' : ''}`);
      return { sample: s.ref, delivered_on: on, lot: l.lot_number, receipt_signed_on: signed,
        warning: s.country === 'NZ' && !signed ? 'No signed receipt yet: get the prescriber\'s signature and record it with /sign-receipt (Medicines NZ Code Ed. 17 s 4.18.6)' : undefined };
    });
  },
  async 'sign-receipt'(db, [term], f) {
    const actor = actorOf(f);
    const s = await sample(db, term);
    if (s.status !== 'delivered') throw Error(`${s.ref} is ${s.status}: nothing to sign for`);
    if (s.receipt_signed_on) throw Error(`${s.ref} receipt was signed on ${iso(s.receipt_signed_on)}`);
    const on = pastDate(f.date, 'date');
    if (on < iso(s.delivered_on)) throw Error('A receipt cannot be signed before delivery');
    return tx(db, async () => {
      await db.query('update samples set receipt_signed_on = $2 where id = $1', [s.id, on]);
      await log(db, actor, 'sign-receipt', s.ref, s.hcp);
      return { sample: s.ref, receipt_signed_on: on };
    });
  },
  async 'cancel-sample'(db, [term], f) {
    const actor = actorOf(f);
    need(f, 'reason');
    const s = await sample(db, term);
    if (s.status !== 'requested') throw Error(`${s.ref} is ${s.status}: only a request not yet delivered can be cancelled`);
    return tx(db, async () => {
      await db.query(`update samples set status = 'cancelled' where id = $1`, [s.id]);
      await log(db, actor, 'cancel-sample', s.ref, text(f.reason));
      return { sample: s.ref, status: 'cancelled' };
    });
  },
  async 'recall-told'(db, [term], f) {
    const actor = actorOf(f);
    const s = await sample(db, term);
    if (!s.recalled_on) throw Error(`${s.ref} is not from a recalled lot`);
    if (s.recall_told_on) throw Error(`${s.hcp} was told on ${iso(s.recall_told_on)}`);
    const on = pastDate(f.date, 'date');
    return tx(db, async () => {
      await db.query('update samples set recall_told_on = $2 where id = $1', [s.id, on]);
      await log(db, actor, 'recall-told', s.ref, `${s.hcp} told of the recall of ${s.lot_number}`);
      return { sample: s.ref, professional: s.hcp, told_on: on };
    });
  },
  async 'add-event'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'title', 'kind', 'territory', 'date');
    const kind = oneOf(String(f.kind), EVENT_KINDS, 'kind');
    const t = await territory(db, f.territory);
    const on = date(f.date, 'date');
    const meal = f.meal !== undefined ? cents(f.meal, 'meal') : null;
    if (flag(f.entertainment)) throw Error(`No entertainment at an event with health professionals (${t.country === 'AU' ? 'Medicines Australia Code Ed. 20 s 4.5.5' : 'Medicines NZ Code Ed. 17 s 4.8.3.1'})`);
    if (t.country === 'NZ' && flag(f.takeaway)) throw Error('Takeaway meals are prohibited (Medicines NZ Code Ed. 17 s 4.8.2.2)');
    const cap = await setting(db, 'hospitality_cap_cents_au', 14000);
    if (t.country === 'AU' && meal !== null && meal > cap) throw Error(`Food and drink at ${money(meal, 'AUD')} a head is over the cap of ${money(cap, 'AUD')} excluding gratuities and GST (Medicines Australia Code Ed. 20 s 4.5.3)`);
    if (kind !== 'third-party-sponsorship' && !text(f.education)) throw Error('--education is required: hospitality must be secondary to the education (Medicines Australia Code Ed. 20 s 4.5.2; Medicines NZ Code Ed. 17 s 4.8.2.1)');
    return tx(db, async () => {
      const ref = await nextRef(db, 'events', 'E-', 2);
      await db.query(`insert into events (ref, title, kind, country, territory_id, held_on, venue, education, hours, meal_cents, takeaway) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [ref, text(f.title), kind, t.country, t.id, on, text(f.venue), text(f.education), f.hours ? Number(f.hours) : null, meal, flag(f.takeaway)]);
      await log(db, actor, 'add-event', ref, `${text(f.title)} on ${on}`);
      return { event: ref, title: text(f.title), held_on: on, country: t.country };
    });
  },
  async invite(db, [ev, who], f) {
    const actor = actorOf(f);
    const e = await event(db, ev);
    const h = await hcp(db, who);
    const role = f.role ? oneOf(String(f.role), ROLES, 'role') : 'delegate';
    if (e.status !== 'planned') throw Error(`${e.ref} is ${e.status}`);
    return tx(db, async () => {
      await db.query('insert into attendees (event_id, hcp_id, role) values ($1,$2,$3)', [e.id, h.id, role]);
      await log(db, actor, 'invite', e.ref, `${h.name} as ${role}`);
      return { event: e.ref, professional: h.name, role, note: ['speaker', 'advisor', 'chair'].includes(role) && h.country === 'AU' ? 'Give notice of disclosure before paying a fee or travel: /record-tov needs --notice (Medicines Australia Code Ed. 20 s 14.1.6)' : undefined };
    });
  },
  async attended(db, [ev, who], f) {
    const actor = actorOf(f);
    const e = await event(db, ev);
    const h = await hcp(db, who);
    if (iso(e.held_on) > today()) throw Error(`${e.ref} has not happened yet`);
    const came = !flag(f.no);
    return tx(db, async () => {
      const r = await db.query('update attendees set attended = $3 where event_id = $1 and hcp_id = $2 returning id', [e.id, h.id, came]);
      if (!r.length) throw Error(`${h.name} was not invited to ${e.ref}. Add them with /invite first.`);
      await log(db, actor, 'attended', e.ref, `${h.name}: ${came ? 'came' : 'did not come'}`);
      return { event: e.ref, professional: h.name, attended: came };
    });
  },
  // Record an event as held (with the actual food and drink per head) or cancelled.
  async 'event-status'(db, [ev], f) {
    const actor = actorOf(f);
    need(f, 'status');
    const e = await event(db, ev);
    const status = oneOf(String(f.status), ['held', 'cancelled'], 'status');
    if (status === 'held' && iso(e.held_on) > today()) throw Error(`${e.ref} is on ${iso(e.held_on)}: record it once it has happened`);
    const meal = f.meal !== undefined ? cents(f.meal, 'meal') : e.meal_cents;
    return tx(db, async () => {
      await db.query('update events set status = $2, meal_cents = $3 where id = $1', [e.id, status, meal]);
      await log(db, actor, 'event-status', e.ref, `${status}${f.meal !== undefined ? `, food and drink ${money(meal, cur(e.country))} a head` : ''}`);
      const issues = await db.query('select rule, source from v_issues where ref = $1', [e.ref]);
      return { event: e.ref, status, food_per_head_cents: meal, currency: cur(e.country), issues };
    });
  },
  async 'record-tov'(db, [who], f) {
    const actor = actorOf(f);
    need(f, 'kind', 'amount', 'description');
    const h = await hcp(db, who);
    const kind = oneOf(String(f.kind), TOV_KINDS, 'kind');
    const amount = cents(f.amount, 'amount');
    if (amount <= 0) throw Error('--amount must be more than 0');
    const paid = pastDate(f.paid, 'paid');
    const e = f.event ? await event(db, f.event) : null;
    const paidTo = f['paid-to'] ? oneOf(String(f['paid-to']), ['hcp', 'third-party'], 'paid-to') : 'hcp';
    const notice = f.notice ? date(f.notice, 'notice') : null;
    if (h.country === 'AU') {
      if (!notice) throw Error(`--notice is required: the date ${h.name} was given notice that this will be disclosed. No transfer of value before that notice (Medicines Australia Code Ed. 20 s 14.1.6)`);
      if (notice > paid) throw Error(`Notice on ${notice} is after the payment on ${paid}: notice comes first (Medicines Australia Code Ed. 20 s 14.1.6)`);
    }
    return tx(db, async () => {
      const ref = await nextRef(db, 'transfers', 'T-', 4);
      await db.query(`insert into transfers (ref, hcp_id, event_id, kind, description, amount_cents, currency, paid_on, paid_to, prescription_related, identity_known, notice_given_on)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [ref, h.id, e?.id ?? null, kind, text(f.description), amount, cur(h.country), paid, paidTo, f['prescription-related'] === undefined ? true : flag(f['prescription-related']), f['identity-known'] === undefined ? true : flag(f['identity-known']), notice]);
      await log(db, actor, 'record-tov', ref, `${h.name}: ${kind} ${money(amount, cur(h.country))}`);
      const [r] = await db.query('select period_from, due_on from v_reportable where ref = $1', [ref]);
      return { transfer: ref, professional: h.name, amount_cents: amount, currency: cur(h.country), reportable: Boolean(r), period: r ? periodName(r.period_from) : null, report_due: r ? iso(r.due_on) : null };
    });
  },
  // Record that professionals were sent their transfers to review: one transfer, or every one for a professional in a period.
  async 'send-review'(db, [term], f) {
    const actor = actorOf(f);
    const on = pastDate(f.date, 'date');
    let rows;
    if (f.period) {
      const p = period(f.period);
      const h = term ? await hcp(db, term) : null;
      rows = await db.query('select ref, hcp from v_reportable where period_from = $1 and review_sent_on is null and ($2::uuid is null or hcp_id = $2)', [p, h?.id ?? null]);
    } else {
      const x = await transfer(db, term);
      if (x.review_sent_on) throw Error(`${x.ref} review was sent on ${iso(x.review_sent_on)}`);
      rows = [{ ref: x.ref, hcp: x.hcp }];
    }
    if (!rows.length) throw Error('No reportable transfers waiting for review there');
    return tx(db, async () => {
      for (const r of rows) await db.query('update transfers set review_sent_on = $2 where ref = $1', [r.ref, on]);
      await log(db, actor, 'send-review', rows.map((r) => r.ref).join(', '), `review sent on ${on}`);
      return { sent_on: on, review_ends: addDays(on, 42), transfers: rows };
    });
  },
  async 'submit-report'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'period');
    const p = period(f.period);
    const on = pastDate(f.date, 'date');
    const [v] = await db.query('select * from v_transparency where period_from = $1', [p]);
    if (!v) throw Error(`No reportable transfers in ${periodName(p)}`);
    if (v.submitted_on) throw Error(`${periodName(p)} was submitted on ${iso(v.submitted_on)}`);
    if (on <= iso(v.period_to)) throw Error(`${periodName(p)} has not ended yet`);
    const short = await db.query('select ref, hcp, review_sent_on from v_reportable where period_from = $1 and (review_sent_on is null or review_sent_on > $2::date - 42)', [p, on]);
    if (short.length && !flag(f['short-review'])) throw Error(`Professionals get at least six weeks to review their data before it goes (Medicines Australia Code Ed. 20 s 14.1.5). Not yet: ${short.map((s) => `${s.ref} ${s.hcp} (${s.review_sent_on ? `sent ${iso(s.review_sent_on)}` : 'not sent'})`).join('; ')}. Submit anyway with --short-review: it stays on the record as a breach.`);
    return tx(db, async () => {
      await db.query('insert into transparency_reports (period_from, submitted_on) values ($1,$2) on conflict (period_from) do update set submitted_on = excluded.submitted_on', [p, on]);
      await log(db, actor, 'submit-report', periodName(p), `submitted to Disclosure Australia on ${on}${short.length ? ` with ${short.length} short reviews` : ''}`);
      return { period: periodName(p), submitted_on: on, due_on: iso(v.due_on), on_time: on <= iso(v.due_on), declaration_due: addDays(on, 7) };
    });
  },
  async 'declare-report'(db, a, f) {
    const actor = actorOf(f);
    need(f, 'period');
    const p = period(f.period);
    const on = pastDate(f.date, 'date');
    const [r] = await db.query('select * from transparency_reports where period_from = $1', [p]);
    if (!r?.submitted_on) throw Error(`${periodName(p)} has not been submitted: record /submit-report first`);
    if (r.declaration_on) throw Error(`${periodName(p)} declaration was lodged on ${iso(r.declaration_on)}`);
    if (on < iso(r.submitted_on)) throw Error('The declaration cannot be before the submission');
    return tx(db, async () => {
      await db.query('update transparency_reports set declaration_on = $2 where id = $1', [r.id, on]);
      await log(db, actor, 'declare-report', periodName(p), `company declaration lodged ${on}`);
      return { period: periodName(p), declaration_on: on, within_seven_days: on <= addDays(iso(r.submitted_on), 7) };
    });
  },
  async set(db, [key, value], f) {
    const actor = actorOf(f);
    const allowed = ['cycle_days', 'short_dated_days', 'sample_deliver_days', 'quiet_days', 'licence_warn_days', 'hospitality_cap_cents_au'];
    if (!allowed.includes(key)) throw Error(`Setting must be one of: ${allowed.join(', ')}`);
    const n = int(value, key, { min: 1, max: 1000000 });
    return tx(db, async () => {
      await db.query('insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value', [key, String(n)]);
      await log(db, actor, 'set', key, String(n));
      return { key, value: n };
    });
  },
};

// ------------------------------------------------------------------ drafts

const fmtDate = (d) => (d ? new Date(`${iso(d)}T00:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const drafts = {
  async 'weekly-review'(db) {
    const att = await reads.attention(db);
    const cov = await reads.coverage(db, [], {});
    const due = await reads['follow-ups'](db, [], {});
    const lines = [`# Weekly field review, ${fmtDate(today())}`, '',
      `## Needs a person (${att.length})`, '', ...(att.length ? att.map((r) => `- **${r.item}** ${r.ref}: ${r.detail}`) : ['- Nothing.']), '',
      '## Coverage this cycle', '', '| Territory | Segment | Professionals | Target calls | Calls made | Reached | On target |', '|---|---|---|---|---|---|---|',
      ...cov.map((c) => `| ${c.territory} | ${c.segment} | ${c.professionals} | ${c.target_calls} | ${c.calls_made} | ${c.reach_pct}% | ${c.on_target_pct}% |`), '',
      `## Follow-ups open (${due.length})`, '', ...(due.length ? due.map((d) => `- ${iso(d.follow_up_on)} ${d.standing}: ${d.professional} (${d.rep}): ${d.next_step || 'follow up'}`) : ['- None.']), '',
      'Drafted from the field records. Check each line before acting on it.'];
    return { file: draftFile(`weekly-review-${today()}.md`, lines.join('\n') + '\n'), items: att.length };
  },
  async 'draft-follow-up'(db, [term]) {
    const c = await call_(db, term);
    const h = await hcp(db, c.hcp_id);
    if (!h.contact_ok) throw Error(`${h.name} has asked not to be contacted`);
    const [r] = await db.query('select * from reps where id = $1', [c.rep_id]);
    const prods = await db.query('select p.name || coalesce(\' \' || p.strength, \'\') as label from call_products cp join products p on p.id = cp.product_id where cp.call_id = $1', [c.id]);
    const body = [`To: ${h.email || '[email]'}`, `Subject: Following up from ${fmtDate(c.call_on)}`, '', `Dear ${h.name},`, '',
      `Thank you for your time on ${fmtDate(c.call_on)}${prods.length ? ` to talk about ${prods.map((p) => p.label).join(' and ')}` : ''}.`, '',
      c.next_step ? `As promised: ${c.next_step.replace(/\.\s*$/, '').replace(/^./, (x) => x.toLowerCase())}. [Attach or link only approved materials.]` : '[What you promised, in one line.]', '',
      'Kind regards,', r.name, '',
      '<!-- Draft, not sent. Use approved materials only; product claims go through your medical and compliance review. Record the follow-up done with /follow-up-done. -->'];
    return { file: draftFile(`follow-up-${c.ref}.md`, body.join('\n') + '\n'), professional: h.name };
  },
  // The data a professional reviews before the report goes (s 14.1.5): every reportable transfer to them in the period.
  async 'draft-review-letter'(db, [term], f) {
    need(f, 'period');
    const h = await hcp(db, term);
    const p = period(f.period);
    const rows = await db.query('select * from v_reportable where hcp_id = $1 and period_from = $2 order by paid_on', [h.id, p]);
    if (!rows.length) throw Error(`No reportable transfers to ${h.name} in ${periodName(p)}`);
    const due = iso(rows[0].due_on);
    const body = [`To: ${h.email || '[email]'}`, `Subject: Your payments from us, ${periodName(p)}: please review by ${fmtDate(addDays(today(), 42))}`, '', `Dear ${h.name},`, '',
      `As we told you before we made these payments, we report them to Disclosure Australia. Here is what we will report for ${fmtDate(p)} to ${fmtDate(periodTo(p))}. Please check it and tell us of any correction within six weeks.`, '',
      '| Date | Service | Event | Paid to | Registration | Travel and accommodation | Fees for service |', '|---|---|---|---|---|---|---|',
      ...rows.map((x) => `| ${fmtDate(x.paid_on)} | ${x.description} | ${x.event || ''} | ${x.paid_to === 'hcp' ? 'You' : 'A third party for you'} | ${x.kind === 'registration' ? money(x.amount_cents, x.currency) : ''} | ${['travel', 'accommodation'].includes(x.kind) ? money(x.amount_cents, x.currency) : ''} | ${!['registration', 'travel', 'accommodation'].includes(x.kind) ? money(x.amount_cents, x.currency) : ''} |`), '',
      `Your name, profession and principal practice address (${h.practice_address || '[address]'}) are reported with these amounts.`, '',
      'Kind regards,', '[your name]', '',
      `<!-- Draft, not sent. The report is due ${due}. Once sent, record it: /send-review ${h.code} --period=${periodName(p)} -->`];
    return { file: draftFile(`review-letter-${h.code}-${periodName(p)}.md`, body.join('\n') + '\n'), transfers: rows.length, report_due: due };
  },
  async 'draft-recall-letter'(db, [term]) {
    const l = await lot(db, term);
    if (!l.recalled_on) throw Error(`${l.lot_number} is not recalled`);
    const rows = await db.query('select s.*, h.email from v_samples s join hcps h on h.id = s.hcp_id where s.lot_id = $1 and s.status = $2 and s.recall_told_on is null', [l.id, 'delivered']);
    if (!rows.length) throw Error(`Every professional who received ${l.lot_number} has been told`);
    const files = rows.map((s) => draftFile(`recall-${l.lot_number}-${s.ref}.md`, [`To: ${s.email || '[email]'}`, `Subject: Recall of ${l.product_name} lot ${l.lot_number}`, '', `Dear ${s.hcp},`, '',
      `On ${fmtDate(s.delivered_on)} we supplied ${s.quantity} starter pack${s.quantity === 1 ? '' : 's'} of ${l.product_name}, lot ${l.lot_number}. That lot has been recalled. ${l.recall_note || ''}`.trim(), '',
      `Please set aside any packs from lot ${l.lot_number} that you still hold. ${s.rep} will collect them, or call us and we will arrange a courier.`, '',
      'Kind regards,', '[your name]', '', `<!-- Draft, not sent. Follow your recall procedure. Once told, record it: /recall-told ${s.ref} -->`].join('\n') + '\n'));
    return { lot: l.lot_number, letters: files.length, files };
  },
  // The comma-separated file for Disclosure Australia, with the fields s 14.1.3 lists.
  async 'transparency-report'(db, a, f) {
    need(f, 'period');
    const p = period(f.period);
    const rows = await db.query(`select coalesce(e.held_on, min(x.paid_on)) as event_date, x.hcp, x.profession, x.practice_address,
      string_agg(distinct x.description, '; ') as service, coalesce(e.title, '') as event, x.paid_to,
      sum(x.amount_cents) filter (where x.kind = 'registration')::int as registration, sum(x.amount_cents) filter (where x.kind in ('travel', 'accommodation'))::int as travel,
      sum(x.amount_cents) filter (where x.kind not in ('registration', 'travel', 'accommodation'))::int as fees, sum(x.amount_cents)::int as total
      from v_reportable x left join events e on e.id = x.event_id where x.period_from = $1
      group by x.hcp_id, x.hcp, x.profession, x.practice_address, x.event_id, e.held_on, e.title, x.paid_to, case when x.event_id is null then x.ref end order by 1, x.hcp`, [p]);
    if (!rows.length) throw Error(`No reportable transfers in ${periodName(p)}`);
    const d = (n) => (n ? (n / 100).toFixed(2) : '');
    const head = ['Date of event or service', 'Healthcare professional name', 'Type of healthcare professional', 'Principal practice address', 'Description of service', 'Description of event', 'Paid to', 'Registration fees (AUD)', 'Travel and accommodation (AUD)', 'Fees for service (AUD)', 'Total (AUD)'];
    const lines = [head, ...rows.map((r) => [iso(r.event_date), r.hcp, r.profession, r.practice_address || '', r.service, r.event, r.paid_to === 'hcp' ? 'Healthcare professional' : 'Third party', d(r.registration), d(r.travel), d(r.fees), d(r.total)])];
    const missing = rows.filter((r) => !r.practice_address).map((r) => r.hcp);
    return { file: draftFile(`transparency-${periodName(p)}.csv`, lines.map((l) => l.map(csvCell).join(',')).join('\n') + '\n'), rows: rows.length, due_on: iso(tov_due(p)),
      warning: missing.length ? `No principal practice address for ${[...new Set(missing)].join(', ')}: add one before submitting` : undefined,
      next: 'Check it against the current Disclosure Australia template, submit it, then record /submit-report' };
  },
};
const tov_due = (p) => (iso(p).slice(5, 7) === '01' ? `${iso(p).slice(0, 4)}-10-31` : `${Number(iso(p).slice(0, 4)) + 1}-04-30`);

// ------------------------------------------------------------------ import and export

// Column names Veeva CRM exports (Data Loader object fields, and report headings) typically carry,
// with plain alternatives. --map overrides any of them.
const MAPS = {
  accounts: { id: ['Id', 'Account ID', 'Account: ID'], name: ['Name', 'Account Name', 'Account: Account Name'], kind: ['Account Type', 'Type', 'RecordType.Name', 'Record Type'],
    address: ['Address_vod__c', 'Address Line 1', 'Address', 'Street'], city: ['City_vod__c', 'City'], state: ['State_vod__c', 'State'], postcode: ['Zip_vod__c', 'Postcode', 'Zip'],
    territory: ['Territory', 'Territory_vod__c', 'Territory Name'] },
  hcps: { id: ['Id', 'Account ID', 'Account: ID'], name: ['Name', 'Account Name', 'Full Name'], first: ['FirstName', 'First Name'], last: ['LastName', 'Last Name'],
    credentials: ['Credentials_vod__c', 'Credentials', 'Professional Type'], specialty: ['Specialty_1_vod__c', 'Specialty', 'Primary Specialty'],
    parent: ['Primary_Parent_vod__c', 'Primary Parent', 'Primary Parent ID'], email: ['PersonEmail', 'Email'], phone: ['Phone'], territory: ['Territory', 'Territory_vod__c', 'Territory Name'],
    segment: ['Segment', 'Tier', 'Target Segment'], registration: ['Account_Identifier_vod__c', 'Registration Number', 'AHPRA Number', 'MCNZ Number'] },
  calls: { id: ['Id', 'Call ID', 'Call: ID', 'Name'], account: ['Account_vod__c', 'Account ID', 'Account: ID'], date: ['Call_Date_vod__c', 'Call Date', 'Date'],
    rep: ['Owner Name', 'Owner', 'Assigned To', 'Created By'], channel: ['Call_Type_vod__c', 'Call Type', 'Channel'], status: ['Status_vod__c', 'Status'],
    products: ['Detailed_Products_vod__c', 'Products Detailed', 'Detailed Products', 'Product'], notes: ['Call_Comments_vod__c', 'Comments', 'Notes', 'Pre-Call Notes'], next: ['Next_Call_Notes_vod__c', 'Next Call Notes', 'Next Step'] },
  samples: { id: ['Id', 'Call Sample ID', 'Name'], account: ['Account_vod__c', 'Account ID', 'Account: ID'], date: ['Call_Date_vod__c', 'Call Date', 'Delivery Date', 'Date'],
    rep: ['Owner Name', 'Owner', 'Created By'], product: ['Product_vod__c', 'Product', 'Product Name'], lot: ['Lot_vod__c', 'Lot', 'Lot Number'], qty: ['Quantity_vod__c', 'Quantity'],
    expires: ['Expiration_Date_vod__c', 'Expiry', 'Expiration Date'], signed: ['Signature_Date_vod__c', 'Signature Date', 'Signed'], requested: ['Request Date', 'Requested', 'Sample Request Date'] },
};
function mapper(kind, mapFile) {
  const m = { ...MAPS[kind] };
  if (mapFile) for (const [k, v] of Object.entries(JSON.parse(readFileSync(path.resolve(mapFile), 'utf8')))) m[k] = Array.isArray(v) ? v : [v];
  return (row, key) => pick(row, ...(m[key] || []));
}
// Veeva exports dates as YYYY-MM-DD, sometimes with a time, and Australian reports as DD/MM/YYYY.
function looseDate(v, label) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return date(m[1], label);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, label);
  throw Error(`${label}: "${s}" is not a date`);
}
function professionOf(v) {
  const s = String(v || '').toLowerCase();
  if (/nurse practitioner|\bnp\b/.test(s)) return 'nurse-practitioner';
  if (/pharm/.test(s)) return 'pharmacist';
  if (/nurse|\brn\b/.test(s)) return 'nurse';
  if (/gp|general pract|family/.test(s)) return 'gp';
  if (/md|mbbs|dr|doctor|physician|specialist|fracp|fracs/.test(s)) return 'specialist';
  return 'other';
}
const channelOf = (v) => (/remote|video|virtual|engage/i.test(v || '') ? 'remote' : /phone/i.test(v || '') ? 'phone' : /group|event/i.test(v || '') ? 'group' : 'face-to-face');

async function importVeeva(db, args, f) {
  const [source, file] = args;
  if (source !== 'veeva') throw Error('Usage: import veeva <file.csv> --kind=accounts|hcps|calls|samples --actor="<name>" [--dry-run] [--map=map.json]');
  if (!file) throw Error('Name the CSV file');
  const actor = actorOf(f);
  const kind = oneOf(String(f.kind || ''), Object.keys(MAPS), 'kind');
  const get = mapper(kind, text(f.map));
  const rows = parseCsv(readFileSync(path.resolve(file), 'utf8'));
  const counts = { kind, rows: rows.length, added: 0, skipped: 0 };
  const terr = async (row) => {
    const t = get(row, 'territory');
    if (t) return territory(db, t);
    if (!f.territory) throw Error(`Row has no territory: add --territory=<code> for this file`);
    return territory(db, f.territory);
  };
  await db.exec('begin');
  try {
    for (const [i, row] of rows.entries()) {
      const at = `row ${i + 2}`;
      const ext = get(row, 'id');
      if (!ext) throw Error(`${at}: no Id`);
      if (kind === 'accounts') {
        if ((await db.query('select 1 from accounts where external_id = $1', [ext])).length) { counts.skipped++; continue; }
        const t = await terr(row);
        const k = String(get(row, 'kind') || '').toLowerCase();
        const akind = /hosp/.test(k) ? 'hospital' : /pharm/.test(k) ? 'pharmacy' : /clinic/.test(k) ? 'clinic' : 'practice';
        await db.query('insert into accounts (code, name, kind, territory_id, address, city, state, postcode, external_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [await nextCode(db, 'accounts', 'A-', 2), get(row, 'name') || ext, akind, t.id, get(row, 'address'), get(row, 'city'), get(row, 'state'), get(row, 'postcode'), ext]);
      } else if (kind === 'hcps') {
        if ((await db.query('select 1 from hcps where external_id = $1', [ext])).length) { counts.skipped++; continue; }
        const name = get(row, 'name') || [get(row, 'first'), get(row, 'last')].filter(Boolean).join(' ');
        if (!name) throw Error(`${at}: no name`);
        const parent = get(row, 'parent');
        const acc = parent ? (await db.query('select id, territory_id from accounts where external_id = $1', [parent]))[0] : null;
        const t = acc ? { id: acc.territory_id } : await terr(row);
        const prof = professionOf(`${get(row, 'credentials') || ''} ${get(row, 'specialty') || ''}`);
        const seg = String(get(row, 'segment') || 'B').trim().toUpperCase().slice(0, 1);
        const segment = ['A', 'B', 'C'].includes(seg) ? seg : 'B';
        await db.query(`insert into hcps (code, name, profession, specialty, prescriber, registration_number, account_id, territory_id, segment, target_calls, email, phone, external_id)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [await nextCode(db, 'hcps', 'H-'), name, prof, get(row, 'specialty'), ['gp', 'specialist', 'nurse-practitioner'].includes(prof), get(row, 'registration'), acc?.id ?? null, t.id, segment, { A: 2, B: 1, C: 0 }[segment], get(row, 'email'), get(row, 'phone'), ext]);
      } else if (kind === 'calls') {
        if ((await db.query('select 1 from calls where external_id = $1', [ext])).length) { counts.skipped++; continue; }
        if (/plan|sav|draft/i.test(get(row, 'status') || '')) { counts.skipped++; continue; }
        const [h] = await db.query('select id from hcps where external_id = $1', [get(row, 'account')]);
        if (!h) throw Error(`${at}: account ${get(row, 'account')} is not imported. Import hcps first.`);
        const r = await rep(db, get(row, 'rep') || f.rep);
        const ref = await nextRef(db, 'calls', 'C-', 4);
        const [c] = await db.query('insert into calls (ref, hcp_id, rep_id, call_on, channel, notes, next_step, external_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
          [ref, h.id, r.id, looseDate(get(row, 'date'), `${at} date`), channelOf(get(row, 'channel')), get(row, 'notes'), get(row, 'next'), ext]);
        for (const p of String(get(row, 'products') || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
          const [pr] = await db.query(`select id from products where lower(code) = lower($1) or lower(name) = lower($1) or lower(name || coalesce(' ' || strength, '')) = lower($1)`, [p]);
          if (pr) await db.query('insert into call_products (call_id, product_id) values ($1,$2) on conflict do nothing', [c.id, pr.id]);
        }
      } else {
        if ((await db.query('select 1 from samples where external_id = $1', [ext])).length) { counts.skipped++; continue; }
        const [h] = await db.query('select id from hcps where external_id = $1', [get(row, 'account')]);
        if (!h) throw Error(`${at}: account ${get(row, 'account')} is not imported. Import hcps first.`);
        const r = await rep(db, get(row, 'rep') || f.rep);
        const p = await product(db, get(row, 'product'));
        const lotNo = get(row, 'lot');
        if (!lotNo) throw Error(`${at}: no lot number`);
        let [l] = await db.query('select id from lots where product_id = $1 and lot_number = $2', [p.id, lotNo]);
        if (!l) {
          const exp = looseDate(get(row, 'expires'), `${at} expiry`);
          if (!exp) throw Error(`${at}: lot ${lotNo} is new and has no expiry. Add it with /add-lot first.`);
          [l] = await db.query('insert into lots (product_id, lot_number, expires_on) values ($1,$2,$3) returning id', [p.id, lotNo, exp]);
        }
        const on = looseDate(get(row, 'date'), `${at} date`);
        const req = looseDate(get(row, 'requested'), `${at} request date`);
        const ref = await nextRef(db, 'samples', 'S-', 4);
        const qty = int(get(row, 'qty'), `${at} quantity`, { min: 1 });
        const signed = get(row, 'signed') ? (looseDate(get(row, 'signed'), `${at} signature`) || on) : null;
        const [s] = await db.query(`insert into samples (ref, hcp_id, rep_id, product_id, quantity, request_kind, requested_on, status, delivered_on, lot_id, receipt_signed_on, external_id)
          values ($1,$2,$3,$4,$5,$6,$7,'delivered',$8,$9,$10,$11) returning id`, [ref, h.id, r.id, p.id, qty, req ? 'written' : 'none', req, on, l.id, signed, ext]);
        // History: the stock came and went before this system; record both sides so rep stock nets to zero.
        await db.query(`insert into stock_moves (ref, rep_id, lot_id, qty, kind, moved_on, note) values ($1,$2,$3,$4,'adjusted',$5,'Imported from Veeva CRM: stock before this system')`, [await nextRef(db, 'stock_moves', 'M-', 4), r.id, l.id, qty, on]);
        await db.query(`insert into stock_moves (ref, rep_id, lot_id, qty, kind, moved_on, sample_id) values ($1,$2,$3,$4,'issued',$5,$6)`, [await nextRef(db, 'stock_moves', 'M-', 4), r.id, l.id, -qty, on, s.id]);
      }
      counts.added++;
    }
    if (f['dry-run']) { await db.exec('rollback'); return { ...counts, dry_run: true, next: 'Run again without --dry-run to keep it' }; }
    await log(db, actor, 'import', `veeva-${kind}`, `${path.basename(file)}: ${counts.added} added, ${counts.skipped} skipped`);
    await db.exec('commit');
    return counts;
  } catch (err) {
    await db.exec('rollback');
    throw err;
  }
}

async function exportAll(db, args, f) {
  const tables = ['settings', 'territories', 'reps', 'products', 'accounts', 'hcps', 'calls', 'call_products', 'lots', 'samples', 'stock_moves', 'events', 'attendees', 'transfers', 'transparency_reports', 'activity'];
  const out = { exported_at: new Date().toISOString(), note: 'Personal information about health professionals. Keep this file as securely as the database.', tables: {} };
  for (const t of tables) out.tables[t] = await db.query(`select * from ${t}`);
  const file = path.resolve(f.out || path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports', `pharma-crm-${today()}.json`));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  return { file, rows: Object.fromEntries(tables.map((t) => [t, out.tables[t].length])) };
}

const all = { ...reads, ...writes, ...drafts, import: importVeeva, export: exportAll };
export const commands = Object.keys(all).sort();

export async function run(db, command, args = [], flags = {}) {
  const fn = all[command];
  if (!fn) throw Error(`Unknown command "${command}". Commands: ${commands.join(', ')}`);
  return fn(db, args, flags);
}
