---
description: "Add a rep to a territory: --name, --territory, --email, and in New Zealand --licence (hawker's licence number, or \"company licence\") with --licence-expires."
---

# add-rep

Add a rep to a territory: --name, --territory, --email, and in New Zealand --licence (hawker's licence number, or "company licence") with --licence-expires.

Run `node scripts/crm.mjs add-rep --name="<name>" --territory=<territory>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
