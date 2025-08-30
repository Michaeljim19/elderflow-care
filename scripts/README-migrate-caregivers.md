Migration helper: migrate_caregivers_to_collection.js

Purpose:
- Copy caregiver records from `users` collection into a dedicated `caregivers` collection.
- Preserve fields and skip documents that already exist in the `caregivers` collection.

Run (PowerShell):

Set service account env var then dry-run:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
node .\scripts\migrate_caregivers_to_collection.js --dryRun --limit=10
```

Run for real (no limit):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
node .\scripts\migrate_caregivers_to_collection.js
```

Notes:
- The script uses the Admin SDK and requires a service account with Firestore permissions.
- It intentionally does not auto-create shift records; run `generateMissingShiftRecords` for specific UIDs if shifts are needed.
- Always run `--dryRun` and confirm before writing to production.
