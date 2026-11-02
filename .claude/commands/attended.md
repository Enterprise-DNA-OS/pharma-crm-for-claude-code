---
description: "Record that an invited professional came to an event (--no if they did not)."
---

# attended

Record that an invited professional came to an event (--no if they did not).

Run `node scripts/crm.mjs attended <event> <professional>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
