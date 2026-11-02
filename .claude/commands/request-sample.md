---
description: "Record a written starter pack request: --product, --qty, --rep, --date, --address (default the practice address). Refuses non-prescribers, unregistered products and products with no starter packs."
---

# request-sample

Record a written starter pack request: --product, --qty, --rep, --date, --address (default the practice address). Refuses non-prescribers, unregistered products and products with no starter packs.

Run `node scripts/crm.mjs request-sample <professional> --product=<product> --qty=<n> --rep=<rep>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`. Only record a request the prescriber actually made in writing.
