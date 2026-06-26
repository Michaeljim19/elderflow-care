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
import { getMaxPatientsForShift } from '../../types'
import type { Account } from '../../types'
import { buildApprovedCaregiverState, buildCaregiverAddressFields } from './caregiverRecordSync'
import { normalizePatientDocumentId } from './patientRecordSync'

const normalizeIdentityKey = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

const normalizeUserRole = (value: unknown): string => {
  const normalized = normalizeIdentityKey(value)
  if (!normalized) {
    return ''
  }

  if (normalized === 'user') {
    return ''
  }

  return normalized
}

const resolveMustChangePassword = (...sources: Array<Record<string, any> | null | undefined>): boolean => {
  for (const source of sources) {
    if (!source) continue
    if (typeof source.mustChangePassword === 'boolean') return source.mustChangePassword
    if (typeof source.must_change_password === 'boolean') return source.must_change_password
  }

  return true
}

const buildMustChangePasswordFields = (mustChangePassword = true) => ({
  mustChangePassword,
  must_change_password: mustChangePassword
})

const doesUserDocMatchAccountRole = (account: Account, userData: Record<string, any>, documentId: string, canonicalUserId: string): boolean => {
  if (documentId === canonicalUserId) {
    return true
  }

  const targetRole = normalizeUserRole(account.role)
  if (!targetRole) {
    return true
  }

  const userRole = normalizeUserRole(userData.role)
  const legacyRole = normalizeUserRole(userData.user_lvl)
  const roleCandidates = [userRole, legacyRole].filter(Boolean)

  if (roleCandidates.length === 0) {
    return false
  }

  return roleCandidates.includes(targetRole)
}

