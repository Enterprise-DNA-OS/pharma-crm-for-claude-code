---
description: "Log a call: --rep, --date (default today), --channel (face-to-face, remote, phone, group), --products=CRD10,GLY500, --notes, --next-step, --follow-up=<date>. Warns when an unregistered product was discussed."
---

# log-call

Log a call: --rep, --date (default today), --channel (face-to-face, remote, phone, group), --products=CRD10,GLY500, --notes, --next-step, --follow-up=<date>. Warns when an unregistered product was discussed.

Run `node scripts/crm.mjs log-call <professional> --rep=<rep> --products=<codes> --notes="<what was said>"`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`. Copy the rep's notes as given. Never add product claims the rep did not make.
