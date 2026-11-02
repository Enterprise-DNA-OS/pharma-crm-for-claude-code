#!/usr/bin/env node
// The one CLI for the field force desk. Human tables by default, --json for machines.
//   node scripts/crm.mjs --help
import { getDb } from './lib/db.mjs';
import { run, commands } from './lib/domain.mjs';
import { table, price as money } from './lib/format.mjs';

const args = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) { args.push(a); continue; }
  const i = a.indexOf('=');
  const key = a.slice(2, i < 0 ? undefined : i);
  if (Object.hasOwn(flags, key)) { console.error(`Duplicate --${key}`); process.exit(1); }
  flags[key] = i < 0 ? true : a.slice(i + 1);
}
const command = args.shift();

const ALLOWED = ['account', 'actor', 'address', 'all', 'amount', 'channel', 'city', 'code', 'contact-ok', 'country', 'date', 'days', 'description', 'dry-run', 'education', 'email', 'entertainment', 'event', 'expires', 'follow-up', 'form', 'help', 'hcp', 'hours', 'identity-known', 'json', 'kind', 'licence', 'licence-expires', 'lot', 'map', 'meal', 'name', 'next-step', 'no', 'note', 'notes', 'notice', 'open', 'out', 'paid', 'paid-to', 'period', 'phone', 'postcode', 'prescriber', 'prescription-related', 'product', 'products', 'profession', 'qty', 'reason', 'registered', 'registration', 'rep', 'role', 'segment', 'short-review', 'signed', 'specialty', 'starter-packs', 'state', 'status', 'strength', 'takeaway', 'target', 'territory', 'title', 'upcoming', 'venue'];

// *_cents columns print as money in the row's currency; everything else as written.
function cell(v, key, row) {
  if (v === null || v === undefined) return '';
  if (key.endsWith('_cents')) return money(v, row.currency || 'AUD');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : s;
}
function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (value[0]?.question) return value.map((x, i) => `${i + 1}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => k !== 'currency' || !Object.keys(value[0]).some((x) => x.endsWith('_cents')));
    return table(value, keys.map((key) => ({ key, label: key.replace(/_cents$/, ''), align: key.endsWith('_cents') ? 'right' : 'left', width: 70, format: (v, row) => cell(v, key, row) })));
  }
  if (value && typeof value === 'object' && Object.values(value).some(Array.isArray)) {
    return Object.entries(value).map(([k, v]) => Array.isArray(v) ? `\n${k[0].toUpperCase()}${k.slice(1)}\n${human(v)}` : v && typeof v === 'object'
      ? Object.entries(v).filter(([kk, x]) => x !== null && x !== '' && !/(^id$|_id$|created_at|updated_at|external_id)/.test(kk)).map(([kk, x]) => `  ${kk}: ${cell(x, kk, v)}`).join('\n')
      : `  ${k}: ${cell(v, k, value)}`).join('\n');
  }
  return Object.entries(value || {}).filter(([, v]) => v !== undefined).map(([k, v]) => `  ${k}: ${cell(v, k, value)}`).join('\n');
}

if (!command || flags.help) {
  console.log(`Pharma field force desk. Commands: ${commands.join(', ')}.
Options use --key=value. Every write needs --actor="<your name>". Dates are YYYY-MM-DD; half-years are H1-2026 or H2-2026. See docs/cli.md.`);
} else {
  let db;
  try {
    for (const key of Object.keys(flags)) if (!ALLOWED.includes(key)) throw Error(`Unknown option --${key}`);
    db = await getDb();
    const result = await run(db, command, args, flags);
    console.log(flags.json ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
