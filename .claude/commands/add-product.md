---
description: "Add a product: --code, --name, --strength, --form, --kind (prescription, otc, device), --registered (default yes), --starter-packs."
---

# add-product

Add a product: --code, --name, --strength, --form, --kind (prescription, otc, device), --registered (default yes), --starter-packs.

Run `node scripts/crm.mjs add-product --code=<code> --name="<name>" --strength="<strength>"`. Add `--json` when you need every field. Resolve the professional, practice, rep, lot, sample, event or territory by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Every write needs `--actor="<your name>"`.
