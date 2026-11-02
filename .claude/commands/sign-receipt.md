---
description: "Record the prescriber's signed receipt for a delivered starter pack (--date)."
---

# sign-receipt

Record the prescriber's signed receipt for a delivered starter pack (--date).

Run `node scripts/crm.mjs sign-receipt <sample>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
