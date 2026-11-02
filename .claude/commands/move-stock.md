---
description: "Move sample stock through a rep's hands: --rep, --lot, --qty, --kind (received, returned, destroyed, adjusted with --note). Refuses recalled or expired lots going out and more than the rep holds."
---

# move-stock

Move sample stock through a rep's hands: --rep, --lot, --qty, --kind (received, returned, destroyed, adjusted with --note). Refuses recalled or expired lots going out and more than the rep holds.

Run `node scripts/crm.mjs move-stock --rep=<rep> --lot=<lot> --qty=<n> --kind=<kind>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
