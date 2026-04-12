/*
  migrate_caregivers_to_collection.js

  Move caregiver data from `users` collection to a dedicated `caregivers` collection in Firestore.

  Usage (PowerShell):

  $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
  node .\scripts\migrate_caregivers_to_collection.js --dryRun
  node .\scripts\migrate_caregivers_to_collection.js

  Options:
    --dryRun: Do not write any changes; only print what would be done.
    --limit=N: Process at most N caregivers (useful for testing).

  Notes:
  - This script requires a service account JSON and will use the Admin SDK.
  - It checks for existing documents in `caregivers` with the same uid and skips them.
  - It will copy core fields and set defaults where needed.
*/

const admin = require('firebase-admin')
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')

const argv = yargs(hideBin(process.argv))
  .option('dryRun', { type: 'boolean', default: false })
  .option('limit', { type: 'number', default: 0 })
  .argv

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('ERROR: Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON file path before running this script.')
  process.exit(1)
}

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() })
} catch (e) {
  // already initialized
}

const db = admin.firestore()

async function migrate() {
  const dryRun = Boolean(argv.dryRun)
  const limit = Number(argv.limit) || 0

  console.log('Starting caregivers migration', { dryRun, limit })

  const usersRef = db.collection('users')
  let q = usersRef.where('user_lvl', '==', 'caregiver').orderBy('first_name')
  if (limit > 0) q = q.limit(limit)

  const snaps = await q.get()
  console.log(`Found ${snaps.size} caregiver users to process`)

  let processed = 0
  for (const doc of snaps.docs) {
    const uid = doc.id
    const data = doc.data()

    // Skip if caregivers collection already has a doc with same uid
    const caregiverRef = db.collection('caregivers').doc(uid)
    const caregiverSnap = await caregiverRef.get()
    if (caregiverSnap.exists) {
      console.log(`Skipping ${uid} - caregiver doc already exists`) 
      continue
    }

    // Map fields from user to caregiver
    const mapped = {
      first_name: data.first_name || data.firstName || '',
      middle_name: data.middle_name || data.middleName || '',
      last_name: data.last_name || data.lastName || '',
      email: data.email || '',
      contact_number: data.phone || data.contact_number || 0,
      address: data.address || {},
      shift_type: data.shift_type || 'Day',
      shift_start_date: data.shift_start_date || null,
      shift_end_date: data.shift_end_date || null,
      role: data.role || 'caregiver',
      assigned_patients_count: data.assigned_patients_count || 0,
      max_patients: data.max_patients || 2,
      status: data.status || 'Active',
      created_at: data.created_at || admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      license_number: data.license_number || data.license || '',
      license_picture: data.license_image_base64 || data.license_picture || ''
    }

    console.log(`Preparing to create caregiver doc for ${uid}:`, mapped)

    if (!dryRun) {
      await caregiverRef.set(mapped)
      console.log(`Created caregiver document for ${uid}`)

      // Optionally create initial shifts if dates present
      if (mapped.shift_start_date && mapped.shift_end_date) {
        try {
          // call an internal function to create shifts if desired
          // This script intentionally avoids complex shift creation to reduce risk
          console.log(`Note: caregiver ${uid} has schedule dates - consider running generateMissingShiftRecords for this uid if shifts are needed.`)
        } catch (shiftErr) {
          console.warn('Failed to create shift records for', uid, shiftErr)
        }
      }
    }

    processed++
  }

  console.log(`Migration completed. Processed ${processed} caregivers.`)
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2) })
