---
description: "Write the half-year's transparency report as a comma-separated file for Disclosure Australia (--period), with the fields the Code lists, to drafts/."
---

# transparency-report

Write the half-year's transparency report as a comma-separated file for Disclosure Australia (--period), with the fields the Code lists, to drafts/.

Run `node scripts/crm.mjs transparency-report --period=<H1-2026>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Check it against the current Disclosure Australia template before it goes. Flag any professional with no practice address.
