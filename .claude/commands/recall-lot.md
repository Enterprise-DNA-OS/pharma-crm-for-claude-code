---
description: "Recall a lot (--note with the reason and instructions, --date). Shows every professional who received it and every rep holding it."
---

# recall-lot

Recall a lot (--note with the reason and instructions, --date). Shows every professional who received it and every rep holding it.

Run `node scripts/crm.mjs recall-lot <lot> --note="<reason and instructions>"`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`. Then run /draft-recall-letter and move the stock back with /move-stock --kind=returned.
