# Moving off Veeva CRM

Bring your practices, healthcare professionals, call history and sample history across in an afternoon. Do it on a test copy first.

## 1. Export from Veeva CRM

Use Data Loader (or a report exported as comma-separated values) for four objects, one file each:

| File | Veeva object | What to include |
|---|---|---|
| `accounts.csv` | Account (business accounts: practices, hospitals, pharmacies) | Id, Name, the account type or record type, and the primary address (Address_vod__c, City_vod__c, State_vod__c, Zip_vod__c) |
| `hcps.csv` | Account (person accounts) | Id, FirstName, LastName, Credentials_vod__c, Specialty_1_vod__c, Primary_Parent_vod__c, PersonEmail, and the registration number and segment if you hold them |
| `calls.csv` | Call2_vod__c | Id, Account_vod__c, Call_Date_vod__c, the owner's name, Call_Type_vod__c, Status_vod__c, the detailed products, comments and next call notes |
| `samples.csv` | Call2_Sample_vod__c with Sample_Lot_vod__c | Id, Account_vod__c, Call_Date_vod__c, the owner's name, Product_vod__c, Lot_vod__c, Quantity_vod__c, the lot's expiry, the signature date, and the request date where you kept one |

Field names vary with your configuration. The import reads the standard names above and plain alternatives (Account Name, Call Date, Specialty, Quantity and so on). For anything else, write a map file and pass `--map=map.json`:

```json
{ "segment": "Target_Tier__c", "territory": "Territory_Name__c", "registration": "AHPRA_Number__c" }
```

The keys are the fields in `scripts/lib/domain.mjs` (`MAPS`); the values are your column headings.

## 2. Set up what Veeva will not export cleanly

Add your territories, reps and products first, with the product codes your exports use (or name products the way Veeva names them: the import matches code, name, or name with strength):

```bash
node scripts/crm.mjs add-territory --code=SYD --name=Sydney --country=AU --state=NSW --actor="Your name"
node scripts/crm.mjs add-rep --name="Priya Raman" --territory=SYD --actor="Your name"
node scripts/crm.mjs add-product --code=GLY500 --name=Glyzera --strength="500 mg" --starter-packs --actor="Your name"
```

In New Zealand, record each rep's hawker's licence (or "company licence") and its expiry with `--licence` and `--licence-expires`.

## 3. Import, dry run first

```bash
node scripts/crm.mjs import veeva accounts.csv --kind=accounts --territory=SYD --actor="Your name" --dry-run
node scripts/crm.mjs import veeva hcps.csv --kind=hcps --actor="Your name" --dry-run
node scripts/crm.mjs import veeva calls.csv --kind=calls --actor="Your name" --dry-run
node scripts/crm.mjs import veeva samples.csv --kind=samples --actor="Your name" --dry-run
```

Check the counts, then run each again without `--dry-run`. Order matters: professionals link to their practice by `Primary_Parent_vod__c`, and calls and samples link to professionals by `Account_vod__c`. Files without a territory column take `--territory`; files without an owner column take `--rep`.

- Each file goes in as one transaction. One bad row stops the whole file and nothing is kept.
- Running a file twice is safe: rows already imported (by their Veeva Id) are skipped.
- Planned and saved calls are skipped; only submitted calls come across.
- Profession is read from credentials and specialty (GP, specialist, nurse practitioner, pharmacist, nurse). Prescriber is set for GPs, specialists and nurse practitioners. Check nurses and pharmacists who prescribe with `/hcps` and fix them with `/hcp-status --prescriber=yes`.
- A sample with no request date comes across with no written request, and an Australian one will show on `/compliance` until you check the paper record. That is deliberate.
- A lot the system has not seen is created from the file's expiry date. Imported samples net to zero in the rep's stock: count each rep's stock on the day you switch and record it with `/move-stock --kind=received`.

## 4. What comes across and what does not

| Comes across | Does not |
|---|---|
| Practices and hospitals with their address | Territory alignments and hierarchies (set territories yourself) |
| Professionals with credentials, specialty, practice, email, registration number and segment where present | Affiliations between professionals and multiple addresses beyond the primary |
| Submitted calls with date, owner, channel, products, comments and next call notes | Call key messages, CLM presentation history and approved email history |
| Call samples with product, lot, quantity, expiry and signature date | Signature images, sample inventories and transfers between reps (count stock on the switch day) |
| | Medical events, attendees and expenses (add the ones in the open half-year with `/add-event`, `/invite` and `/record-tov` so the transparency report is complete) |

Keep your Veeva exports as the archive of everything else. Enterprise DNA maps the rest (events, expenses, alignments, your custom fields) as part of a customised install.
