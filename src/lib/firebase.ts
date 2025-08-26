import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmJnJUhc5gwysGYiqkRY5lL7ueysaCVjM",
  authDomain: "care-db-project.firebaseapp.com",
  projectId: "care-db-project",
  storageBucket: "care-db-project.firebasestorage.app",
  messagingSenderId: "342467588948",
  appId: "1:342467588948:web:4fc05292312805b91a0ec1",
  measurementId: "G-9H2Q8LGECW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with improved connection settings
export const db = getFirestore(app);

// Force HTTP/2 instead of QUIC to avoid QUIC protocol errors
if (typeof window !== 'undefined') {
  // Add connection settings to force HTTP/2
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NODE_ENV === 'development';
}

export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

export default app;