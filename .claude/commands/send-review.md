---
description: "Record that professionals were sent their transfers to review: one transfer, or every one for a --period (optionally one professional). Shows when the six weeks end."
---

# send-review

Record that professionals were sent their transfers to review: one transfer, or every one for a --period (optionally one professional). Shows when the six weeks end.

Run `node scripts/crm.mjs send-review <transfer>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
