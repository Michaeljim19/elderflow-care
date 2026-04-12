import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore'
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  getAuth
} from 'firebase/auth'
import { db } from '../../lib/firebase'
import { COLLECTIONS } from './collections'
import type { Account } from '../../types'

// Helper function to update caregiver and shift records after Firebase Auth creation
const updateCaregiverRecordsWithNewId = async (oldDocumentId: string, newFirebaseUid: string, accountRole: string): Promise<void> => {
  try {
    if (accountRole !== 'caregiver') {
      console.log('Not a caregiver account, skipping caregiver record updates')
      return
    }

    console.log(`🔗 Updating caregiver records: ${oldDocumentId} -> ${newFirebaseUid}`)
    
    // Update caregiver record to use the new Firebase UID as caregiver_id
    const caregiversRef = collection(db, 'caregivers')
    const caregiverQuery = query(caregiversRef, where('caregiver_id', '==', oldDocumentId))
    const caregiverSnapshot = await getDocs(caregiverQuery)
    
    if (!caregiverSnapshot.empty) {
      const caregiverDoc = caregiverSnapshot.docs[0]
      const caregiverData = caregiverDoc.data()
      
      // Create new caregiver record with Firebase UID as document ID and caregiver_id
      await setDoc(doc(db, 'caregivers', newFirebaseUid), {
        ...caregiverData,
        caregiver_id: newFirebaseUid,
        user_id: newFirebaseUid, // Keep user_id matching Firebase UID for consistency
        updated_at: Timestamp.now()
      })
      
      // Delete the old caregiver record
      await deleteDoc(caregiverDoc.ref)
      
      console.log(`✅ Updated caregiver record: ${caregiverDoc.id} -> ${newFirebaseUid}`)
    } else {
      console.log(`⚠️ No caregiver record found with caregiver_id: ${oldDocumentId}`)
    }
    
    // Update all caregiver_shifts that reference the old caregiver_id
    const shiftsRef = collection(db, 'caregiver_shifts')
    const shiftsQuery = query(shiftsRef, where('caregiver_id', '==', oldDocumentId))
    const shiftsSnapshot = await getDocs(shiftsQuery)
    
    if (!shiftsSnapshot.empty) {
      const updatePromises = shiftsSnapshot.docs.map(shiftDoc => 
        updateDoc(shiftDoc.ref, {
          caregiver_id: newFirebaseUid,
          updated_at: Timestamp.now()
        })
      )
      
      await Promise.all(updatePromises)
      console.log(`✅ Updated ${shiftsSnapshot.size} caregiver shifts to use new caregiver_id: ${newFirebaseUid}`)
    } else {
      console.log(`ℹ️ No caregiver shifts found for caregiver_id: ${oldDocumentId}`)
    }
    
    console.log(`🎉 Successfully updated all caregiver records to use Firebase UID: ${newFirebaseUid}`)
  } catch (error) {
    console.error('❌ Error updating caregiver records with new Firebase UID:', error)
    throw error
  }
}