// Helper function to update caregiver and related records after Firebase Auth creation
const updateCaregiverRecordsWithNewId = async (
  oldDocumentId: string,
  newFirebaseUid: string,
  account: Account,
  fallbackData?: Record<string, any>
): Promise<void> => {
  try {
    if (String(account.role || '').toLowerCase() !== 'caregiver') {
      console.log('Not a caregiver account, skipping caregiver record updates')
      return
    }

    console.log(`🔗 Updating caregiver records: ${oldDocumentId} -> ${newFirebaseUid}`)

    const caregiversSnapshot = await getDocs(collection(db, COLLECTIONS.CAREGIVERS))
    const accountEmailCandidates = [account.email, account.generated_email]
      .map(normalizeIdentityKey)
      .filter(Boolean)
    const legacyIdSet = new Set(
      [
        account.id,
        oldDocumentId,
        fallbackData?.accountId,
        fallbackData?.caregiver_id,
        fallbackData?.user_id,
        fallbackData?.uid,
        fallbackData?.auth_uid
      ]
        .map(normalizeIdentityKey)
        .filter(Boolean)
    )

    const matchingCaregiverDocs = caregiversSnapshot.docs.filter((caregiverDoc) => {
      const caregiverData = caregiverDoc.data() as Record<string, any>
      const docIdentifiers = [
        caregiverDoc.id,
        caregiverData.accountId,
        caregiverData.caregiver_id,
        caregiverData.user_id,
        caregiverData.uid,
        caregiverData.auth_uid
      ]
        .map(normalizeIdentityKey)
        .filter(Boolean)

      if (docIdentifiers.some(identifier => legacyIdSet.has(identifier))) {
        return true
      }

      const caregiverEmails = [caregiverData.email, caregiverData.generated_email]
        .map(normalizeIdentityKey)
        .filter(Boolean)

      if (accountEmailCandidates.some(email => caregiverEmails.includes(email))) {
        return true
      }

      return false
    })

    const sourceCaregiverDoc = matchingCaregiverDocs.sort((a, b) => {
      const aScore = Object.keys(a.data() || {}).length
      const bScore = Object.keys(b.data() || {}).length
      return bScore - aScore
    })[0]

    const sourceCaregiverData = (sourceCaregiverDoc?.data() as Record<string, any>) || fallbackData || {}
    const addressFields = buildCaregiverAddressFields(sourceCaregiverData)
    const {
      generated_password,
      verification_token,
      password_changed,
      password_changed_at,
      suspended_at,
      suspension_reason,
      reactivated_at,
      verifiedAt,
      accountId,
      ...safeSourceCaregiverData
    } = sourceCaregiverData as Record<string, any>

    const migratedCaregiverData = {
      ...safeSourceCaregiverData,
      ...addressFields,
      ...buildApprovedCaregiverState(),
      accountId: sourceCaregiverData.accountId || account.id,
      caregiver_id: newFirebaseUid,
      user_id: newFirebaseUid,
      uid: newFirebaseUid,
      auth_uid: newFirebaseUid,
      legacy_caregiver_id: oldDocumentId,
      updated_at: Timestamp.now()
    }

    await setDoc(doc(db, COLLECTIONS.CAREGIVERS, newFirebaseUid), migratedCaregiverData, { merge: true })

    const migratedIdSet = new Set(
      [
        sourceCaregiverData.accountId,
        oldDocumentId,
        sourceCaregiverDoc?.id,
        sourceCaregiverData.caregiver_id,
        sourceCaregiverData.user_id,
        sourceCaregiverData.uid,
        sourceCaregiverData.auth_uid
      ]
        .map(normalizeIdentityKey)
        .filter(Boolean)
    )

    const updateDocsInCollection = async (
      collectionName: string,
      updater: (data: Record<string, any>) => Record<string, any> | null
    ) => {
      const snapshot = await getDocs(collection(db, collectionName))

      const updatePromises = snapshot.docs.map(async (recordDoc) => {
        const recordData = recordDoc.data() as Record<string, any>
        const updatePayload = updater(recordData)

        if (!updatePayload) {
          return
        }

        await updateDoc(recordDoc.ref, updatePayload)
      })

      await Promise.all(updatePromises)
    }

    await updateDocsInCollection(COLLECTIONS.CAREGIVER_SHIFTS, (shiftData) => {
      if (!migratedIdSet.has(normalizeIdentityKey(shiftData.caregiver_id))) {
        return null
      }

      return {
        caregiver_id: newFirebaseUid,
        updated_at: Timestamp.now()
      }
    })

    await updateDocsInCollection(COLLECTIONS.PATIENTS, (patientData) => {
      const updates: Record<string, any> = {}
      let hasChanges = false

      if (migratedIdSet.has(normalizeIdentityKey(patientData.assigned_caregiver_id))) {
        updates.assigned_caregiver_id = newFirebaseUid
        hasChanges = true
      }

      if (migratedIdSet.has(normalizeIdentityKey(patientData.assigned_day_caregiver_id))) {
        updates.assigned_day_caregiver_id = newFirebaseUid
        hasChanges = true
      }

      if (migratedIdSet.has(normalizeIdentityKey(patientData.assigned_night_caregiver_id))) {
        updates.assigned_night_caregiver_id = newFirebaseUid
        hasChanges = true
      }

      if (!hasChanges) {
        return null
      }

      updates.updated_at = Timestamp.now()
      return updates
    })

    await updateDocsInCollection(COLLECTIONS.REMINDERS, (reminderData) => {
      const updates: Record<string, any> = {}
      let hasChanges = false

      if (migratedIdSet.has(normalizeIdentityKey(reminderData.caregiverRef))) {
        updates.caregiverRef = newFirebaseUid
        hasChanges = true
      }

      if (migratedIdSet.has(normalizeIdentityKey(reminderData.userId))) {
        updates.userId = newFirebaseUid
        hasChanges = true
      }

      if (!hasChanges) {
        return null
      }

      updates.updated_at = Timestamp.now()
      return updates
    })

    await updateDocsInCollection(COLLECTIONS.HANDOVER_REPORTS, (reportData) => {
      if (!migratedIdSet.has(normalizeIdentityKey(reportData.caregiver_id))) {
        return null
      }

      return {
        caregiver_id: newFirebaseUid,
        updated_at: Timestamp.now()
      }
    })

    for (const caregiverDoc of matchingCaregiverDocs) {
      if (normalizeIdentityKey(caregiverDoc.id) === normalizeIdentityKey(newFirebaseUid)) {
        continue
      }

      await deleteDoc(caregiverDoc.ref)
      console.log(`🗑️ Removed legacy caregiver document: ${caregiverDoc.id}`)
    }

    console.log(`🎉 Successfully updated caregiver records to use Firebase UID: ${newFirebaseUid}`)
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

    const canonicalPatientId = normalizePatientDocumentId(newFirebaseUid)
    console.log(`🔗 Updating patient records: ${oldDocumentId} -> ${canonicalPatientId}`)
    
    // Update patient record - find by user_id (which should match the old user document ID)
    const patientsRef = collection(db, COLLECTIONS.PATIENTS)
    const patientQuery = query(patientsRef, where('user_id', '==', oldDocumentId))
    const patientSnapshot = await getDocs(patientQuery)
    
    if (!patientSnapshot.empty) {
      const patientDoc = patientSnapshot.docs[0]
      const patientData = patientDoc.data()
      const oldPatientId = patientData.patient_id // Store the old patient_id for updating related records
      const mustChangePassword = resolveMustChangePassword(patientData)
      
      console.log(`📋 Found patient record: ${patientDoc.id} with patient_id: ${oldPatientId} and user_id: ${oldDocumentId}`)
      
      // Create new patient record with the canonical patient-prefixed document ID
      await setDoc(doc(db, COLLECTIONS.PATIENTS, canonicalPatientId), {
        ...patientData,
        patient_id: canonicalPatientId,
        user_id: canonicalPatientId,
        auth_uid: newFirebaseUid,
        ...buildMustChangePasswordFields(mustChangePassword),
        updated_at: Timestamp.now()
      })
      
      // Delete the old patient record
      await deleteDoc(patientDoc.ref)
      
      console.log(`✅ Updated patient record: ${patientDoc.id} -> ${canonicalPatientId}`)
      
      // Update all medical_history records that reference the old patient_id
      const medHistoryRef = collection(db, COLLECTIONS.MEDICAL_HISTORY)
      const medHistoryQuery = query(medHistoryRef, where('patient_id', '==', oldPatientId))
      const medHistorySnapshot = await getDocs(medHistoryQuery)
      
      if (!medHistorySnapshot.empty) {
        const updatePromises = medHistorySnapshot.docs.map(medHistoryDoc => 
          updateDoc(medHistoryDoc.ref, {
            patient_id: canonicalPatientId,
            updated_at: Timestamp.now()
          })
        )
        
        await Promise.all(updatePromises)
        console.log(`✅ Updated ${medHistorySnapshot.size} medical history records to use new patient_id: ${canonicalPatientId}`)
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
            patient_id: canonicalPatientId,
            updated_at: Timestamp.now()
          })
        )
        
        await Promise.all(updatePromises)
        console.log(`✅ Updated ${medicationsSnapshot.size} medication records to use new patient_id: ${canonicalPatientId}`)
      } else {
        console.log(`ℹ️ No medication records found for patient_id: ${oldPatientId}`)
      }
      
    } else {
      console.log(`⚠️ No patient record found with user_id: ${oldDocumentId}`)
    }
    
    console.log(`🎉 Successfully updated all patient records to use canonical patient ID: ${canonicalPatientId}`)
  } catch (error) {
    console.error('❌ Error updating patient records with new Firebase UID:', error)
    throw error
  }
}

