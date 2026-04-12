// Migration script to update role from 'guardian' to 'patient' in accounts collection
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/services/firebase/collections';

export const migrateGuardianToPatient = async () => {
  try {
    console.log('Starting migration: guardian -> patient roles...');
    
    // Query for all accounts with role 'guardian'
    const q = query(
      collection(db, COLLECTIONS.ACCOUNTS),
      where('role', '==', 'guardian')
    );
    
    const querySnapshot = await getDocs(q);
    const accountsToUpdate = querySnapshot.docs;
    
    console.log(`Found ${accountsToUpdate.length} accounts with role 'guardian' to update`);
    
    // Update each account
    for (const accountDoc of accountsToUpdate) {
      const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountDoc.id);
      await updateDoc(accountRef, {
        role: 'patient',
        updated_at: new Date().toISOString()
      });
      
      console.log(`Updated account ${accountDoc.id}: ${accountDoc.data().name || accountDoc.data().email}`);
    }
    
    console.log(`Migration completed successfully! Updated ${accountsToUpdate.length} accounts.`);
    return {
      success: true,
      updatedCount: accountsToUpdate.length
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      error: error
    };
  }
};

// Function to run migration from browser console
export const runMigration = async () => {
  const result = await migrateGuardianToPatient();
  if (result.success) {
    console.log(`✅ Migration successful! Updated ${result.updatedCount} accounts.`);
  } else {
    console.error('❌ Migration failed:', result.error);
  }
  return result;
};
