# Rules and sources

Each rule the system checks, where it comes from, what a breach looks like in the records, and where the check lives. `/compliance` runs them all; `/attention` puts every breach first. Every check is a row in the `v_issues` view in `supabase/migrations/0001_pharma_crm.sql`. These are records checks, not legal or regulatory advice. Check them against the current Code and your own procedures before you rely on them, and when one changes, change the view and this page together.

The sources:

- **Medicines Australia Code of Conduct, Edition 20**, in force from 30 March 2025 (code.medicinesaustralia.com.au). Binding on members; many non-members follow it.
- **Medicines New Zealand Code of Practice, Edition 17**, in force from 1 September 2019, with the guidance notes of 22 April 2021, 31 March 2022 and 1 October 2026 (medicinesnz.co.nz). Under full review: check for a new edition.
- **Medicines Australia Code Tool Kit: Hospitality and Venues**, published November 2022, revised March 2025 (the hospitality cap).
- **Medicines Australia: Transparency Reporting, A Quick Guide**, published April 2022, revised March 2025 (the reporting timetable).

Australian States and Territories have their own rules on supplying samples, and they apply on top of the Code. Medicines Australia publishes a summary table of them. The system does not check those; add the ones that apply to you with `/customise`.

## Starter packs and samples

| Rule | Source | Breach | Check |
|---|---|---|---|
| Australia: a written request from the healthcare professional before supply, with the name and address of the person supplied and the name, strength and quantity of the starter packs. | Code Ed. 20 s 6.1.5 | A delivered sample with no request, a request dated after delivery, or a request with no name and address. `/deliver-sample` refuses delivery before the request. | `starter pack supplied without a written request first`; `starter pack request without the name and address` |
| Australia: keep a record of delivery, with the quantity and nature of the starter packs, for at least two years. | Code Ed. 20 s 6.1.6 | Not possible here: sample and stock records cannot be deleted. | database triggers `samples_kept`, `stock_kept` |
| Australia: starter packs are stored and supplied consistent with the product labelling. | Code Ed. 20 s 6.1.3 | A sample delivered from a lot past its expiry, or expired stock left with a rep. | `sample supplied from an expired lot`; `expired sample stock still with a rep` |
| New Zealand: samples only to health professionals with prescribing rights. | Medicines NZ Code Ed. 17 s 4.18.1 | A delivered sample to a professional recorded as not a prescriber. `/request-sample` refuses (and applies the same house rule in Australia). | `sample given to a health professional without prescribing rights` |
| New Zealand: samples only for registered medicines and indications. | Medicines NZ Code Ed. 17 s 4.18.3 | A sample of a product recorded as not registered. `/request-sample` refuses. | `sample of a product not registered for supply` |
| New Zealand: a rep carrying and issuing samples holds a hawker's licence or is nominated on the company's licence. | Medicines NZ Code Ed. 17 s 4.18.5 | A sample issued by a rep with no licence on file, or after it ran out. `/deliver-sample` refuses. `/attention` warns 30 days before a licence runs out. | `sample issued by a rep without a current licence` |
| New Zealand: the rep records the issue and gets a signature of receipt from the professional. | Medicines NZ Code Ed. 17 s 4.18.6 | A delivered New Zealand sample with no `receipt_signed_on`. | `sample given without a signed receipt` |
| New Zealand: samples kept secure and recorded so that a recall reaches them. | Medicines NZ Code Ed. 17 s 4.18.7 | A recalled lot still in a rep's stock, or a professional who received a recalled lot not yet told. Every delivery names its lot, so `/recall` lists everyone. | `recalled lot still in a rep's stock`; `professional given a recalled lot not yet told` |

## Hospitality and events

| Rule | Source | Breach | Check |
|---|---|---|---|
| Australia: hospitality is secondary to the purpose of the activity, moderate and reasonable, under a capped maximum spend per person. The cap is A$140 a head a meal, excluding gratuities and GST, from 3 November 2022, reviewed each year. | Code Ed. 20 ss 4.5.2 and 4.5.3; Code Tool Kit, Hospitality and Venues | An event (not cancelled) with food and drink a head above `hospitality_cap_cents_au`. `/add-event` refuses a planned meal over the cap; `/event-status` records the real figure, and the breach shows. | `hospitality over the cap` |
| No entertainment. | Code Ed. 20 s 4.5.5; Medicines NZ Code Ed. 17 s 4.8.3.1 | An event marked with entertainment. `/add-event` refuses. | `entertainment at an event` |
| New Zealand: no takeaway meals or meals to be eaten outside the meeting. | Medicines NZ Code Ed. 17 s 4.8.2.2 | A New Zealand event marked takeaway. `/add-event` refuses. | `takeaway meal at a company meeting` |
| Hospitality secondary to the education. | Code Ed. 20 s 4.5.2; Medicines NZ Code Ed. 17 s 4.8.2.1 | `/add-event` refuses an event with no education recorded (except third-party sponsorship). | in `/add-event` |

When Medicines Australia changes the cap, change the setting: `/set hospitality_cap_cents_au <cents>`.

## Transfers of value (Australia)

| Rule | Source | Breach | Check |
|---|---|---|---|
| Report fees for speaking, consultancy and advisory services, sponsorship of a professional, and airfares, accommodation and registration fees, with the date, the professional's name, type and principal practice address, the service, the event, whether paid to the professional or a third party, and the amount split into registration, travel and accommodation, and fees for service. Market research only where the professional's identity is known. Prescription medicines only. Hospitality alone at an educational meeting is not reported. | Code Ed. 20 ss 14.1.2, 14.1.3 and 14.2.3 | What `v_reportable` holds; `/transparency-report` writes these fields. | `v_reportable` |
| No transfer of value unless the professional has been given notice of the disclosure obligation. | Code Ed. 20 s 14.1.6 | A reportable transfer with no notice date, or notice after payment. `/record-tov` refuses. | `transfer of value made before the professional was given notice of disclosure` |
| Each professional has at least six weeks to review, verify or correct their data before it is reported. | Code Ed. 20 s 14.1.5 | A transfer whose review has not gone out once the report is less than six weeks away, or a report submitted before six weeks had passed. `/submit-report` refuses unless `--short-review`. The reminder starts 70 days before the due date. | `send the professional their data to review`; `professional has less than six weeks to review`; `report submitted before the professional had six weeks to review` |
| Payments from 1 January to 30 June are submitted to Disclosure Australia by 31 October; 1 July to 31 December by 30 April. Where a due date falls on a weekend or holiday the nearest business day applies. | Code Ed. 20 s 14.4; Transparency Reporting Quick Guide | A closed half-year with reportable transfers and no submission after its due date. Flagged 30 days ahead. Weekends and holidays are not moved here: the date shown is the one in the Code. | `transparency report to Disclosure Australia` |
| The company declaration follows within seven calendar days of submission. | Code Ed. 20 s 14 | A submission with no declaration after seven days, or a declaration later than that. | `company declaration after submission` |

New Zealand has no matching public register of payments to professionals in the Medicines NZ Code of Practice, so New Zealand transfers are recorded but not reported. Third-party meeting sponsorship, grants and donations, and patient organisation support have their own Medicines Australia reports and timetables; they are not tracked here. Add them with `/customise` if you report them.

## What the system does not decide

It does not approve promotional material, decide whether a use is on label, or judge whether hospitality is reasonable for the education given. Call notes are the rep's words. Drafts use approved materials, and anything about efficacy, safety or an indication goes through medical and compliance review.