// Helper function to update patient and medical history records after Firebase Auth creation (same pattern as caregiver)
const updatePatientRecordsWithNewId = async (oldDocumentId: string, newFirebaseUid: string, accountRole: string): Promise<void> => {
  try {
    if (accountRole.toLowerCase() !== 'patient') {
      console.log('Not a patient account, skipping patient record updates')
      return
    }

    console.log(`🔗 Updating patient records: ${oldDocumentId} -> ${newFirebaseUid}`)
    
    // Update patient record - find by user_id (which should match the old user document ID)
    const patientsRef = collection(db, COLLECTIONS.PATIENTS)
    const patientQuery = query(patientsRef, where('user_id', '==', oldDocumentId))
    const patientSnapshot = await getDocs(patientQuery)
    
    if (!patientSnapshot.empty) {
      const patientDoc = patientSnapshot.docs[0]
      const patientData = patientDoc.data()
      const oldPatientId = patientData.patient_id // Store the old patient_id for updating related records
      
      console.log(`📋 Found patient record: ${patientDoc.id} with patient_id: ${oldPatientId} and user_id: ${oldDocumentId}`)
      
      // Create new patient record with Firebase UID as document ID and patient_id
      await setDoc(doc(db, COLLECTIONS.PATIENTS, newFirebaseUid), {
        ...patientData,
        patient_id: newFirebaseUid,
        user_id: newFirebaseUid, // Keep user_id matching Firebase UID for consistency
        updated_at: Timestamp.now()
      })
      
      // Delete the old patient record
      await deleteDoc(patientDoc.ref)
      
      console.log(`✅ Updated patient record: ${patientDoc.id} -> ${newFirebaseUid}`)
      
      // Update all medical_history records that reference the old patient_id
      const medHistoryRef = collection(db, COLLECTIONS.MEDICAL_HISTORY)
      const medHistoryQuery = query(medHistoryRef, where('patient_id', '==', oldPatientId))
      const medHistorySnapshot = await getDocs(medHistoryQuery)
      
      if (!medHistorySnapshot.empty) {
        const updatePromises = medHistorySnapshot.docs.map(medHistoryDoc => 
          updateDoc(medHistoryDoc.ref, {
            patient_id: newFirebaseUid,
            updated_at: Timestamp.now()
          })
        )
        
        await Promise.all(updatePromises)
        console.log(`✅ Updated ${medHistorySnapshot.size} medical history records to use new patient_id: ${newFirebaseUid}`)
      } else {
        console.log(`ℹ️ No medical history records found for patient_id: ${oldPatientId}`)
      }
      
      // Update all medication records that reference the old patient_id
      const medicationsRef = collection(db, COLLECTIONS.MEDICATIONS)
      const medicationsQuery = query(medicationsRef, where('patient_id', '==', oldPatientId))
      const medicationsSnapshot = await getDocs(medicationsQuery)
      
      if (!medicationsSnapshot.empty) {
        const updatePromises = medicationsSnapshot.docs.map(medicationDoc => 
          updateDoc(medicationDoc.ref, {
            patient_id: newFirebaseUid,
            updated_at: Timestamp.now()
          })
        )
        
        await Promise.all(updatePromises)
        console.log(`✅ Updated ${medicationsSnapshot.size} medication records to use new patient_id: ${newFirebaseUid}`)
      } else {
        console.log(`ℹ️ No medication records found for patient_id: ${oldPatientId}`)
      }
      
    } else {
      console.log(`⚠️ No patient record found with user_id: ${oldDocumentId}`)
    }
    
    console.log(`🎉 Successfully updated all patient records to use Firebase UID: ${newFirebaseUid}`)
  } catch (error) {
    console.error('❌ Error updating patient records with new Firebase UID:', error)
    throw error
  }
}

// Helper function to clean up duplicate user records with the same accountId
const cleanupDuplicateUsers = async (accountId: string): Promise<void> => {
  try {
    console.log('🧹 Cleaning up duplicate users for accountId:', accountId)
    
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('accountId', '==', accountId))
    const snapshot = await getDocs(q)
    
    if (snapshot.docs.length <= 1) {
      console.log('✅ No duplicates found for accountId:', accountId)
      return
    }
    
    console.log(`🔍 Found ${snapshot.docs.length} user records with same accountId`)
    
    // Find the original user record (the one with more complete data)
    let originalUserDoc = null
    let duplicateUserDocs = []
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data()
      
      // The original user should have role-specific fields indicating it's the complete record
      // For caregivers: contact_number, address, user_id, role = "Caregiver"
      // For patients/guardians: contact_number, address, user_id, role = "Patient" or guardian-related fields
      const hasCompleteData = userData.contact_number || 
                             userData.address || 
                             userData.user_id || 
                             (userData.role === 'Caregiver') ||
                             (userData.role === 'Patient') ||
                             userData.date_of_birth ||
                             userData.guardian_id
      
      if (hasCompleteData) {
        originalUserDoc = userDoc
        console.log(`📌 Found original user record (${userData.role || 'unknown role'}): ${userDoc.id}`)
      } else {
        duplicateUserDocs.push(userDoc)
        console.log(`🗑️ Found duplicate user record: ${userDoc.id}`)
      }
    }
    
    // Delete duplicate records
    for (const duplicateDoc of duplicateUserDocs) {
      await deleteDoc(duplicateDoc.ref)
      console.log(`✅ Deleted duplicate user record: ${duplicateDoc.id}`)
    }
    
    console.log(`🎉 Cleanup complete: kept 1 original, deleted ${duplicateUserDocs.length} duplicates`)
    
  } catch (error) {
    console.error('❌ Error cleaning up duplicate users:', error)
  }
}

