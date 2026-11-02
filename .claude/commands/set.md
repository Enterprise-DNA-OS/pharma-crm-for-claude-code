---
description: "Change a house rule (for example `set cycle_days 42`, or `set hospitality_cap_cents_au 14000` when Medicines Australia changes the cap)."
---

# set

Change a house rule (for example `set cycle_days 42`, or `set hospitality_cap_cents_au 14000` when Medicines Australia changes the cap).

Run `node scripts/crm.mjs set <key> <value>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
