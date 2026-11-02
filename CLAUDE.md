# Pharma CRM for Claude Code: operating instructions

Claude Code reads this file at the start of every session. It says who this is for, the house rules, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS: a prescription medicines company, a generics or OTC company, or a medtech distributor with a field force in New Zealand, Australia or both]
- **Operator:** [YOUR NAME], [your role: sales manager, field force manager, rep, compliance lead, commercial excellence lead]
- **What matters most:** [for example: every A-segment specialist seen each cycle, no starter pack ever without a written request and a signed receipt, the transparency report in on time with every professional given six weeks to review]

The work is a field force calling on healthcare professionals in New Zealand and Australia: territories and reps, practices and hospitals, professionals and their segments, calls and the products detailed, starter pack requests and deliveries, sample lots and the stock each rep carries, events and who came, and the payments and transfers of value that go to Disclosure Australia every half-year.

## Rules

- Read the CLI result before answering. Every answer about a professional, call, sample, lot, event or payment starts with data from `node scripts/crm.mjs`. Never answer from memory.
- Resolve names first. If the CLI says a name is ambiguous, list the candidates and ask; never pick the first.
- These are personal records about health professionals. Show them only to the operator and never paste them into anything outside this folder.
- Never write a product claim. Call notes are the rep's words, copied as given. Drafts use approved materials only, and anything about efficacy, safety or an indication goes through the company's medical and compliance review. A question about an unapproved use goes to medical information, never into a draft.
- The Code is the Code. If `/attention` shows a breach, say so first, with the section. If a command refuses (a starter pack before the written request, a sample to a non-prescriber, a recalled lot, a New Zealand rep without a current licence, a meal over the cap, a payment before notice of disclosure), say why and stop. Never look for a way around it.
- Every write names `--actor`. That is a label in the activity log, not a verified identity.
- Never invent a date, a lot number, a quantity, an amount, a registration number or a signature. Copy them from the request, the receipt, the invoice or the operator.
- Never send, pay or delete. Letters, follow-ups and reports are drafts in `drafts/`; documents are in `docs-out/`. Recording a submission or a payment does not make it happen; a person does that. Calls, samples, stock movements, attendance and payments are never deleted, and the database refuses.
- The rules in `docs/compliance.md` are records checks, not legal or regulatory advice. If a rule looks out of date, say so and stop.
- Back up before a schema change. Use a new numbered migration (`/customise`), run `npm test`, and keep real data, exports and credentials out of Git.
- The database owner can bypass every application check. Protect that credential. Row security and revoked public privileges restrict unrelated database roles; a shared installation needs authenticated access.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| One practice or hospital and every professional who works there, with segment and calls this cycle. | `/account` |
| Every practice, hospital, pharmacy and clinic (or --territory=<territory>): professionals there and the last call. | `/accounts` |
| The activity log for the last 7 days (or --days=N): who did what. | `/activity` |
| Add a practice, hospital, pharmacy or clinic: --name, --territory, --kind, --address, --city, --postcode. | `/add-account` |
| Add an event: --title, --kind (company-meeting, dinner-meeting, workshop, advisory-board, third-party-sponsorship), --territory, --date, --venue, --education, --hours, --meal (food and drink a head, excluding gratuities and GST). Refuses entertainment, takeaway meals in New Zealand, and food over the Australian cap. | `/add-event` |
| Add a healthcare professional: --name, --profession (gp, specialist, nurse-practitioner, pharmacist, nurse, other), --specialty, --account, --segment (A, B, C), --target calls a cycle, --registration, --email. Prescriber is set from the profession unless you give --prescriber. | `/add-hcp` |
| Add a sample lot: --product, --lot, --expires. | `/add-lot` |
| Add a product: --code, --name, --strength, --form, --kind (prescription, otc, device), --registered (default yes), --starter-packs. | `/add-product` |
| Add a rep to a territory: --name, --territory, --email, and in New Zealand --licence (hawker's licence number, or "company licence") with --licence-expires. | `/add-rep` |
| Add a territory: --code, --name, --country (NZ, AU), --state for Australia. | `/add-territory` |
| Record that an invited professional came to an event (--no if they did not). | `/attended` |
| Show what needs a person today: Code breaches, recalls not finished, reviews and reports due, starter packs waiting, rep licences running out, short-dated stock, overdue follow-ups, A-segment professionals not seen this cycle, and events with attendance not recorded. | `/attention` |
| The week's call plan for a territory or a rep (--territory or --rep, --days=7): professionals behind target, follow-ups falling due, starter packs to deliver and events coming. | `/call-plan` |
| Calls in the last 30 days (or --days=N, --rep, --hcp): who, products detailed, next step. | `/calls` |
| Cancel a starter pack request not yet delivered (--reason). | `/cancel-sample` |
| Check the records against the Medicines Australia Code and the Medicines NZ Code of Practice (or --country=AU, NZ): every breach and every rule clock, each with its section. | `/compliance` |
| Reach and frequency against the call plan this cycle, by territory and segment (or --territory). | `/coverage` |
| Make this system yours in plain language. Add a field, rename a segment, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Record the company declaration lodged after a submission (--period, --date). Shows whether it was within seven days. | `/declare-report` |
| Deliver a requested starter pack: --lot, --date, --signed (or --signed=<date>) for the receipt. Refuses delivery before the written request, a recalled or expired lot, a lot of another product, a New Zealand rep without a current licence, and more than the rep holds. | `/deliver-sample` |
| Render the starter pack request and delivery records, each rep's sample stock statement and the event records as branded HTML in docs-out/. | `/documents` |
| Draft the follow-up email to a professional after a call, from the call's next step. Written to drafts/, never sent. Refuses anyone who asked not to be contacted. | `/draft-follow-up` |
| Draft one recall letter for every professional who received a recalled lot and has not been told. Written to drafts/, never sent. | `/draft-recall-letter` |
| Draft the letter that gives a professional their transfers of value for the half-year to review before the report (--period). Written to drafts/, never sent. | `/draft-review-letter` |
| One event: details, attendees, payments to professionals and any Code issue on it. | `/event` |
| Record an event as held or cancelled (--status), with the actual food and drink a head (--meal). Shows any Code issue it creates. | `/event-status` |
| Every event (or --upcoming): kind, country, date, food and drink a head, invited and attended. | `/events` |
| Export every record to one JSON file the business owns. It holds personal information about health professionals: keep it as securely as the database. | `/export` |
| Close the follow-up on a call (--date, default today). | `/follow-up-done` |
| Every open follow-up from a call, overdue first (or --rep). | `/follow-ups` |
| One healthcare professional in full: where they work, segment, the last ten calls, starter packs, events and every transfer of value. Find them by code, name, surname or registration number. | `/hcp` |
| Update a professional: --status (active, moved, retired), --segment, --target, --contact-ok=no when they ask not to be contacted, --prescriber, --account when they move practice. | `/hcp-status` |
| Every active healthcare professional (or --territory, --segment=A, --specialty, --all for retired and moved): target calls, calls this cycle, last call. | `/hcps` |
| Bring practices, professionals, calls and sample history across from Veeva CRM exports (comma-separated). Dry run first. Import accounts, then hcps, then calls and samples. | `/import` |
| The ten questions the CRM dashboard does not answer, run on the records. | `/insights` |
| Invite a professional to an event (--role: delegate, speaker, chair, advisor). | `/invite` |
| Log a call: --rep, --date (default today), --channel (face-to-face, remote, phone, group), --products=CRD10,GLY500, --notes, --next-step, --follow-up=<date>. Warns when an unregistered product was discussed. | `/log-call` |
| Every sample lot: product, expiry, recall date, units with reps and units given out. | `/lots` |
| Move sample stock through a rep's hands: --rep, --lot, --qty, --kind (received, returned, destroyed, adjusted with --note). Refuses recalled or expired lots going out and more than the rep holds. | `/move-stock` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |
| Every product: strength, form, whether it is registered and has starter packs, units with reps and details in the last 90 days. | `/products` |
| One lot's recall: every professional who received it and whether they have been told, and every rep still holding it. | `/recall` |
| Recall a lot (--note with the reason and instructions, --date). Shows every professional who received it and every rep holding it. | `/recall-lot` |
| Record that a professional who received a recalled lot has been told (--date). | `/recall-told` |
| Record a payment or transfer of value to a professional: --kind (speaker-fee, consultancy, advisory-board, sponsorship, registration, travel, accommodation, market-research), --amount, --description, --paid, --event, --paid-to (hcp, third-party), --notice (the date they were told it will be disclosed; required in Australia and must be on or before payment). | `/record-tov` |
| One rep: sample stock by lot, the last ten calls and starter packs waiting to go out. | `/rep` |
| Update a rep: --status (active, left), --territory, --licence, --licence-expires. | `/rep-status` |
| Sample stock with each rep by lot (or --rep): on hand, expiry, and whether it is good, short-dated, expired or recalled. | `/rep-stock` |
| Every rep: territory, sample licence and when it runs out, calls this cycle and sample units held. | `/reps` |
| Record a written starter pack request: --product, --qty, --rep, --date, --address (default the practice address). Refuses non-prescribers, unregistered products and products with no starter packs. | `/request-sample` |
| Starter packs requested and delivered (or --open for waiting only, --rep, --hcp): request, delivery, lot, signed receipt. | `/samples` |
| Record that professionals were sent their transfers to review: one transfer, or every one for a --period (optionally one professional). Shows when the six weeks end. | `/send-review` |
| Change a house rule (for example `set cycle_days 42`, or `set hospitality_cap_cents_au 14000` when Medicines Australia changes the cap). | `/set` |
| The house rules: call cycle, short-dated days, starter pack delivery days, quiet days, licence warning days and the Australian hospitality cap. | `/settings` |
| Record the prescriber's signed receipt for a delivered starter pack (--date). | `/sign-receipt` |
| Record the transparency report submitted to Disclosure Australia (--period, --date). Refuses while any professional has had less than six weeks to review, unless --short-review, which stays on the record as a breach. | `/submit-report` |
| Every territory: country and state, its reps, professionals, A-segment count, how many are behind target and calls this cycle. | `/territories` |
| One territory in full: every professional with target and calls this cycle, starter packs waiting and events coming. | `/territory` |
| Transfers of value (or --period=H1-2026, --hcp): kind, amount, notice of disclosure, review sent, and whether it is reportable. | `/transfers` |
| Each half-year's report to Disclosure Australia: transfers, amount, reviews sent, due date, submitted, declared, standing. | `/transparency` |
| Write the half-year's transparency report as a comma-separated file for Disclosure Australia (--period), with the fields the Code lists, to drafts/. | `/transparency-report` |
| Render the read-only dashboards (this week, coverage, samples and stock, transfers of value) as branded HTML in views/. | `/view` |
| Write the Monday field review to drafts/: what needs a person, coverage this cycle and open follow-ups. | `/weekly-review` |

If an ask fits nothing here, run the CLI directly (`node scripts/crm.mjs --help`) and then propose a new command for it.

## Where things live

- `scripts/crm.mjs` the CLI; `scripts/lib/domain.mjs` the rules. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL, with the Code checks as views (`v_issues`). `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `views.json` and `documents.json` the dashboards and documents; `brand.json` the name, logo and colours on them.
- `docs/compliance.md` every rule and its source. `docs/replace-veeva-crm.md` moving off Veeva CRM.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/veeva-crm