// Create Firebase Auth user for verified and active accounts
export const createFirebaseAuthUser = async (account: Account): Promise<string | null> => {
  try {
    console.log('Creating Firebase Auth user for account:', account.id)
    
    // Create Firebase Auth user with generated credentials
    const auth = getAuth()
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      account.generated_email, 
      account.generated_password
    )
    
    const user = userCredential.user
    console.log('Firebase Auth user created:', user.uid)
    
    // Update the user's display name
    await updateProfile(user, {
      displayName: account.name
    })
    
    // Find existing user record that has the matching accountId
    try {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('accountId', '==', account.id))
      const snapshot = await getDocs(q)
      
      if (!snapshot.empty) {
        // Get the existing user data
        const existingUserDoc = snapshot.docs[0]
        const existingUserData = existingUserDoc.data()
        
        console.log(`Found existing user record: ${existingUserDoc.id}, moving to Firebase Auth UID: ${user.uid}`)
        
        // Create a new document with Firebase Auth UID as document ID
        await setDoc(doc(db, 'users', user.uid), {
          ...existingUserData,  // Keep all existing data
          uid: user.uid,        // Add Firebase Auth UID
          user_id: user.uid,    // Set user_id to match Firebase Auth UID for consistency
          auth_created: true,
          emailVerified: true,
          verified: true,
          updated_at: Timestamp.now()
        })
        
        // Update caregiver and shift records if this is a caregiver account
        await updateCaregiverRecordsWithNewId(existingUserDoc.id, user.uid, account.role)
        
        // Update patient and medical history records if this is a patient account
        await updatePatientRecordsWithNewId(existingUserDoc.id, user.uid, account.role)
        
        // Delete the old document (with the old document ID)
        await deleteDoc(existingUserDoc.ref)
        
        console.log(`✅ Moved user record from ${existingUserDoc.id} to ${user.uid} (Firebase Auth UID now matches document ID)`)
      } else {
        console.warn('⚠️ No existing user found with accountId:', account.id)
        // Fallback: create minimal user record with Firebase Auth UID as document ID
        const nameParts = account.name.split(' ').filter(part => part.trim() !== '')
        const first_name = nameParts[0] || ''
        const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
        const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          user_id: user.uid,  // Firebase Auth UID matches user_id and document ID
          first_name: first_name,
          middle_name: middle_name,
          last_name: last_name,
          email: account.generated_email,
          role: account.role,
          contact_number: '',
          address: '',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          is_active: true,
          emailVerified: true,
          accountId: account.id,
          auth_created: true,
          createdFrom: 'account-management'
        })
      }
      
    } catch (updateError) {
      console.error('Error updating existing user record:', updateError)
      // Fallback to original behavior if update fails
      const nameParts = account.name.split(' ').filter(part => part.trim() !== '')
      const first_name = nameParts[0] || ''
      const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
      const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        user_id: user.uid,  // Firebase Auth UID matches user_id and document ID
        first_name: first_name,
        middle_name: middle_name,
        last_name: last_name,
        email: account.generated_email,
        role: account.role,
        contact_number: '',
        address: '',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        is_active: true,
        emailVerified: true,
        accountId: account.id,
        auth_created: true,
        createdFrom: 'account-management'
      })
    }
    
    console.log('Firebase Auth user created and linked successfully - document ID matches Firebase Auth UID:', user.uid)
    
    // Clean up any duplicate user records (keep only the original user record)
    await cleanupDuplicateUsers(account.id)
    
    return user.uid
  } catch (error: any) {
    console.error('Error creating Firebase Auth user:', error)
    
    // If the error is that the email already exists, that's okay
    if (error.code === 'auth/email-already-in-use') {
      console.log('Firebase Auth user already exists for this email')
      // Try to find existing user by email via Admin SDK is not possible here; return null to indicate existing
      return null
    }
    
    throw new Error(`Failed to create Firebase Auth user: ${error.message}`)
  }
}

