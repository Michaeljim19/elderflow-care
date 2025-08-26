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

// Create Firebase Auth user for verified and active accounts
const createFirebaseAuthUser = async (account: Account): Promise<void> => {
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
    
    // Save user data to Firestore users collection using Auth UID as document ID
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      firstName: account.name.split(' ')[0] || '',
      lastName: account.name.split(' ').slice(1).join(' ') || '',
      email: account.generated_email,
      role: account.role,
      createdAt: new Date().toISOString(),
      isActive: true,
      emailVerified: true,
      accountId: account.id, // Link to the account management record
      createdFrom: 'account-management'
    })
    
    console.log('Firebase Auth user created and linked successfully with UID as document ID:', user.uid)
    
  } catch (error: any) {
    console.error('Error creating Firebase Auth user:', error)
    
    // If the error is that the email already exists, that's okay
    if (error.code === 'auth/email-already-in-use') {
      console.log('Firebase Auth user already exists for this email')
      return
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
