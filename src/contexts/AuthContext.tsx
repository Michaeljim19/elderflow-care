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
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              ...firestoreData,
              // Ensure required fields are present
              firstName: firestoreData.firstName || 'Unknown',
              lastName: firestoreData.lastName || 'User',
              role: firestoreData.role || 'user',
              isActive: firestoreData.isActive !== undefined ? firestoreData.isActive : true
            } as UserData);
            console.log("AuthProvider: User data loaded from Firestore")
          } else {
            // If no Firestore document exists, create basic user data
            console.log("AuthProvider: No Firestore doc, using basic user data")
            const displayNameParts = firebaseUser.displayName?.split(' ') || [];
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              firstName: displayNameParts[0] || 'Unknown',
              lastName: displayNameParts.slice(1).join(' ') || 'User',
              role: 'user',
              isActive: true
            });
          }
        } catch (error) {
          console.error('AuthProvider: Error fetching user data:', error);
          // Create fallback user data even on error
          const displayNameParts = firebaseUser.displayName?.split(' ') || [];
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            firstName: displayNameParts[0] || 'Unknown',
            lastName: displayNameParts.slice(1).join(' ') || 'User',
            role: 'user',
            isActive: true
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