// Create a new account
export const createAccount = async (accountData: Omit<Account, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS)
    
    // Clean the data to remove undefined values (Firebase doesn't support undefined)
    const cleanedData: any = {
      email: accountData.email,
      generated_email: accountData.generated_email,
      generated_password: accountData.generated_password,
      name: accountData.name,
      role: accountData.role,
      status: accountData.status,
      verified: accountData.verified,
      createdAt: Timestamp.now()
    }

    // Only add optional fields if they have values (not undefined)
    if (accountData.verifiedAt !== undefined) {
      cleanedData.verifiedAt = accountData.verifiedAt
    }
    // Persist verification token if provided (used for one-click email verification)
    if ((accountData as any).verification_token !== undefined) {
      cleanedData.verification_token = (accountData as any).verification_token
    }
    if (accountData.lastLogin !== undefined) {
      cleanedData.lastLogin = accountData.lastLogin
    }
    if (accountData.password_changed !== undefined) {
      cleanedData.password_changed = accountData.password_changed
    }
    if (accountData.password_changed_at !== undefined) {
      cleanedData.password_changed_at = accountData.password_changed_at
    }
    if (accountData.suspended_at !== undefined) {
      cleanedData.suspended_at = accountData.suspended_at
    }
    if (accountData.suspension_reason !== undefined) {
      cleanedData.suspension_reason = accountData.suspension_reason
    }
    if (accountData.reactivated_at !== undefined) {
      cleanedData.reactivated_at = accountData.reactivated_at
    }
    
    const docRef = await addDoc(accountsRef, cleanedData)
    console.log('Account created with ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('Error creating account:', error)
    throw new Error('Failed to create account')
  }
}

// Get all accounts
export const getAccounts = async (): Promise<Account[]> => {
  try {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS)
    const q = query(accountsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)
    
    const accounts: Account[] = []
    querySnapshot.forEach((doc) => {
      accounts.push({
        id: doc.id,
        ...doc.data()
      } as Account)
    })
    
    return accounts
  } catch (error) {
    console.error('Error fetching accounts:', error)
    throw new Error('Failed to fetch accounts')
  }
}

// Get account by email
export const getAccountByEmail = async (email: string): Promise<Account | null> => {
  try {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS)
    const q = query(accountsRef, where('email', '==', email))
    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      return null
    }
    
    const doc = querySnapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data()
    } as Account
  } catch (error) {
    console.error('Error fetching account by email:', error)
    throw new Error('Failed to fetch account')
  }
}

// Get account by generated email (login email)
export const getAccountByGeneratedEmail = async (generatedEmail: string): Promise<Account | null> => {
  try {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS)
    const q = query(accountsRef, where('generated_email', '==', generatedEmail))
    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      return null
    }
    
    const doc = querySnapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data()
    } as Account
  } catch (error) {
    console.error('Error fetching account by generated email:', error)
    throw new Error('Failed to fetch account')
  }
}

