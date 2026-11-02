---
description: "Record a payment or transfer of value to a professional: --kind (speaker-fee, consultancy, advisory-board, sponsorship, registration, travel, accommodation, market-research), --amount, --description, --paid, --event, --paid-to (hcp, third-party), --notice (the date they were told it will be disclosed; required in Australia and must be on or before payment)."
---

# record-tov

Record a payment or transfer of value to a professional: --kind (speaker-fee, consultancy, advisory-board, sponsorship, registration, travel, accommodation, market-research), --amount, --description, --paid, --event, --paid-to (hcp, third-party), --notice (the date they were told it will be disclosed; required in Australia and must be on or before payment).

Run `node scripts/crm.mjs record-tov <professional> --kind=<kind> --amount=<amount> --description="<service>" --notice=<date>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`. This records a payment made. It never makes one.
