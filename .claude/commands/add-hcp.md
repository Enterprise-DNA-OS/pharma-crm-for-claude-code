---
description: "Add a healthcare professional: --name, --profession (gp, specialist, nurse-practitioner, pharmacist, nurse, other), --specialty, --account, --segment (A, B, C), --target calls a cycle, --registration, --email. Prescriber is set from the profession unless you give --prescriber."
---

# add-hcp

Add a healthcare professional: --name, --profession (gp, specialist, nurse-practitioner, pharmacist, nurse, other), --specialty, --account, --segment (A, B, C), --target calls a cycle, --registration, --email. Prescriber is set from the profession unless you give --prescriber.

Run `node scripts/crm.mjs add-hcp --name="<name>" --profession=<profession> --account=<account>`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