// Helper function to clean up duplicate user records with the same accountId
const cleanupDuplicateUsers = async (account: Account, canonicalUserId: string): Promise<void> => {
  try {
    console.log('🧹 Cleaning up duplicate users for accountId:', account.id)
    
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('accountId', '==', account.id))
    const snapshot = await getDocs(q)

    const targetDocs = snapshot.docs.filter(userDoc => {
      const userData = userDoc.data() as Record<string, any>
      return doesUserDocMatchAccountRole(account, userData, userDoc.id, canonicalUserId)
    })

    const ignoredDocs = snapshot.docs.filter(userDoc => !targetDocs.includes(userDoc))

    ignoredDocs.forEach((ignoredDoc) => {
      const ignoredData = ignoredDoc.data() as Record<string, any>
      console.warn(`⚠️ Skipping cross-role user doc during duplicate cleanup: ${ignoredDoc.id} (role=${ignoredData.role || ignoredData.user_lvl || 'unknown'})`)
    })
    
    if (targetDocs.length <= 1) {
      console.log('✅ No duplicates found for accountId:', account.id)
      return
    }
    
    console.log(`🔍 Found ${targetDocs.length} role-matched user records with same accountId`)
    
    // Find the original user record (the one with more complete data)
    let originalUserDoc = null
    let duplicateUserDocs = []
    
    for (const userDoc of targetDocs) {
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
      
      if (userDoc.id === canonicalUserId) {
        originalUserDoc = userDoc
        console.log(`📌 Keeping canonical user record: ${userDoc.id}`)
      } else if (hasCompleteData) {
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

const cleanupLegacyUserDocsForAccount = async (account: Account, canonicalUserId: string): Promise<void> => {
  try {
    const usersRef = collection(db, 'users')
    const candidateQueries = [
      query(usersRef, where('accountId', '==', account.id)),
      query(usersRef, where('generated_email', '==', account.generated_email)),
      query(usersRef, where('email', '==', account.generated_email)),
      query(usersRef, where('email', '==', account.email))
    ]

    const documentIdsToDelete = new Set<string>()

    for (const candidateQuery of candidateQueries) {
      const snapshot = await getDocs(candidateQuery)
      snapshot.docs.forEach((userDoc) => {
        const userData = userDoc.data() as Record<string, any>

        if (!doesUserDocMatchAccountRole(account, userData, userDoc.id, canonicalUserId)) {
          console.warn(`⚠️ Skipping cross-role legacy user doc: ${userDoc.id} (role=${userData.role || userData.user_lvl || 'unknown'})`)
          return
        }

        if (userDoc.id !== canonicalUserId) {
          documentIdsToDelete.add(userDoc.id)
        }
      })
    }

    for (const documentId of documentIdsToDelete) {
      await deleteDoc(doc(db, 'users', documentId))
      console.log(`🗑️ Removed legacy user document: ${documentId}`)
    }

    if (documentIdsToDelete.size === 0) {
      console.log(`ℹ️ No legacy user documents found for account ${account.id} beyond canonical ${canonicalUserId}`)
    }
  } catch (error) {
    console.error('❌ Error cleaning up legacy user documents:', error)
    throw error
  }
}

const findExistingUserDocForAccount = async (account: Account) => {
  const usersRef = collection(db, 'users')

  const queries = [
    query(usersRef, where('accountId', '==', account.id))
  ]

  if (account.role === 'caregiver') {
    queries.push(
      query(usersRef, where('generated_email', '==', account.generated_email)),
      query(usersRef, where('email', '==', account.email)),
      query(usersRef, where('email', '==', account.generated_email))
    )
  }

  for (const candidateQuery of queries) {
    const snapshot = await getDocs(candidateQuery)
    if (!snapshot.empty) {
      return snapshot.docs[0]
    }
  }

  return null
}

const findExistingCaregiverDocForAccount = async (account: Account) => {
  const caregiversRef = collection(db, COLLECTIONS.CAREGIVERS)

  const queries = [
    query(caregiversRef, where('accountId', '==', account.id)),
    query(caregiversRef, where('caregiver_id', '==', account.id)),
    query(caregiversRef, where('user_id', '==', account.id)),
    query(caregiversRef, where('uid', '==', account.id)),
    query(caregiversRef, where('auth_uid', '==', account.id))
  ]

  if (String(account.role || '').toLowerCase() === 'caregiver') {
    queries.push(
      query(caregiversRef, where('generated_email', '==', account.generated_email)),
      query(caregiversRef, where('email', '==', account.email)),
      query(caregiversRef, where('email', '==', account.generated_email))
    )
  }

  for (const candidateQuery of queries) {
    const snapshot = await getDocs(candidateQuery)
    if (!snapshot.empty) {
      return snapshot.docs[0]
    }
  }

  return null
}

const findExistingPatientDocForAccount = async (account: Account) => {
  const patientsRef = collection(db, COLLECTIONS.PATIENTS)

  const queries = [
    query(patientsRef, where('accountId', '==', account.id)),
    query(patientsRef, where('patient_id', '==', account.id)),
    query(patientsRef, where('user_id', '==', account.id)),
    query(patientsRef, where('uid', '==', account.id)),
    query(patientsRef, where('auth_uid', '==', account.id))
  ]

  if (String(account.role || '').toLowerCase() === 'patient') {
    queries.push(
      query(patientsRef, where('generated_email', '==', account.generated_email)),
      query(patientsRef, where('email', '==', account.email)),
      query(patientsRef, where('email', '==', account.generated_email))
    )
  }

  for (const candidateQuery of queries) {
    const snapshot = await getDocs(candidateQuery)
    if (!snapshot.empty) {
      return snapshot.docs[0]
    }
  }

  return null
}

// Create Firebase Auth user for verified and active accounts
export const createFirebaseAuthUser = async (account: Account): Promise<string | null> => {
  try {
    console.log('Creating Firebase Auth user for account:', account.id)
    const isCaregiverAccount = String(account.role || '').toLowerCase() === 'caregiver'
    const isPatientAccount = String(account.role || '').toLowerCase() === 'patient'
    
    // Create Firebase Auth user with generated credentials
    const auth = getAuth()
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      account.generated_email, 
      account.generated_password
    )
    
    const user = userCredential.user
    console.log('Firebase Auth user created:', user.uid)
      const canonicalPatientId = isPatientAccount ? normalizePatientDocumentId(user.uid) : user.uid
    const buildAddressPayload = (sourceData: any) => buildCaregiverAddressFields(sourceData)

    const buildCaregiverMirror = (sourceData: any, fallbackName: string) => ({
      caregiver_id: user.uid,
      user_id: user.uid,
      first_name: sourceData.first_name || fallbackName.split(' ')[0] || '',
      middle_name: sourceData.middle_name || '',
      last_name: sourceData.last_name || fallbackName.split(' ').slice(1).join(' ') || '',
      email: sourceData.email || account.generated_email,
      contact_number: typeof sourceData.contact_number === 'number'
        ? sourceData.contact_number
        : (sourceData.contact_number ? Number(sourceData.contact_number) : (sourceData.phone ? Number(sourceData.phone) : 0)),
      ...buildAddressPayload(sourceData),
      shift_type: sourceData.shift_type || 'Day',
      shift_start_date: sourceData.shift_start_date || null,
      shift_end_date: sourceData.shift_end_date || null,
      role: sourceData.role || 'Eldercare',
      assigned_patients_count: sourceData.assigned_patients_count || 0,
      max_patients: sourceData.max_patients || getMaxPatientsForShift(sourceData.shift_type || 'Day'),
      status: sourceData.status || 'Active',
      license_number: sourceData.license_number || '',
      license_picture: sourceData.license_picture || sourceData.license_image_base64 || '',
      contract_start_date: sourceData.contract_start_date,
      contract_end_date: sourceData.contract_end_date,
      specialization: sourceData.specialization,
      birthday: sourceData.birthday || sourceData.birthdate || sourceData.date_of_birth,
      created_at: sourceData.created_at || Timestamp.now(),
      updated_at: Timestamp.now()
    })

    const mirrorCaregiverRecord = async (sourceData: any, fallbackName: string, targetDocId: string = user.uid) => {
      if (String(account.role || '').toLowerCase() !== 'caregiver') {
        return
      }

      await setDoc(doc(db, 'caregivers', targetDocId), buildCaregiverMirror(sourceData, fallbackName), { merge: true })
      console.log(`✅ Mirrored caregiver record to caregivers/${targetDocId}`)
    }
    
    // Update the user's display name
    await updateProfile(user, {
      displayName: account.name
    })
    
    // Find existing user record that has the matching accountId or caregiver email
    try {
      const existingUserDoc = await findExistingUserDocForAccount(account)

      if (existingUserDoc) {
        // Get the existing user data
        const existingUserData = existingUserDoc.data()
        const canonicalUserId = existingUserDoc.id
        const addressFields = buildCaregiverAddressFields(existingUserData)
        
        console.log(`Found existing user record: ${existingUserDoc.id}, moving to Firebase Auth UID: ${user.uid}`)

        if (isCaregiverAccount) {
          // Move caregiver/user records to the Firebase Auth UID so every identifier matches.
          await setDoc(doc(db, 'users', user.uid), {
            ...existingUserData,
            ...addressFields,
            address: existingUserData.address || JSON.stringify(addressFields.address),
            accountId: existingUserData.accountId || account.id,
            uid: user.uid,
            auth_uid: user.uid,
            user_id: user.uid,
            ...buildApprovedCaregiverState(),
            auth_created: true,
            emailVerified: true,
            verified: true,
            updated_at: Timestamp.now()
          }, { merge: true })

          await updateCaregiverRecordsWithNewId(canonicalUserId, user.uid, account, existingUserData)

          if (canonicalUserId !== user.uid) {
            await deleteDoc(doc(db, 'users', canonicalUserId))
          }

          console.log(`✅ Moved caregiver/user document ID to Firebase Auth UID: ${user.uid}`)
        } else if (isPatientAccount) {
          const canonicalPatientId = normalizePatientDocumentId(user.uid)
          const legacyPatientDoc = await findExistingPatientDocForAccount(account)
          const legacyPatientData = legacyPatientDoc?.data() as Record<string, any> | undefined
          const mustChangePassword = resolveMustChangePassword(existingUserData, legacyPatientData)

          await setDoc(doc(db, 'users', canonicalPatientId), {
            ...existingUserData,
            uid: canonicalPatientId,
            user_id: canonicalPatientId,
            auth_uid: user.uid,
            birthdate: legacyPatientData?.birthdate || legacyPatientData?.birthday || existingUserData.birthdate || existingUserData.birthday,
            gender: legacyPatientData?.gender || existingUserData.gender,
            ...buildMustChangePasswordFields(mustChangePassword),
            is_active: true,
            status: 'active',
            auth_created: true,
            emailVerified: true,
            verified: true,
            updated_at: Timestamp.now()
          }, { merge: true })

          await updatePatientRecordsWithNewId(existingUserDoc.id, user.uid, account.role)

          if (existingUserDoc.id !== canonicalPatientId) {
            await deleteDoc(existingUserDoc.ref)
          }

          console.log(`✅ Moved patient/user document ID to canonical patient ID: ${canonicalPatientId}`)
        } else {
          // Create a new document with Firebase Auth UID as document ID
          await setDoc(doc(db, 'users', user.uid), {
            ...existingUserData,  // Keep all existing data
            uid: user.uid,        // Add Firebase Auth UID
            user_id: user.uid,    // Set user_id to match Firebase Auth UID for consistency
            is_active: true,
            status: 'active',
            auth_created: true,
            emailVerified: true,
            verified: true,
            updated_at: Timestamp.now()
          })

          await mirrorCaregiverRecord(existingUserData, account.name)
          
          // Update caregiver and shift records if this is a caregiver account
          await updateCaregiverRecordsWithNewId(existingUserDoc.id, user.uid, account, existingUserData)
          
          // Update patient and medical history records if this is a patient account
          await updatePatientRecordsWithNewId(existingUserDoc.id, user.uid, account.role)
          
          // Delete the old document (with the old document ID)
          await deleteDoc(existingUserDoc.ref)
          
          console.log(`✅ Moved user record from ${existingUserDoc.id} to ${user.uid} (Firebase Auth UID now matches document ID)`)
        }
      } else if (isCaregiverAccount) {
        const legacyCaregiverDoc = await findExistingCaregiverDocForAccount(account)

        if (!legacyCaregiverDoc) {
          throw new Error(`No existing caregiver document found for account ${account.id}. Refusing to create a new one.`)
        }

        const legacyCaregiverData = legacyCaregiverDoc.data() as Record<string, any>
        const addressFields = buildCaregiverAddressFields(legacyCaregiverData)

        await setDoc(doc(db, 'users', user.uid), {
          ...legacyCaregiverData,
          ...addressFields,
          address: legacyCaregiverData.address || JSON.stringify(addressFields.address),
          uid: user.uid,
          user_id: user.uid,
          auth_uid: user.uid,
          accountId: account.id,
          ...buildApprovedCaregiverState(),
          auth_created: true,
          emailVerified: true,
          verified: true,
          updated_at: Timestamp.now()
        }, { merge: true })

        await updateCaregiverRecordsWithNewId(legacyCaregiverDoc.id, user.uid, account, legacyCaregiverData)

        console.log(`✅ Rehydrated caregiver-only record ${legacyCaregiverDoc.id} into users/${user.uid} and caregivers/${user.uid}`)
      } else if (isPatientAccount) {
        const legacyPatientDoc = await findExistingPatientDocForAccount(account)

        const canonicalPatientId = normalizePatientDocumentId(user.uid)

        if (!legacyPatientDoc) {
          const nameParts = account.name.split(' ').filter(part => part.trim() !== '')
          const first_name = nameParts[0] || ''
          const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
          const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

          await setDoc(doc(db, 'users', canonicalPatientId), {
            uid: canonicalPatientId,
            user_id: canonicalPatientId,
            auth_uid: user.uid,
            first_name,
            middle_name,
            last_name,
            email: account.generated_email,
            role: account.role,
            contact_number: '',
            address: '',
            ...buildMustChangePasswordFields(true),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            is_active: true,
            status: 'active',
            emailVerified: true,
            accountId: account.id,
            auth_created: true,
            createdFrom: 'account-management'
          })

          await setDoc(doc(db, COLLECTIONS.PATIENTS, canonicalPatientId), {
            patient_id: canonicalPatientId,
            user_id: canonicalPatientId,
            auth_uid: user.uid,
            first_name,
            middle_name,
            last_name,
            email: account.generated_email,
            role: account.role,
            contact_number: '',
            address: '',
            ...buildMustChangePasswordFields(true),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            is_active: true,
            status: 'active',
            emailVerified: true,
            accountId: account.id,
            auth_created: true,
            createdFrom: 'account-management'
          }, { merge: true })
        } else {
          const legacyPatientData = legacyPatientDoc.data() as Record<string, any>
          const mustChangePassword = resolveMustChangePassword(legacyPatientData)

          await setDoc(doc(db, 'users', canonicalPatientId), {
            ...legacyPatientData,
            uid: canonicalPatientId,
            user_id: canonicalPatientId,
            auth_uid: user.uid,
            accountId: legacyPatientData.accountId || account.id,
            ...buildMustChangePasswordFields(mustChangePassword),
            is_active: true,
            status: 'active',
            auth_created: true,
            emailVerified: true,
            verified: true,
            updated_at: Timestamp.now()
          }, { merge: true })

          await updatePatientRecordsWithNewId(legacyPatientDoc.id, user.uid, account.role)

          console.log(`✅ Rehydrated patient-only record ${legacyPatientDoc.id} into users/${canonicalPatientId} and patients/${canonicalPatientId}`)
        }
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
          status: 'active',
          emailVerified: true,
          accountId: account.id,
          auth_created: true,
          createdFrom: 'account-management'
        })

        await mirrorCaregiverRecord({
          first_name,
          middle_name,
          last_name,
          email: account.generated_email,
          role: account.role
        }, account.name)
      }
      
    } catch (updateError) {
      console.error('Error updating existing user record:', updateError)

      if (isCaregiverAccount) {
        throw updateError
      }

      if (isPatientAccount) {
        const canonicalPatientId = normalizePatientDocumentId(user.uid)
        const legacyPatientDoc = await findExistingPatientDocForAccount(account)
        const legacyPatientData = legacyPatientDoc?.data() as Record<string, any> | undefined
        const mustChangePassword = resolveMustChangePassword(legacyPatientData)
        const nameParts = account.name.split(' ').filter(part => part.trim() !== '')
        const first_name = nameParts[0] || ''
        const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
        const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

        await setDoc(doc(db, 'users', canonicalPatientId), {
          uid: canonicalPatientId,
          user_id: canonicalPatientId,
          auth_uid: user.uid,
          first_name: first_name,
          middle_name: middle_name,
          last_name: last_name,
          email: account.generated_email,
          role: account.role,
          contact_number: '',
          address: '',
          birthdate: legacyPatientData?.birthdate || legacyPatientData?.birthday,
          birthday: legacyPatientData?.birthdate || legacyPatientData?.birthday,
          gender: legacyPatientData?.gender,
          ...buildMustChangePasswordFields(mustChangePassword),
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          is_active: true,
          status: 'active',
          emailVerified: true,
          accountId: account.id,
          auth_created: true,
          createdFrom: 'account-management'
        })

        await setDoc(doc(db, COLLECTIONS.PATIENTS, canonicalPatientId), {
          patient_id: canonicalPatientId,
          user_id: canonicalPatientId,
          auth_uid: user.uid,
          first_name: first_name,
          middle_name: middle_name,
          last_name: last_name,
          email: account.generated_email,
          role: account.role,
          contact_number: '',
          address: '',
          birthdate: legacyPatientData?.birthdate || legacyPatientData?.birthday,
          birthday: legacyPatientData?.birthdate || legacyPatientData?.birthday,
          gender: legacyPatientData?.gender,
          ...buildMustChangePasswordFields(mustChangePassword),
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          is_active: true,
          status: 'active',
          emailVerified: true,
          accountId: account.id,
          auth_created: true,
          createdFrom: 'account-management'
        }, { merge: true })

        console.log(`✅ Fallback patient record written using canonical ID: ${canonicalPatientId}`)
      }

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
        status: 'active',
        emailVerified: true,
        accountId: account.id,
        auth_created: true,
        createdFrom: 'account-management'
      })

      await mirrorCaregiverRecord({
        first_name,
        middle_name,
        last_name,
        email: account.generated_email,
        role: account.role
      }, account.name)
    }
    
    console.log('Firebase Auth user created and linked successfully - document ID matches Firebase Auth UID:', user.uid)

    await cleanupLegacyUserDocsForAccount(account, canonicalPatientId)
    
    // Clean up any duplicate user records (keep only the original user record)
    await cleanupDuplicateUsers(account, canonicalPatientId)
    
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
