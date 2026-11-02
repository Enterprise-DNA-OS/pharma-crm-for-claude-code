#!/usr/bin/env node
// npm test: a temporary database, the demo company, every command exercised, then cleaned up.
// Set TEST_DATABASE_URL to run the same checks against an empty Postgres database instead of PGlite.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, commands, QUESTIONS, cents, date, period, today } from './lib/domain.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'pharma-crm-test-'));
process.env.DATA_DIR = path.join(root, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = path.join(root, 'out');

let db;
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };
const fails = async (fn, re, msg) => { await assert.rejects(fn, re, msg); checks++; };
const call = (cmd, args = [], f = {}) => run(db, cmd, args, f);
const A = { actor: 'Test' };
const one = async (sql, p = []) => (await db.query(sql, p))[0];
const ago = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const ahead = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const issue = async (ref, rule) => one('select * from v_issues where ref = $1 and rule like $2', [ref, `%${rule}%`]);

try {
  db = await getDb();
  await migrate(db);
  eq((await migrate(db)).ran.length, 0, 'migrate twice is a no-op');
  await seed(db);
  await seed(db);
  eq((await one('select count(*)::int as n from hcps')).n, 18, 'seed is idempotent (professionals)');
  eq((await one('select count(*)::int as n from calls')).n, 25, 'seed is idempotent (calls)');
  eq((await one('select count(*)::int as n from samples')).n, 9, 'seed is idempotent (samples)');
  eq((await one('select count(*)::int as n from stock_moves')).n, 16, 'seed is idempotent (stock)');
  eq((await one('select count(*)::int as n from transfers')).n, 8, 'seed is idempotent (transfers)');
  eq((await one('select count(*)::int as n from activity')).n, 1, 'seed activity written once');

  // Every read runs.
  for (const cmd of Object.keys(reads)) {
    const a = { territory: ['SYD'], rep: ['Priya'], account: ['A-07'], hcp: ['Menon'], recall: ['G1187'], event: ['E-01'] }[cmd] || [];
    ok(await call(cmd, a, {}), `read ${cmd}`);
  }
  eq(QUESTIONS.length, 10, 'ten questions');
  const ins = await call('insights');
  ok(ins.every((q) => Array.isArray(q.rows)), 'every question returns rows');
  ok(ins[0].rows.some((r) => r.code === 'H-103'), 'A-segment not seen this cycle');
  ok(ins[5].rows.some((r) => r.rep === 'Priya Raman' && r.recalled === 10), 'recalled stock by rep');

  // Parsing is strict.
  eq(cents('1,450.00', 'x'), 145000);
  eq(cents('$98', 'x'), 9800);
  assert.throws(() => cents('12.345', 'x'), /amount/); checks++;
  assert.throws(() => date('2026-02-30', 'x'), /date/); checks++;
  eq(period('h1-2026'), '2026-01-01'); eq(period('H2-2025'), '2025-07-01');
  assert.throws(() => period('Q3-2026'), /half-year/); checks++;

  // The half-year due dates (s 14.4).
  const d = await one(`select tov_period_from('2026-03-15')::text as a, tov_period_from('2026-07-01')::text as b, tov_due_on('2026-01-01')::text as c, tov_due_on('2026-07-01')::text as e`);
  eq(d.a, '2026-01-01'); eq(d.b, '2026-07-01'); eq(d.c, '2026-10-31', 'H1 due 31 October'); eq(d.e, '2027-04-30', 'H2 due 30 April');

  // The seeded breaches, each with its rule.
  ok(await issue('S-0005', 'without a written request'), 'AU starter pack without a written request (s 6.1.5)');
  ok(await issue('S-0003', 'without prescribing rights'), 'NZ sample to a non-prescriber (s 4.18.1)');
  ok(await issue('S-0004', 'without a current licence'), 'NZ rep licence expired (s 4.18.5)');
  ok(await issue('S-0002', 'without a signed receipt'), 'NZ sample without receipt (s 4.18.6)');
  ok(await issue('S-0007', 'recalled lot not yet told'), 'recall: professional not told');
  ok(await issue('E-01', 'over the cap'), 'hospitality over the cap (s 4.5.3)');
  ok(await issue('E-03', 'takeaway'), 'NZ takeaway meal (s 4.8.2.2)');
  ok(await issue('T-0002', 'notice of disclosure'), 'payment before notice (s 14.1.6)');
  ok(!(await issue('T-0006', 'notice')), 'anonymous market research is not reportable');
  ok(!(await issue('T-0008', 'notice')), 'New Zealand payments are not in the Australian report');
  ok(!(await issue('S-0001', '')), 'a clean New Zealand sample has no issue');
  const att = await call('attention');
  ok(att[0].item.startsWith('breach:'), 'attention leads with breaches');
  ok(att.some((r) => r.item === 'starter packs waiting' && r.ref === 'S-0006'), 'starter pack waiting past 7 days');
  ok(att.some((r) => r.item === 'A-segment not seen this cycle' && r.ref === 'H-402'), 'A-segment not seen');
  ok(att.some((r) => r.item === 'short-dated stock' && r.ref === 'L2398'), 'short-dated stock');

  // Professionals and calls.
  const h = await call('add-hcp', [], { ...A, name: 'Dr Lena Fox', profession: 'gp', account: 'A-06', segment: 'A' });
  eq(h.professional, 'H-406', 'next code'); eq(h.target_calls, 2, 'segment A target'); eq(h.prescriber, true, 'a GP prescribes');
  const nurse = await call('add-hcp', [], { ...A, name: 'Sam Cole', profession: 'nurse', account: 'A-06' });
  eq(nurse.prescriber, false, 'a nurse does not prescribe by default');
  await fails(() => call('hcp', ['Dr']), /ambiguous/, 'ambiguous name lists candidates');
  await fails(() => call('log-call', ['Fox'], { rep: 'Priya' }), /--actor/, 'writes need an actor');
  const c = await call('log-call', ['Fox'], { ...A, rep: 'Priya', products: 'CRD10,glyzera 500 mg', notes: 'First detail', 'next-step': 'Bring the dosing card', 'follow-up': ahead(5) });
  eq(c.products.join(','), 'CRD10,GLY500', 'products matched by code and by name');
  const warn = await call('log-call', ['Fox'], { ...A, rep: 'Priya', products: 'PNT25' });
  ok(warn.warning.includes('not registered'), 'unregistered product discussed is flagged');
  await fails(() => call('log-call', ['Fox'], { ...A, rep: 'Priya', date: ahead(2) }), /future/, 'no calls in the future');
  await fails(() => call('log-call', ['Walker'], { ...A, rep: 'Luke' }), /retired/, 'no calls on a retired professional');
  eq((await call('follow-up-done', [c.call], A)).call, c.call);
  await fails(() => call('follow-up-done', [c.call], A), /was done/, 'follow-up done once');
  eq((await call('hcp', ['Fox'])).professional.cycle_calls, 2, 'calls count this cycle');
  const plan = await call('call-plan', [], { territory: 'SYD' });
  ok(plan.behind_target.some((r) => r.code === 'H-302') && plan.starter_packs_to_deliver.some((r) => r.ref === 'S-0006'), 'call plan');
  ok((await call('call-plan', [], { rep: 'Luke' })).behind_target.some((r) => r.code === 'H-402'), 'call plan by rep');
  ok((await call('coverage', [], { territory: 'SYD' })).every((r) => r.territory === 'SYD'), 'coverage by territory');

  // Starter packs: the gates.
  await fails(() => call('request-sample', ['Cole'], { ...A, product: 'CRD10', qty: 2, rep: 'Priya' }), /cannot prescribe/, 'non-prescriber refused');
  await fails(() => call('request-sample', ['Fox'], { ...A, product: 'PNT25', qty: 2, rep: 'Priya' }), /not registered/, 'unregistered product refused');
  await fails(() => call('request-sample', ['Fox'], { ...A, product: 'CRD20', qty: 2, rep: 'Priya' }), /no starter packs/, 'product without starter packs refused');
  const r1 = await call('request-sample', ['Fox'], { ...A, product: 'CRD10', qty: 3, rep: 'Priya', date: ago(1) });
  ok(r1.request_address.includes('Bondi Junction'), 'request address from the practice');
  await fails(() => call('deliver-sample', [r1.sample], { ...A, lot: 'G1187' }), /is Glyzera/, 'lot of another product refused');
  await fails(() => call('deliver-sample', [r1.sample], { ...A, lot: 'L2401', date: ago(2) }), /6\.1\.5/, 'delivery before the written request refused');
  await fails(() => call('deliver-sample', [r1.sample], { ...A, lot: 'L2398' }), /holds 0/, 'more than the rep holds refused');
  const del = await call('deliver-sample', [r1.sample], { ...A, lot: 'L2401', signed: true });
  eq(del.receipt_signed_on, today(), 'delivered and signed');
  eq((await one(`select on_hand from v_rep_stock where rep = 'Priya Raman' and lot_number = 'L2401'`)).on_hand, 13, 'stock issued');
  ok(!(await issue(r1.sample, '')), 'a good Australian delivery has no issue');
  await fails(() => call('deliver-sample', [r1.sample], { ...A, lot: 'L2401' }), /delivered/, 'delivered once');
  await fails(() => call('deliver-sample', ['S-0006'], { ...A, lot: 'G1187' }), /recalled/, 'recalled lot refused');
  // New Zealand: the licence and the receipt.
  const r2 = await call('request-sample', ['Henare'], { ...A, product: 'RSP100', qty: 2, rep: 'Kate' });
  await fails(() => call('deliver-sample', [r2.sample], { ...A, lot: 'R3420' }), /4\.18\.5/, 'NZ rep with an expired licence refused');
  await call('rep-status', ['Kate'], { ...A, 'licence-expires': ahead(300) });
  const d2 = await call('deliver-sample', [r2.sample], { ...A, lot: 'R3420' });
  ok(d2.warning.includes('4.18.6'), 'NZ delivery without a signature is warned');
  ok(await issue(r2.sample, 'signed receipt'), 'and shows as a breach');
  await fails(() => call('sign-receipt', [r2.sample], { ...A, date: ago(3) }), /before delivery/, 'no receipt before delivery');
  await call('sign-receipt', [r2.sample], A);
  ok(!(await issue(r2.sample, 'signed receipt')), 'signed receipt clears it');
  const r3 = await call('request-sample', ['Shah'], { ...A, product: 'CRD10', qty: 1, rep: 'Aroha' });
  eq((await call('cancel-sample', [r3.sample], { ...A, reason: 'Doctor changed her mind' })).status, 'cancelled');
  await fails(() => call('cancel-sample', ['S-0001'], { ...A, reason: 'x' }), /only a request/, 'delivered cannot be cancelled');

  // Stock and recalls.
  await fails(() => call('move-stock', [], { ...A, rep: 'Luke', lot: 'R3301', qty: 5, kind: 'received' }), /expired/, 'expired lot cannot go out');
  await fails(() => call('move-stock', [], { ...A, rep: 'Aroha', lot: 'G1187', qty: 5, kind: 'received' }), /recalled/, 'recalled lot cannot go out');
  await fails(() => call('move-stock', [], { ...A, rep: 'Luke', lot: 'R3301', qty: 8, kind: 'destroyed' }), /holds 7/, 'stock cannot go negative');
  eq((await call('move-stock', [], { ...A, rep: 'Luke', lot: 'R3301', qty: 7, kind: 'destroyed', note: 'Expired, destroyed under witness' })).on_hand, 0, 'expired stock destroyed');
  ok(!(await issue('R3301', 'expired sample stock')), 'expired stock cleared');
  await fails(() => call('move-stock', [], { ...A, rep: 'Luke', lot: 'R3420', qty: -1, kind: 'adjusted' }), /--note/, 'an adjustment needs a note');
  await call('move-stock', [], { ...A, rep: 'Aroha', lot: 'G1187', qty: 8, kind: 'returned' });
  await call('move-stock', [], { ...A, rep: 'Priya', lot: 'G1187', qty: 10, kind: 'returned' });
  ok(!(await issue('G1187', 'still in a rep')), 'recalled stock returned');
  const letters = await call('draft-recall-letter', ['G1187']);
  eq(letters.letters, 2, 'one recall letter per professional not told');
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, letters.files[0]), 'utf8').includes('G1187'), 'recall letter names the lot');
  await call('recall-told', ['S-0002'], A); await call('recall-told', ['S-0007'], A);
  await fails(() => call('draft-recall-letter', ['G1187']), /has been told/, 'nobody left to tell');
  await fails(() => call('recall-told', ['S-0001'], A), /not from a recalled lot/, 'only recalled lots');
  await call('add-lot', [], { ...A, product: 'GLY500', lot: 'G1240', expires: ahead(400) });
  await call('move-stock', [], { ...A, rep: 'Priya', lot: 'G1240', qty: 12, kind: 'received' });
  await call('deliver-sample', ['S-0006'], { ...A, lot: 'G1240', signed: true });
  const rc = await call('recall-lot', ['L2398'], { ...A, note: 'Packaging fault' });
  ok(rc.given_to.some((x) => x.ref === 'S-0003') && rc.still_with_reps.some((x) => x.rep === 'Aroha Ngata'), 'a new recall lists who got it and who holds it');
  await fails(() => call('recall-lot', ['L2398'], { ...A, note: 'again' }), /was recalled/, 'recalled once');

  // Events and hospitality.
  await fails(() => call('add-event', [], { ...A, title: 'Dinner', kind: 'dinner-meeting', territory: 'SYD', date: ahead(10), education: 'Talk', meal: '145.00' }), /over the cap/, 'Australian meal over the cap refused');
  await fails(() => call('add-event', [], { ...A, title: 'Lunch', kind: 'company-meeting', territory: 'AKL', date: ahead(10), education: 'Update', takeaway: true }), /4\.8\.2\.2/, 'NZ takeaway refused');
  await fails(() => call('add-event', [], { ...A, title: 'Golf day', kind: 'company-meeting', territory: 'MEL', date: ahead(10), education: 'Update', entertainment: true }), /entertainment/, 'entertainment refused');
  await fails(() => call('add-event', [], { ...A, title: 'Dinner', kind: 'dinner-meeting', territory: 'MEL', date: ahead(10), meal: '60' }), /education/, 'education required');
  const ev = await call('add-event', [], { ...A, title: 'Diabetes update', kind: 'dinner-meeting', territory: 'SYD', date: ahead(10), education: 'One-hour talk on starting therapy', meal: '120.00' });
  await call('invite', [ev.event, 'Fox'], A);
  const inv = await call('invite', [ev.event, 'Nguyen'], { ...A, role: 'speaker' });
  ok(inv.note.includes('14.1.6'), 'inviting an Australian speaker reminds of notice');
  await fails(() => call('attended', [ev.event, 'Fox'], A), /not happened/, 'no attendance before the event');
  await fails(() => call('event-status', [ev.event], { ...A, status: 'held' }), /record it once/, 'not held before the date');
  await call('attended', ['E-01', 'Brooks'], { ...A, no: true });
  await fails(() => call('attended', ['E-01', 'Shah'], A), /not invited/, 'only invited professionals');
  const held = await call('event-status', ['E-02'], { ...A, status: 'held', meal: '150.00' });
  ok(held.issues.some((x) => x.rule === 'hospitality over the cap'), 'the real figure is kept and the breach shows');
  await call('set', ['hospitality_cap_cents_au', '16000'], A);
  ok(!(await issue('E-02', 'over the cap')), 'the cap is a setting');
  await call('set', ['hospitality_cap_cents_au', '14000'], A);
  await fails(() => call('set', ['bogus', '1'], A), /Setting must be/, 'unknown setting refused');

  // Transfers of value and the report.
  await fails(() => call('record-tov', ['Fox'], { ...A, kind: 'speaker-fee', amount: '900', description: 'Talk' }), /--notice is required/, 'no Australian payment without notice');
  await fails(() => call('record-tov', ['Fox'], { ...A, kind: 'speaker-fee', amount: '900', description: 'Talk', paid: ago(5), notice: ago(2) }), /after the payment/, 'notice after payment refused');
  const t1 = await call('record-tov', ['Fox'], { ...A, kind: 'consultancy', amount: '900', description: 'Review of a patient leaflet', paid: ago(5), notice: ago(20) });
  ok(t1.reportable && /^H[12]-\d{4}$/.test(t1.period), 'reportable, with its half-year');
  const nz = await call('record-tov', ['Shah'], { ...A, kind: 'speaker-fee', amount: '500', description: 'Talk' });
  eq(nz.reportable, false, 'New Zealand payment recorded, not reported'); eq(nz.currency, 'NZD');
  // A closed half-year with a clean run: notice, review, submit, declare.
  await db.query(`insert into transfers (ref, hcp_id, kind, description, amount_cents, currency, paid_on, notice_given_on) select 'T-9001', id, 'advisory-board', 'Advisory board', 200000, 'AUD', '2024-03-10', '2024-02-01' from hcps where code = 'H-302'`);
  await fails(() => call('submit-report', [], { ...A, period: 'H1-2024', date: '2024-10-20' }), /six weeks/, 'no submission before six weeks of review');
  ok(await issue('T-9001', 'less than six weeks'), 'unsent review on an overdue report is a breach');
  ok(await issue('H1-2024', 'transparency report'), 'report overdue');
  await call('send-review', [], { ...A, period: 'H1-2024', date: '2024-08-01' });
  await fails(() => call('send-review', ['T-9001'], A), /was sent/, 'review sent once');
  const sub = await call('submit-report', [], { ...A, period: 'H1-2024', date: '2024-10-20' });
  eq(sub.on_time, true, 'submitted by 31 October'); eq(sub.declaration_due, '2024-10-27');
  ok(await issue('H1-2024', 'declaration'), 'declaration due after submission');
  await fails(() => call('submit-report', [], { ...A, period: 'H1-2024' }), /was submitted/, 'submitted once');
  eq((await call('declare-report', [], { ...A, period: 'H1-2024', date: '2024-10-29' })).within_seven_days, false, 'late declaration recorded as late');
  ok(await issue('H1-2024', 'declaration'), 'and stays a breach');
  await fails(() => call('declare-report', [], { ...A, period: 'H2-2024' }), /not been submitted/, 'declare only after submitting');
  ok(!(await issue('T-9001', '')), 'a reviewed, submitted transfer is clean');
  // Submitting with a short review stays on the record.
  await db.query(`insert into transfers (ref, hcp_id, kind, description, amount_cents, currency, paid_on, notice_given_on) select 'T-9002', id, 'speaker-fee', 'Talk', 100000, 'AUD', '2024-09-10', '2024-09-01' from hcps where code = 'H-301'`);
  await call('send-review', ['T-9002'], { ...A, date: '2025-04-01' });
  await call('submit-report', [], { ...A, period: 'H2-2024', date: '2025-04-20', 'short-review': true });
  ok(await issue('T-9002', 'before the professional had six weeks'), 'short review stays a breach');
  const rl = await call('draft-review-letter', ['Menon'], { period: 'H1-2024' });
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, rl.file), 'utf8').includes('30 June 2024'), 'review letter names the period');
  await fails(() => call('draft-review-letter', ['Shah'], { period: 'H1-2024' }), /No reportable/, 'no letter without reportable transfers');
  const rep_ = await call('transparency-report', [], { period: 'H1-2026' });
  const csv = readFileSync(path.join(process.env.OUTPUT_DIR, rep_.file), 'utf8');
  ok(csv.startsWith('Date of event or service,Healthcare professional name,Type of healthcare professional,Principal practice address'), 'transparency file has the s 14.1.3 fields');
  ok(csv.includes('Third party') && csv.includes('950.00'), 'registration paid to a third party in its own column');
  ok(!csv.includes('Market'), 'unknown-identity market research left out');
  eq((await call('transparency')).find((r) => r.period === 'H1-2024').standing, 'declared', 'transparency standing');
  ok((await call('transfers', [], { period: 'H1-2024' })).every((r) => r.reportable), 'transfers by period');

  // Drafts.
  const wr = await call('weekly-review');
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, wr.file), 'utf8').includes('## Coverage this cycle'), 'weekly review');
  const fu = await call('draft-follow-up', ['C-0013']);
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, fu.file), 'utf8').includes('advisory board agreement'), 'follow-up draft');
  await call('hcp-status', ['Menon'], { ...A, 'contact-ok': 'no' });
  await fails(() => call('draft-follow-up', ['C-0013']), /not to be contacted/, 'no draft to someone who opted out');

  // Records are kept; the log is append-only.
  await fails(() => db.query(`delete from samples where ref = 'S-0001'`), /kept/, 'samples cannot be deleted');
  await fails(() => db.query(`update stock_moves set qty = 1 where ref = 'M-0001'`), /kept/, 'stock movements cannot be rewritten');
  await fails(() => db.query(`delete from calls where ref = 'C-0001'`), /kept/, 'calls cannot be deleted');
  await fails(() => db.query(`delete from transfers where ref = 'T-0001'`), /kept/, 'transfers cannot be deleted');
  await fails(() => db.query('delete from activity'), /append-only/, 'activity is append-only');
  await fails(() => db.query(`insert into samples (ref, hcp_id, rep_id, product_id, quantity, status) select 'S-9999', h.id, r.id, p.id, 1, 'delivered' from hcps h, reps r, products p limit 1`), /check/i, 'a delivered sample needs a date and a lot');
  ok((await call('activity', [], { days: 1 })).length > 30, 'every write logged');

  // Import from Veeva CRM.
  const ex = (f) => path.join(REPO_ROOT, 'examples', 'veeva', f);
  const dry = await call('import', ['veeva', ex('accounts.csv')], { ...A, kind: 'accounts', 'dry-run': true });
  eq(dry.added, 2); eq((await one(`select count(*)::int as n from accounts where external_id is not null`)).n, 0, 'dry run keeps nothing');
  eq((await call('import', ['veeva', ex('accounts.csv')], { ...A, kind: 'accounts' })).added, 2);
  eq((await call('import', ['veeva', ex('accounts.csv')], { ...A, kind: 'accounts' })).skipped, 2, 'repeat rows skipped');
  eq((await call('import', ['veeva', ex('hcps.csv')], { ...A, kind: 'hcps' })).added, 3);
  const dunn = await call('hcp', ['Dunn']);
  eq(dunn.professional.profession, 'gp'); eq(dunn.professional.segment, 'A'); eq(dunn.professional.account, 'Newtown Family Practice');
  eq((await call('hcp', ['Ross'])).professional.prescriber, false, 'a nurse imports as not a prescriber');
  const ic = await call('import', ['veeva', ex('calls.csv')], { ...A, kind: 'calls' });
  eq(ic.added, 2, 'submitted calls in'); eq(ic.skipped, 1, 'planned call skipped');
  const patel = await call('hcp', ['Patel']);
  ok(patel.calls[0].products.includes('GLY500') && patel.calls[0].call_on && String(patel.calls[0].call_on instanceof Date ? patel.calls[0].call_on.toISOString() : patel.calls[0].call_on).startsWith('2026-09-15'), 'Australian date format and products by code and name');
  eq((await call('import', ['veeva', ex('samples.csv')], { ...A, kind: 'samples' })).added, 1);
  eq((await call('hcp', ['Patel'])).samples[0].lot_number, 'G1150', 'new lot created from the export');
  eq((await one(`select coalesce(sum(qty), 0)::int as n from stock_moves m join lots l on l.id = m.lot_id where l.lot_number = 'G1150'`)).n, 0, 'imported samples net to zero stock');
  const bad = path.join(root, 'bad.csv');
  writeFileSync(bad, 'Id,Account_vod__c,Call_Date_vod__c,Owner Name\nx1,001VA0000PeR01,2026-09-20,Priya Raman\nx2,NOPE,2026-09-21,Priya Raman\n');
  await fails(() => call('import', ['veeva', bad], { ...A, kind: 'calls' }), /not imported/, 'unknown account stops the file');
  eq((await one(`select count(*)::int as n from calls where external_id = 'x1'`)).n, 0, 'one bad row rolls back the file');
  const mapped = path.join(root, 'mapped.csv');
  writeFileSync(mapped, 'Ref,Doctor,When,Rep\nm1,001VA0000PeR02,2026-10-01,Priya Raman\n');
  const mapFile = path.join(root, 'map.json');
  writeFileSync(mapFile, JSON.stringify({ id: 'Ref', account: 'Doctor', date: 'When', rep: 'Rep' }));
  eq((await call('import', ['veeva', mapped], { ...A, kind: 'calls', map: mapFile })).added, 1, '--map reads other headings');
  await fails(() => call('import', ['salesforce', bad], { ...A, kind: 'calls' }), /Usage/, 'only veeva');

  // Export.
  const exp = await call('export', [], {});
  ok(existsSync(exp.file) && exp.rows.samples >= 12, 'export');

  // Setup writes.
  eq((await call('add-territory', [], { ...A, code: 'bne', name: 'Brisbane', country: 'au', state: 'qld' })).territory, 'BNE');
  await fails(() => call('add-territory', [], { ...A, code: 'WLG', name: 'Wellington', country: 'NZ', state: 'NSW' }), /no state/, 'NZ has no state');
  const nr = await call('add-rep', [], { ...A, name: 'Tom Lee', territory: 'BNE' });
  eq(nr.rep, 'R-05');
  const nzr = await call('add-rep', [], { ...A, name: 'Hemi Parata', territory: 'AKL' });
  ok(nzr.note.includes('4.18.5'), 'NZ rep without a licence is warned');
  eq((await call('add-product', [], { ...A, code: 'inh2', name: 'Respiflo', strength: '200 mcg', 'starter-packs': true })).product, 'INH2');
  await fails(() => call('add-product', [], { ...A, code: 'X1', name: 'X', registered: 'no', 'starter-packs': true }), /unregistered/, 'no starter packs for unregistered');
  eq((await call('add-account', [], { ...A, name: 'Chermside Medical', territory: 'BNE', city: 'Chermside' })).account, 'A-13');
  eq((await call('hcp-status', ['Fox'], { ...A, status: 'moved', account: 'Chermside' })).territory, 'BNE', 'moving practice moves territory');

  // The CLI.
  const env = { ...process.env };
  const cli = (a) => spawnSync(process.execPath, ['scripts/crm.mjs', ...a], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  const hh = cli(['--help']);
  eq(hh.status, 0); ok(hh.stdout.includes('deliver-sample'), 'help lists commands');
  const j = cli(['compliance', '--json']);
  eq(j.status, 0); ok(Array.isArray(JSON.parse(j.stdout)), 'json output');
  const t = cli(['attention']);
  eq(t.status, 0); ok(t.stdout.includes('breach: hospitality over the cap'), 'human output');
  const w = cli(['log-call', 'Karimi', '--rep=Luke', '--products=RSP100', '--actor=Test']);
  eq(w.status, 0, w.stderr); ok(w.stdout.includes('C-00'), 'a write through the CLI');
  const u = cli(['attention', '--bogus']);
  eq(u.status, 1); ok(u.stderr.includes('Unknown option'), 'unknown option refused');
  const dup = cli(['calls', '--days=1', '--days=2']);
  eq(dup.status, 1, 'duplicate option refused');
  const v = spawnSync(process.execPath, ['scripts/view.mjs'], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  eq(v.status, 0, v.stderr);
  const views = JSON.parse(readFileSync(path.join(REPO_ROOT, 'views.json'), 'utf8'));
  for (const vw of views) ok(existsSync(path.join(process.env.OUTPUT_DIR, 'views', `${vw.name}.html`)), `view ${vw.name}`);
  const page = readFileSync(path.join(process.env.OUTPUT_DIR, 'views', 'week.html'), 'utf8');
  ok(!page.includes('TODO') && page.includes('Needs attention') && page.includes('E-01'), 'week view rendered');
  const dd = spawnSync(process.execPath, ['scripts/docs.mjs'], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  eq(dd.status, 0, dd.stderr);
  const docs = JSON.parse(readFileSync(path.join(REPO_ROOT, 'documents.json'), 'utf8'));
  for (const doc of docs) ok(readdirSync(path.join(process.env.OUTPUT_DIR, 'docs-out', doc.name)).length > 0, `document ${doc.name}`);
  const { page: renderPage, table: renderTable } = await import('./lib/render.mjs');
  const html = renderPage({ title: 'T', subtitle: '<script>alert(1)</script>', sections: [{ title: 'S', html: renderTable([{ name: '<b>x</b>' }]) }] });
  ok(!html.includes('<script>alert') && html.includes('&lt;script&gt;'), 'HTML is escaped');

  // Every command has a recipe, and every recipe names a real command.
  const recipes = readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => f.replace(/\.md$/, ''));
  const special = ['customise', 'new-view', 'view', 'documents'];
  for (const cmd of commands) ok(recipes.includes(cmd), `/${cmd} has a recipe`);
  for (const r of recipes) ok(commands.includes(r) || special.includes(r), `/${r} drives a real command`);
  const claude = readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  for (const r of recipes) ok(claude.includes(`/${r}\``), `CLAUDE.md routes /${r}`);
  ok(!claude.includes('TODO(author)') && !readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8').includes('TODO(author)'), 'no TODO(author) left');

  console.log(`PASS: ${checks} checks (${db.mode})`);
} finally {
  await db?.close();
  rmSync(root, { recursive: true, force: true });
}
