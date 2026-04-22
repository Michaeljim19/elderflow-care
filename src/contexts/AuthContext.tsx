import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeName = (source: Record<string, any> | null | undefined, fallbackDisplayName?: string) => {
  const displayNameParts = fallbackDisplayName?.split(' ').filter(Boolean) || [];

  return {
    firstName:
      source?.firstName ||
      source?.first_name ||
      source?.first_name?.trim?.() ||
      displayNameParts[0] ||
      'Unknown',
    lastName:
      source?.lastName ||
      source?.last_name ||
      source?.last_name?.trim?.() ||
      displayNameParts.slice(1).join(' ') ||
      'User'
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener")
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: Auth state changed", firebaseUser ? "User logged in" : "No user")
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch additional user data from Firestore
        try {
          console.log("AuthProvider: Fetching user data from Firestore")
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            console.log("AuthProvider: Firestore data:", firestoreData);
            const { firstName, lastName } = normalizeName(firestoreData, firebaseUser.displayName || undefined);
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              ...firestoreData,
              // Ensure required fields are present
              firstName,
              lastName,
              role: firestoreData.role || 'user',
              isActive: firestoreData.isActive !== undefined ? firestoreData.isActive : true
            } as UserData);
            console.log("AuthProvider: User data loaded from Firestore")
          } else {
            // If no Firestore document exists, keep the user blocked until provisioned
            console.log("AuthProvider: No Firestore doc, marking account inactive")
            const { firstName, lastName } = normalizeName(null, firebaseUser.displayName || undefined);
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              firstName,
              lastName,
              role: 'user',
              isActive: false
            });
          }
        } catch (error) {
          console.error('AuthProvider: Error fetching user data:', error);
          // Keep fallback user data inactive on error so access is not granted by mistake
          const { firstName, lastName } = normalizeName(null, firebaseUser.displayName || undefined);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            firstName,
            lastName,
            role: 'user',
            isActive: false
          });
        }
      } else {
        console.log("AuthProvider: No user, clearing state")
        setUser(null);
        setUserData(null);
      }
      console.log("AuthProvider: Setting loading to false")
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('theme', 'light')
        window.document.documentElement.classList.remove('dark')
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    userData,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
