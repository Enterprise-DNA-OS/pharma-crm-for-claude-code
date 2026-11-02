---
description: "Update a professional: --status (active, moved, retired), --segment, --target, --contact-ok=no when they ask not to be contacted, --prescriber, --account when they move practice."
---

# hcp-status

Update a professional: --status (active, moved, retired), --segment, --target, --contact-ok=no when they ask not to be contacted, --prescriber, --account when they move practice.

Run `node scripts/crm.mjs hcp-status <professional> --segment=<A|B|C>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
