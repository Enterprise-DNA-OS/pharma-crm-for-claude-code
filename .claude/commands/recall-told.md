---
description: "Record that a professional who received a recalled lot has been told (--date)."
---

# recall-told

Record that a professional who received a recalled lot has been told (--date).

Run `node scripts/crm.mjs recall-told <sample>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
