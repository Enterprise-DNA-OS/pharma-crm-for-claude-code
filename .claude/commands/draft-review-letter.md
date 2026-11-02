---
description: "Draft the letter that gives a professional their transfers of value for the half-year to review before the report (--period). Written to drafts/, never sent."
---

# draft-review-letter

Draft the letter that gives a professional their transfers of value for the half-year to review before the report (--period). Written to drafts/, never sent.

Run `node scripts/crm.mjs draft-review-letter <professional> --period=<H1-2026>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

After it is sent, record it with /send-review.
