# The CLI

Every slash command drives one CLI command: `node scripts/crm.mjs <command> [arguments] [--options]`. Human tables by default, `--json` for machines. Every write needs `--actor="<your name>"`. Dates are `YYYY-MM-DD`; half-years are `H1-2026` (January to June) or `H2-2026` (July to December). Amounts are dollars, like `1450.00`.

## Reads

### territories

Every territory: country and state, its reps, professionals, A-segment count, how many are behind target and calls this cycle.

```bash
node scripts/crm.mjs territories
```

### territory

One territory in full: every professional with target and calls this cycle, starter packs waiting and events coming.

```bash
node scripts/crm.mjs territory <territory>
```

### reps

Every rep: territory, sample licence and when it runs out, calls this cycle and sample units held.

```bash
node scripts/crm.mjs reps
```

### rep

One rep: sample stock by lot, the last ten calls and starter packs waiting to go out.

```bash
node scripts/crm.mjs rep <rep>
```

### products

Every product: strength, form, whether it is registered and has starter packs, units with reps and details in the last 90 days.

```bash
node scripts/crm.mjs products
```

### accounts

Every practice, hospital, pharmacy and clinic (or --territory=<territory>): professionals there and the last call.

```bash
node scripts/crm.mjs accounts
```

### account

One practice or hospital and every professional who works there, with segment and calls this cycle.

```bash
node scripts/crm.mjs account <account>
```

### hcps

Every active healthcare professional (or --territory, --segment=A, --specialty, --all for retired and moved): target calls, calls this cycle, last call.

```bash
node scripts/crm.mjs hcps
```

### hcp

One healthcare professional in full: where they work, segment, the last ten calls, starter packs, events and every transfer of value. Find them by code, name, surname or registration number.

```bash
node scripts/crm.mjs hcp <professional>
```

### calls

Calls in the last 30 days (or --days=N, --rep, --hcp): who, products detailed, next step.

```bash
node scripts/crm.mjs calls
```

### call-plan

The week's call plan for a territory or a rep (--territory or --rep, --days=7): professionals behind target, follow-ups falling due, starter packs to deliver and events coming.

```bash
node scripts/crm.mjs call-plan --territory=<territory>
```

### coverage

Reach and frequency against the call plan this cycle, by territory and segment (or --territory).

```bash
node scripts/crm.mjs coverage
```

### follow-ups

Every open follow-up from a call, overdue first (or --rep).

```bash
node scripts/crm.mjs follow-ups
```

### samples

Starter packs requested and delivered (or --open for waiting only, --rep, --hcp): request, delivery, lot, signed receipt.

```bash
node scripts/crm.mjs samples
```

### rep-stock

Sample stock with each rep by lot (or --rep): on hand, expiry, and whether it is good, short-dated, expired or recalled.

```bash
node scripts/crm.mjs rep-stock
```

### lots

Every sample lot: product, expiry, recall date, units with reps and units given out.

```bash
node scripts/crm.mjs lots
```

### recall

One lot's recall: every professional who received it and whether they have been told, and every rep still holding it.

```bash
node scripts/crm.mjs recall <lot>
```

### events

Every event (or --upcoming): kind, country, date, food and drink a head, invited and attended.

```bash
node scripts/crm.mjs events
```

### event

One event: details, attendees, payments to professionals and any Code issue on it.

```bash
node scripts/crm.mjs event <event>
```

### transfers

Transfers of value (or --period=H1-2026, --hcp): kind, amount, notice of disclosure, review sent, and whether it is reportable.

```bash
node scripts/crm.mjs transfers
```

### transparency

Each half-year's report to Disclosure Australia: transfers, amount, reviews sent, due date, submitted, declared, standing.

```bash
node scripts/crm.mjs transparency
```

### compliance

Check the records against the Medicines Australia Code and the Medicines NZ Code of Practice (or --country=AU, NZ): every breach and every rule clock, each with its section.

```bash
node scripts/crm.mjs compliance
```

### attention

Show what needs a person today: Code breaches, recalls not finished, reviews and reports due, starter packs waiting, rep licences running out, short-dated stock, overdue follow-ups, A-segment professionals not seen this cycle, and events with attendance not recorded.

```bash
node scripts/crm.mjs attention
```

### insights

