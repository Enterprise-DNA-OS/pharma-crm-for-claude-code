---
description: "One lot's recall: every professional who received it and whether they have been told, and every rep still holding it."
---

# recall

One lot's recall: every professional who received it and whether they have been told, and every rep still holding it.

Run `node scripts/crm.mjs recall <lot>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Suggest /draft-recall-letter for anyone not told, and /move-stock --kind=returned for stock still with reps.
