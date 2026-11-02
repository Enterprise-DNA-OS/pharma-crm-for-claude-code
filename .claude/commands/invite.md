---
description: "Invite a professional to an event (--role: delegate, speaker, chair, advisor)."
---

# invite

Invite a professional to an event (--role: delegate, speaker, chair, advisor).

Run `node scripts/crm.mjs invite <event> <professional> --role=<role>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
