<h1 align="center">Pharma CRM for Claude Code</h1>

<p align="center">
  <strong>The open-source pharma and medtech field CRM that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Veeva CRM data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=veeva-crm">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/veeva-crm?utm_source=github&utm_medium=readme&utm_campaign=veeva-crm">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-veeva-crm">Instead of Veeva CRM</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Pharma CRM for Claude Code does the job you pay Veeva CRM for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Veeva CRM dashboard cannot.

Veeva publishes no price for Veeva CRM or Vault CRM: it is sold per named user per year on a private quote, with an implementation partner on top. And every company on Veeva CRM has to move. Veeva ends support for Veeva CRM on the Salesforce platform on 31 December 2029 and moves customers to Vault CRM ([Veeva investor news, 2026](https://ir.veeva.com/news/news-details/2026/More-Than-125-Customers-Worldwide-Live-on-Vault-CRM-as-Veeva-Accelerates-the-Industrys-Agentic-Transformation/default.aspx), checked 2 November 2026). A forced move is the moment to ask what you are paying for. Here the database is yours, and another rep costs nothing.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=veeva-crm).

It covers a prescription medicines, generics or medtech field force in New Zealand and Australia: territories and reps, practices and hospitals, healthcare professionals with their segment and call target, calls and the products detailed, the weekly call plan, starter pack requests and deliveries, sample lots and the stock in every rep's car, recalls, events and who came, and the payments and transfers of value that go to Disclosure Australia every half-year. The Medicines Australia Code of Conduct (Edition 20) and the Medicines New Zealand Code of Practice (Edition 17) are built in: a written request before any starter pack (s 6.1.5), samples to prescribers only (NZ s 4.18.1), a rep on a current licence (NZ s 4.18.5), a signed receipt (NZ s 4.18.6), every lot traceable for a recall (NZ s 4.18.7), food and drink under the A$140 a head cap (s 4.5.3 and the Code Tool Kit), no takeaway meals (NZ s 4.8.2.2), notice of disclosure before any payment (s 14.1.6), six weeks for each professional to review their data (s 14.1.5), and the report due 31 October and 30 April (s 14.4).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/pharma-crm-for-claude-code.git
cd pharma-crm-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Try `/call-plan SYD`, `/recall G1187` and `/insights` next.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Code breaches first, then recalls to finish, reviews and reports due, starter packs waiting, licences running out, short-dated stock, overdue follow-ups and A-segment professionals not seen this cycle |
| `/call-plan` | The rep's week for a territory: who is behind target, follow-ups due, starter packs to deliver, events coming |
| `/coverage` | Reach and frequency against the call plan, by territory and segment |
| `/log-call` | A call, the products detailed, the next step and the follow-up date. Warns when an unregistered product came up |
| `/request-sample` and `/deliver-sample` | A written starter pack request, then delivery from a named lot. Refuses non-prescribers, delivery before the request, recalled or expired lots, a New Zealand rep without a current licence, and more than the rep holds |
| `/sign-receipt` | The prescriber's signed receipt (New Zealand s 4.18.6) |
| `/rep-stock` and `/move-stock` | The stock in every rep's hands by lot, and every movement: received, returned, destroyed, adjusted |
| `/recall-lot` and `/recall` | A lot recalled: every professional who received it and every rep still holding it |
| `/add-event` and `/event-status` | An event with its education and food and drink a head. Refuses entertainment, takeaway meals in New Zealand and food over the Australian cap |
| `/record-tov` | A payment or transfer of value. Refuses one made before notice of disclosure (s 14.1.6) |
| `/send-review`, `/submit-report` and `/declare-report` | The six-week review, the half-year submission to Disclosure Australia and the company declaration |
| `/transparency` and `/compliance` | Where each report stands, and every Code check with its section |
| `/weekly-review` | The Monday field review, written to `drafts/` |
| `/draft-follow-up` | The follow-up email after a call, from approved materials |
| `/draft-review-letter` | A professional's transfers for the half-year, to review before the report |
| `/draft-recall-letter` | One recall letter for every professional who received the lot |
| `/transparency-report` | The half-year's report as a comma-separated file, with the fields s 14.1.3 lists |
| `/insights` | The ten questions below |

The working commands: `/add-territory`, `/add-rep`, `/rep-status`, `/add-product`, `/add-account`, `/add-hcp`, `/hcp-status`, `/follow-up-done`, `/add-lot`, `/cancel-sample`, `/recall-told`, `/invite`, `/attended`, `/set`. The reads: `/territories`, `/territory`, `/reps`, `/rep`, `/products`, `/accounts`, `/account`, `/hcps`, `/hcp`, `/calls`, `/follow-ups`, `/samples`, `/lots`, `/events`, `/event`, `/transfers`, `/activity`, `/settings`. Plus `/import`, `/export`, `/view`, `/documents`, `/new-view` and `/customise`. 63 commands in all; [docs/cli.md](docs/cli.md) lists every one.

Names match case-insensitively. A professional can be found by code, full name, surname or registration number. A partial name works when it is unique; when it is not, the command lists the candidates and stops.

## The gates

- A starter pack goes only after a written request with the name and address of the person supplied and the name, strength and quantity (Medicines Australia Code Ed. 20 s 6.1.5), and the delivery record is kept (s 6.1.6: at least two years; here it cannot be deleted).
- In New Zealand, samples go only to prescribers (Medicines NZ Code Ed. 17 s 4.18.1), only for registered medicines (s 4.18.3), only from a rep holding a hawker's licence or nominated on the company's licence (s 4.18.5), with a signed receipt (s 4.18.6), and from a lot that a recall can reach (s 4.18.7).
- A recalled or expired lot cannot go out to a rep or a prescriber. A recall lists every professional who received the lot until each is recorded as told, and every rep still holding it.
- Food and drink at an Australian event stays under the cap in the Code Tool Kit: A$140 a head a meal, excluding gratuities and GST (s 4.5.3). No entertainment (s 4.5.5, NZ s 4.8.3.1). No takeaway meals in New Zealand (s 4.8.2.2). Education first: an event needs its education recorded.
- No payment or transfer of value to an Australian professional before they have been told it will be disclosed (s 14.1.6). Each professional gets at least six weeks to review their data (s 14.1.5). The report for January to June is due 31 October and for July to December 30 April (s 14.4), with the company declaration within seven days.
- Calls, samples, stock movements, attendance and payments cannot be deleted, and the activity log cannot be rewritten.

The software records and checks; the company's medical, regulatory and compliance people decide. It is not legal or regulatory advice, and it sends nothing.

## Ten questions answered from your records

`/insights` runs all ten today.

1. Which A-segment professionals have not been seen this cycle, by territory?
2. How does reach and frequency compare with the plan, by territory and segment?
3. Which products were detailed most in the last 90 days, by specialty?
4. Which prescribers took starter packs and have had no call since?
5. How many days from a starter pack request to delivery, by rep?
6. How much sample stock is short-dated, expired or recalled, by rep?
7. Who received the most in transfers of value in the last 12 months, and for what?
8. What did each event cost per professional who came, against the hospitality cap?
9. Which A and B professionals have gone quiet after being seen before?
10. Which practices have several prescribers but only one of them seen this cycle?

## Your first hour: ten things to ask for

1. What needs my attention today?
2. Plan Priya's week in Sydney.
3. Lot G1187 has been recalled. Who got it, and who still has it in their car?
4. Draft the recall letters for G1187.
5. Dr Hannah Lee is still waiting for her Glyzera starter packs. What can Priya deliver them from?
6. I saw Dr Raj Menon today about Cardovex; he wants the advisory board agreement. Log it with a follow-up for Friday.
7. Which specialists have we not seen in eight weeks?
8. What do we owe Disclosure Australia, and who still needs their review letter?
9. The asthma dinner in Christchurch came in at $72 a head. Record it as held.
10. Add a field for the key account manager on every hospital through `/customise`.

## Verification

`npm test` runs every command on a temporary database with the demo company: migrations, repeatable seed data, the written request before supply, prescribers only, the rep licence, signed receipts, recalled and expired lots refused, stock that cannot go negative, recalls and who was told, the hospitality cap, takeaway meals and entertainment refused, notice of disclosure before payment, the six-week review, the half-year due dates, submission and declaration, the transparency file, Veeva CRM imports with dry run, repeats and rollback, drafts, export, the append-only activity log, records that cannot be deleted, views, documents and escaped HTML. Set `TEST_DATABASE_URL` to run the same checks on an empty Postgres database.

Read the [operating rules](CLAUDE.md), the [rules and sources](docs/compliance.md), the [selection evidence](docs/research.md) and [why there is no front end](docs/why-no-front-end.md).

## Instead of Veeva CRM

Export your accounts, professionals, calls and call samples from Veeva CRM (Data Loader or reports) as comma-separated files, then import them in that order, dry run first:

```bash
node scripts/crm.mjs import veeva accounts.csv --kind=accounts --territory=SYD --actor="Your name" --dry-run
node scripts/crm.mjs import veeva hcps.csv --kind=hcps --actor="Your name" --dry-run
node scripts/crm.mjs import veeva calls.csv --kind=calls --actor="Your name" --dry-run
node scripts/crm.mjs import veeva samples.csv --kind=samples --actor="Your name" --dry-run
```

The [switching guide](docs/replace-veeva-crm.md) covers the headings it reads, `--map` for files with other headings, what comes across and what does not. Imports are atomic: repeat rows are skipped and one bad row stops the whole file.

## Architecture

```
pharma-crm-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  views.json                the read-only dashboards (npm run view)
  documents.json            the records the Code asks for (npm run docs)
  docs/                     the rules and sources, the thesis and the switching guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Pharma CRM for Claude Code for your business, migrates your Veeva CRM data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=veeva-crm)
- Read more: [enterprisedna.co/omni/instead-of/veeva-crm](https://enterprisedna.co/omni/instead-of/veeva-crm?utm_source=github&utm_medium=readme&utm_campaign=veeva-crm)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
