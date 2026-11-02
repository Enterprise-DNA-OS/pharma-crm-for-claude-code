---
description: "Check the records against the Medicines Australia Code and the Medicines NZ Code of Practice (or --country=AU, NZ): every breach and every rule clock, each with its section."
---

# compliance

Check the records against the Medicines Australia Code and the Medicines NZ Code of Practice (or --country=AU, NZ): every breach and every rule clock, each with its section.

Run `node scripts/crm.mjs compliance`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Report breaches first as a table: rule, record, who, the section. For each, the one fix: the record to correct, the letter to draft, or the person to tell. If a rule in docs/compliance.md looks out of date, say so and stop.
