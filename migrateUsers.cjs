const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require("./care-db-project-firebase-adminsdk-fbsvc-12aae2a6b6.json")),
});

const db = admin.firestore();

// Define your unified user schema with default values
const defaultUser = {
  first_name: "",
  last_name: "",
  middle_name: "",
  birthday: "",
  email: "",
  contact_number: "",
  address: {
    province: "",
    city_municipality: "",
    barangay: "",
    street: "",
  },
  shift_type: "",
  shift_start_date: "",
  shift_end_date: "",
  hire_date: "",
  status: "Active",
  assigned_patients_count: 0,
  max_patients: 2,
  license_number: "",
  license_picture: "",
  contract_start_date: "",
  contract_end_date: "",
  user_lvl: "",
  role: "",
  specialization: "",
  created_at: "",
  updated_at: "",
  auth_created: false,
  generated_email: "",
  generated_password: "",
};

async function migrateUsers() {
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();

  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updateData = {};

    // Add missing fields with default values
    for (const key in defaultUser) {
      if (!(key in data)) {
        updateData[key] = defaultUser[key];
        needsUpdate = true;
      }
    }

    // For nested address
    if (!data.address) {
      updateData.address = defaultUser.address;
      needsUpdate = true;
    } else {
      for (const addrKey in defaultUser.address) {
        if (!data.address[addrKey]) {
          updateData[`address.${addrKey}`] = defaultUser.address[addrKey];
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await usersRef.doc(doc.id).update(updateData);
      updatedCount++;
      console.log(`Updated user: ${doc.id}`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} user(s).`);
}

migrateUsers().then(() => process.exit());
