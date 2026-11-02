---
description: "Record the transparency report submitted to Disclosure Australia (--period, --date). Refuses while any professional has had less than six weeks to review, unless --short-review, which stays on the record as a breach."
---

# submit-report

Record the transparency report submitted to Disclosure Australia (--period, --date). Refuses while any professional has had less than six weeks to review, unless --short-review, which stays on the record as a breach.

Run `node scripts/crm.mjs submit-report --period=<H1-2026>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`. Recording a submission does not make it. Submit through Disclosure Australia first.
