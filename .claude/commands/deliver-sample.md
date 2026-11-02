---
description: "Deliver a requested starter pack: --lot, --date, --signed (or --signed=<date>) for the receipt. Refuses delivery before the written request, a recalled or expired lot, a lot of another product, a New Zealand rep without a current licence, and more than the rep holds."
---

# deliver-sample

Deliver a requested starter pack: --lot, --date, --signed (or --signed=<date>) for the receipt. Refuses delivery before the written request, a recalled or expired lot, a lot of another product, a New Zealand rep without a current licence, and more than the rep holds.

Run `node scripts/crm.mjs deliver-sample <sample> --lot=<lot> --signed`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
