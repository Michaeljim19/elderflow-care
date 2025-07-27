import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Development test account credentials
export const TEST_ACCOUNT = {
  email: 'test@elderflowcare.com',
  password: 'test123456',
  firstName: 'John',
  lastName: 'Doe',
  role: 'admin',
  phone: '+1 (555) 123-4567'
};

export const createTestAccount = async () => {
  try {
    console.log('Creating test account...');
    
    // Create the user account
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      TEST_ACCOUNT.email, 
      TEST_ACCOUNT.password
    );
    
    const user = userCredential.user;
    
    // Update the user's display name
    await updateProfile(user, {
      displayName: `${TEST_ACCOUNT.firstName} ${TEST_ACCOUNT.lastName}`
    });
    
    // Save additional user data to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      firstName: TEST_ACCOUNT.firstName,
      lastName: TEST_ACCOUNT.lastName,
      email: TEST_ACCOUNT.email,
      phone: TEST_ACCOUNT.phone,
      role: TEST_ACCOUNT.role,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'development-seed'
    });
    
    console.log('✅ Test account created successfully!');
    console.log('Email:', TEST_ACCOUNT.email);
    console.log('Password:', TEST_ACCOUNT.password);
    
    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  Test account already exists');
      console.log('Email:', TEST_ACCOUNT.email);
      console.log('Password:', TEST_ACCOUNT.password);
    } else {
      console.error('❌ Error creating test account:', error);
    }
    throw error;
  }
};

export const loginWithTestAccount = async () => {
  try {
    console.log('Logging in with test account...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      TEST_ACCOUNT.email,
      TEST_ACCOUNT.password
    );
    console.log('✅ Logged in successfully!');
    return userCredential.user;
  } catch (error) {
    console.error('❌ Error logging in with test account:', error);
    throw error;
  }
};

// Helper function to check if test account exists
export const testAccountExists = async (): Promise<boolean> => {
  try {
    await signInWithEmailAndPassword(auth, TEST_ACCOUNT.email, TEST_ACCOUNT.password);
    await auth.signOut(); // Sign out immediately after checking
    return true;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return false;
    }
    // If it's a wrong password or other auth error, account exists
    return true;
  }
};
