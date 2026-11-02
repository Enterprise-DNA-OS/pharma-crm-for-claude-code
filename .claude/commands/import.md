---
description: "Bring practices, professionals, calls and sample history across from Veeva CRM exports (comma-separated). Dry run first. Import accounts, then hcps, then calls and samples."
---

# import

Bring practices, professionals, calls and sample history across from Veeva CRM exports (comma-separated). Dry run first. Import accounts, then hcps, then calls and samples.

Run `node scripts/crm.mjs import veeva <file.csv> --kind=<accounts|hcps|calls|samples> --dry-run`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every import needs `--actor="<your name>"`. Run with --dry-run first, show the counts, then run again without it. Use --map=map.json for files with other headings and --territory or --rep for files that do not carry them. docs/replace-veeva-crm.md has the detail.