// Update account
export const updateAccount = async (accountId: string, updates: Partial<Account>): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    
    // Get current account data to check status changes
    const currentAccountDoc = await getDoc(accountRef)
    const currentAccount = currentAccountDoc.exists() ? { 
      id: currentAccountDoc.id, 
      ...currentAccountDoc.data() 
    } as Account : null
    
    // Clean the updates to remove undefined values
    const cleanedUpdates: any = {}
    
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key]
      if (value !== undefined) {
        cleanedUpdates[key] = value
      }
    })
    
    // Always add updatedAt timestamp
    cleanedUpdates.updatedAt = Timestamp.now()
    
    await updateDoc(accountRef, cleanedUpdates)
    console.log('Account updated successfully')
    
    // Check if account becomes active and verified
    if (currentAccount) {
      const wasNotActiveOrVerified = currentAccount.status !== 'active' || !currentAccount.verified
      const isNowActiveAndVerified = (updates.status === 'active' || currentAccount.status === 'active') && 
                                   (updates.verified === true || currentAccount.verified === true)
      
      if (wasNotActiveOrVerified && isNowActiveAndVerified) {
        console.log('Account is now active and verified - creating Firebase Auth user')
        
        // Get updated account data
        const updatedAccount = {
          ...currentAccount,
          ...cleanedUpdates,
          id: accountId
        } as Account
        
        try {
          await createFirebaseAuthUser(updatedAccount)
          console.log('Firebase Auth user created successfully for account:', accountId)
        } catch (authError) {
          console.warn('Failed to create Firebase Auth user but account was updated:', authError)
          // Don't fail the account update if Firebase Auth creation fails
        }
      }
    }
    
  } catch (error) {
    console.error('Error updating account:', error)
    throw new Error('Failed to update account')
  }
}

// Delete account
export const deleteAccount = async (accountId: string): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    await deleteDoc(accountRef)
    console.log('Account deleted successfully')
  } catch (error) {
    console.error('Error deleting account:', error)
    throw new Error('Failed to delete account')
  }
}

// Verify account (used when user clicks confirmation link)
export const verifyAccount = async (accountId: string): Promise<void> => {
  try {
    let accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    let currentAccountDoc = await getDoc(accountRef)
    
    // If not found in accounts collection, try users collection (for existing caregivers)
    if (!currentAccountDoc.exists()) {
      console.log('Account not found in accounts collection, checking users collection...')
      accountRef = doc(db, 'users', accountId)
      currentAccountDoc = await getDoc(accountRef)
      
      if (!currentAccountDoc.exists()) {
        throw new Error('Account not found in either accounts or users collection')
      }
    }
    
    const currentAccount = { 
      id: currentAccountDoc.id, 
      ...currentAccountDoc.data() 
    } as Account
    
    // Update account to verified and active
    await updateDoc(accountRef, {
      verified: true,
      verifiedAt: Timestamp.now(),
      status: 'active'
    })
    
    console.log('Account verified successfully')
    
    // Create Firebase Auth user since account is now active and verified
    const updatedAccount = {
      ...currentAccount,
      verified: true,
      verifiedAt: Timestamp.now(),
      status: 'active' as const
    }
    
    try {
      await createFirebaseAuthUser(updatedAccount)
      console.log('Firebase Auth user created successfully for verified account:', accountId)
    } catch (authError) {
      console.warn('Failed to create Firebase Auth user but account was verified:', authError)
      // Don't fail the verification if Firebase Auth creation fails
    }
    
  } catch (error) {
    console.error('Error verifying account:', error)
    throw new Error('Failed to verify account')
  }
}

// Update account password (when user changes password)
export const updateAccountPassword = async (accountId: string, newPassword: string): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    await updateDoc(accountRef, {
      generated_password: newPassword,
      password_changed: true,
      password_changed_at: Timestamp.now()
    })
    console.log('Account password updated successfully')
  } catch (error) {
    console.error('Error updating account password:', error)
    throw new Error('Failed to update password')
  }
}

