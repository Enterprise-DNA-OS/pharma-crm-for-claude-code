---
description: "Add an event: --title, --kind (company-meeting, dinner-meeting, workshop, advisory-board, third-party-sponsorship), --territory, --date, --venue, --education, --hours, --meal (food and drink a head, excluding gratuities and GST). Refuses entertainment, takeaway meals in New Zealand, and food over the Australian cap."
---

# add-event

Add an event: --title, --kind (company-meeting, dinner-meeting, workshop, advisory-board, third-party-sponsorship), --territory, --date, --venue, --education, --hours, --meal (food and drink a head, excluding gratuities and GST). Refuses entertainment, takeaway meals in New Zealand, and food over the Australian cap.

Run `node scripts/crm.mjs add-event --title="<title>" --kind=<kind> --territory=<territory> --date=<date> --education="<what is taught>" --meal=<amount>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