The ten questions the CRM dashboard does not answer, run on the records.

```bash
node scripts/crm.mjs insights
```

### activity

The activity log for the last 7 days (or --days=N): who did what.

```bash
node scripts/crm.mjs activity
```

### settings

The house rules: call cycle, short-dated days, starter pack delivery days, quiet days, licence warning days and the Australian hospitality cap.

```bash
node scripts/crm.mjs settings
```

## Writes

### add-territory

Add a territory: --code, --name, --country (NZ, AU), --state for Australia.

```bash
node scripts/crm.mjs add-territory --code=<code> --name="<name>" --country=<NZ|AU>
```

### add-rep

Add a rep to a territory: --name, --territory, --email, and in New Zealand --licence (hawker's licence number, or "company licence") with --licence-expires.

```bash
node scripts/crm.mjs add-rep --name="<name>" --territory=<territory>
```

### rep-status

Update a rep: --status (active, left), --territory, --licence, --licence-expires.

```bash
node scripts/crm.mjs rep-status <rep> --licence-expires=<date>
```

### add-product

Add a product: --code, --name, --strength, --form, --kind (prescription, otc, device), --registered (default yes), --starter-packs.

```bash
node scripts/crm.mjs add-product --code=<code> --name="<name>" --strength="<strength>"
```

### add-account

Add a practice, hospital, pharmacy or clinic: --name, --territory, --kind, --address, --city, --postcode.

```bash
node scripts/crm.mjs add-account --name="<name>" --territory=<territory> --address="<address>" --city="<city>"
```

### add-hcp

Add a healthcare professional: --name, --profession (gp, specialist, nurse-practitioner, pharmacist, nurse, other), --specialty, --account, --segment (A, B, C), --target calls a cycle, --registration, --email. Prescriber is set from the profession unless you give --prescriber.

```bash
node scripts/crm.mjs add-hcp --name="<name>" --profession=<profession> --account=<account>
```

### hcp-status

Update a professional: --status (active, moved, retired), --segment, --target, --contact-ok=no when they ask not to be contacted, --prescriber, --account when they move practice.

```bash
node scripts/crm.mjs hcp-status <professional> --segment=<A|B|C>
```

### log-call

Log a call: --rep, --date (default today), --channel (face-to-face, remote, phone, group), --products=CRD10,GLY500, --notes, --next-step, --follow-up=<date>. Warns when an unregistered product was discussed.

```bash
node scripts/crm.mjs log-call <professional> --rep=<rep> --products=<codes> --notes="<what was said>"
```

### follow-up-done

Close the follow-up on a call (--date, default today).

```bash
node scripts/crm.mjs follow-up-done <call>
```

### add-lot

Add a sample lot: --product, --lot, --expires.

```bash
node scripts/crm.mjs add-lot --product=<product> --lot=<lot> --expires=<date>
```

### recall-lot

Recall a lot (--note with the reason and instructions, --date). Shows every professional who received it and every rep holding it.

```bash
node scripts/crm.mjs recall-lot <lot> --note="<reason and instructions>"
```

### move-stock

Move sample stock through a rep's hands: --rep, --lot, --qty, --kind (received, returned, destroyed, adjusted with --note). Refuses recalled or expired lots going out and more than the rep holds.

```bash
node scripts/crm.mjs move-stock --rep=<rep> --lot=<lot> --qty=<n> --kind=<kind>
```

### request-sample

Record a written starter pack request: --product, --qty, --rep, --date, --address (default the practice address). Refuses non-prescribers, unregistered products and products with no starter packs.

```bash
node scripts/crm.mjs request-sample <professional> --product=<product> --qty=<n> --rep=<rep>
```

### deliver-sample

Deliver a requested starter pack: --lot, --date, --signed (or --signed=<date>) for the receipt. Refuses delivery before the written request, a recalled or expired lot, a lot of another product, a New Zealand rep without a current licence, and more than the rep holds.

```bash
node scripts/crm.mjs deliver-sample <sample> --lot=<lot> --signed
```

### sign-receipt

Record the prescriber's signed receipt for a delivered starter pack (--date).

```bash
node scripts/crm.mjs sign-receipt <sample>
```

### cancel-sample

Cancel a starter pack request not yet delivered (--reason).

```bash
node scripts/crm.mjs cancel-sample <sample> --reason="<reason>"
```

### recall-told

Record that a professional who received a recalled lot has been told (--date).

```bash
node scripts/crm.mjs recall-told <sample>
```

### add-event

Add an event: --title, --kind (company-meeting, dinner-meeting, workshop, advisory-board, third-party-sponsorship), --territory, --date, --venue, --education, --hours, --meal (food and drink a head, excluding gratuities and GST). Refuses entertainment, takeaway meals in New Zealand, and food over the Australian cap.

```bash
node scripts/crm.mjs add-event --title="<title>" --kind=<kind> --territory=<territory> --date=<date> --education="<what is taught>" --meal=<amount>
```

### invite

Invite a professional to an event (--role: delegate, speaker, chair, advisor).

```bash
node scripts/crm.mjs invite <event> <professional> --role=<role>
```

### attended

Record that an invited professional came to an event (--no if they did not).

```bash
node scripts/crm.mjs attended <event> <professional>
```

### event-status

Record an event as held or cancelled (--status), with the actual food and drink a head (--meal). Shows any Code issue it creates.

```bash
node scripts/crm.mjs event-status <event> --status=held --meal=<amount>
```

### record-tov

Record a payment or transfer of value to a professional: --kind (speaker-fee, consultancy, advisory-board, sponsorship, registration, travel, accommodation, market-research), --amount, --description, --paid, --event, --paid-to (hcp, third-party), --notice (the date they were told it will be disclosed; required in Australia and must be on or before payment).

```bash
node scripts/crm.mjs record-tov <professional> --kind=<kind> --amount=<amount> --description="<service>" --notice=<date>
```

### send-review

Record that professionals were sent their transfers to review: one transfer, or every one for a --period (optionally one professional). Shows when the six weeks end.

```bash
node scripts/crm.mjs send-review <transfer>
```

### submit-report

Record the transparency report submitted to Disclosure Australia (--period, --date). Refuses while any professional has had less than six weeks to review, unless --short-review, which stays on the record as a breach.

```bash
node scripts/crm.mjs submit-report --period=<H1-2026>
```

### declare-report

Record the company declaration lodged after a submission (--period, --date). Shows whether it was within seven days.

```bash
node scripts/crm.mjs declare-report --period=<H1-2026>
```

### set

Change a house rule (for example `set cycle_days 42`, or `set hospitality_cap_cents_au 14000` when Medicines Australia changes the cap).

```bash
node scripts/crm.mjs set <key> <value>
```

## Drafts, reports, import and export

### weekly-review

Write the Monday field review to drafts/: what needs a person, coverage this cycle and open follow-ups.

```bash
node scripts/crm.mjs weekly-review
```

### draft-follow-up

Draft the follow-up email to a professional after a call, from the call's next step. Written to drafts/, never sent. Refuses anyone who asked not to be contacted.

```bash
node scripts/crm.mjs draft-follow-up <call>
```

### draft-review-letter

Draft the letter that gives a professional their transfers of value for the half-year to review before the report (--period). Written to drafts/, never sent.

```bash
node scripts/crm.mjs draft-review-letter <professional> --period=<H1-2026>
```

### draft-recall-letter

Draft one recall letter for every professional who received a recalled lot and has not been told. Written to drafts/, never sent.

```bash
node scripts/crm.mjs draft-recall-letter <lot>
```

### transparency-report

Write the half-year's transparency report as a comma-separated file for Disclosure Australia (--period), with the fields the Code lists, to drafts/.

```bash
node scripts/crm.mjs transparency-report --period=<H1-2026>
```

### import

Bring practices, professionals, calls and sample history across from Veeva CRM exports (comma-separated). Dry run first. Import accounts, then hcps, then calls and samples.

```bash
node scripts/crm.mjs import veeva <file.csv> --kind=<accounts|hcps|calls|samples> --dry-run
```

### export

Export every record to one JSON file the business owns. It holds personal information about health professionals: keep it as securely as the database.

```bash
node scripts/crm.mjs export
```

## Outside the CLI

- `npm run view` renders the dashboards in `views.json` to `views/`.
- `npm run docs` renders the documents in `documents.json` to `docs-out/`.
- `npm run demo` runs three commands on a temporary demo database.
- `npm test` runs every command on a temporary database.
