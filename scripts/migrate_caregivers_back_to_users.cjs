/**
 * Migrate caregivers collection back into users collection.
 * Usage (PowerShell):
 * $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
 * node .\scripts\migrate_caregivers_back_to_users.cjs --dryRun
 * node .\scripts\migrate_caregivers_back_to_users.cjs
 */
const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));
const dryRun = !!argv.dryRun;
const limit = argv.limit ? parseInt(argv.limit, 10) : null;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function run() {
  console.log('Starting migration (dryRun=%s, limit=%s)', dryRun, limit || 'all');
  const colRef = db.collection('caregivers');
  let q = colRef;
  if (limit) q = colRef.limit(limit);

  const snap = await q.get();
  console.log('Found', snap.size, 'caregiver docs');

  let created = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    // Map fields from caregivers to users schema. Adjust as needed.
    const mapped = {
      first_name: data.first_name || data.given_name || '',
      last_name: data.last_name || data.family_name || '',
      email: data.email || data.generated_email || '',
      phone: data.contact_number || data.phone || '',
      user_lvl: 'caregiver',
      role: data.role || 'caregiver',
      generated_email: data.generated_email || null,
      generated_password: data.generated_password || null,
      auth_created: data.auth_created || false,
      status: data.status || 'Active',
      created_at: data.created_at || admin.firestore.FieldValue.serverTimestamp(),
      updated_at: data.updated_at || admin.firestore.FieldValue.serverTimestamp(),
      // copy any other fields you need
      ...data
    };

    // target ID strategy: preserve doc.id as uid if appropriate
    const targetId = doc.id; // or derive from mapped.user_id
    const targetRef = db.collection('users').doc(targetId);

    const exists = (await targetRef.get()).exists;
    if (exists) {
      console.log(`Skipping existing users/${targetId}`);
      continue;
    }

    if (dryRun) {
      console.log('[dryRun] would write users/' + targetId, mapped);
    } else {
      await targetRef.set(mapped, { merge: true });
      console.log('Wrote users/' + targetId);
      created++;
    }
  }

  console.log('Done. created:', created);
  if (!dryRun) {
    console.log('Verify data in Firestore console before deleting caregivers docs.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});