// Get accounts by role
export const getAccountsByRole = async (role: 'caregiver' | 'guardian'): Promise<Account[]> => {
  try {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS)
    const q = query(
      accountsRef, 
      where('role', '==', role),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    
    const accounts: Account[] = []
    querySnapshot.forEach((doc) => {
      accounts.push({
        id: doc.id,
        ...doc.data()
      } as Account)
    })
    
    return accounts
  } catch (error) {
    console.error('Error fetching accounts by role:', error)
    throw new Error('Failed to fetch accounts')
  }
}

// Suspend account
export const suspendAccount = async (accountId: string, reason?: string): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    await updateDoc(accountRef, {
      status: 'suspended',
      suspended_at: Timestamp.now(),
      suspension_reason: reason || 'No reason provided'
    })
    console.log('Account suspended successfully')
  } catch (error) {
    console.error('Error suspending account:', error)
    throw new Error('Failed to suspend account')
  }
}

// Reactivate account
export const reactivateAccount = async (accountId: string): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    
    // Get current account data
    const currentAccountDoc = await getDoc(accountRef)
    if (!currentAccountDoc.exists()) {
      throw new Error('Account not found')
    }
    
    const currentAccount = { 
      id: currentAccountDoc.id, 
      ...currentAccountDoc.data() 
    } as Account
    
    await updateDoc(accountRef, {
      status: 'active',
      reactivated_at: Timestamp.now(),
      suspension_reason: null
    })
    
    console.log('Account reactivated successfully')
    
    // If account is verified and now active, create Firebase Auth user
    if (currentAccount.verified) {
      const updatedAccount = {
        ...currentAccount,
        status: 'active' as const,
        reactivated_at: Timestamp.now(),
        suspension_reason: null
      }
      
      try {
        await createFirebaseAuthUser(updatedAccount)
        console.log('Firebase Auth user created for reactivated account:', accountId)
      } catch (authError) {
        console.warn('Failed to create Firebase Auth user but account was reactivated:', authError)
        // Don't fail the reactivation if Firebase Auth creation fails
      }
    }
    
  } catch (error) {
    console.error('Error reactivating account:', error)
    throw new Error('Failed to reactivate account')
  }
}

// Manually create Firebase Auth user for an account (admin function)
export const createFirebaseAuthForAccount = async (accountId: string): Promise<void> => {
  try {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId)
    const accountDoc = await getDoc(accountRef)
    
    if (!accountDoc.exists()) {
      throw new Error('Account not found')
    }
    
    const account = { 
      id: accountDoc.id, 
      ...accountDoc.data() 
    } as Account
    
    // Check if account is active and verified
    if (account.status !== 'active' || !account.verified) {
      throw new Error('Account must be active and verified to create Firebase Auth user')
    }
    
    await createFirebaseAuthUser(account)
    console.log('Firebase Auth user created manually for account:', accountId)
    
  } catch (error) {
    console.error('Error creating Firebase Auth user manually:', error)
    throw error
  }
}

// Batch create Firebase Auth users for all active and verified accounts
export const createFirebaseAuthForAllActiveAccounts = async (): Promise<{ success: number, errors: number }> => {
  try {
    console.log('Creating Firebase Auth users for all active and verified accounts...')
    
    const accounts = await getAccounts()
    const activeAndVerifiedAccounts = accounts.filter(account => 
      account.status === 'active' && account.verified
    )
    
    console.log(`Found ${activeAndVerifiedAccounts.length} active and verified accounts`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const account of activeAndVerifiedAccounts) {
      try {
        await createFirebaseAuthUser(account)
        successCount++
        console.log(`✅ Created Firebase Auth user for account: ${account.id}`)
      } catch (error: any) {
        errorCount++
        console.error(`❌ Failed to create Firebase Auth user for account ${account.id}:`, error.message)
      }
    }
    
    console.log(`Batch creation complete: ${successCount} success, ${errorCount} errors`)
    return { success: successCount, errors: errorCount }
    
  } catch (error) {
    console.error('Error in batch Firebase Auth creation:', error)
    throw error
  }
}
