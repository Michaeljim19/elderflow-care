
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

const VerifyAccount = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'invalid' | 'error'>('loading');

  useEffect(() => {
    const verify = async () => {
      const token = searchParams.get("token");
      const email = searchParams.get("email");
      if (!token || !email) {
        setStatus('invalid');
        return;
      }
      try {
        // Find user by email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('generated_email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setStatus('invalid');
          return;
        }
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        if (userData.verification_token === token) {
          // Mark as verified and clear the token
          await updateDoc(doc(db, 'users', userDoc.id), {
            verified: true,
            verification_token: '',
          });
          setStatus('success');
        } else {
          setStatus('invalid');
        }
      } catch (err) {
        setStatus('error');
      }
    };
    verify();
    // eslint-disable-next-line
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <p className="text-lg">Verifying your account...</p>
      </div>
    );
  }
  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Account Verified!</h2>
        <p className="text-lg">Your account has been successfully verified. You can now log in.</p>
      </div>
    );
  }
  if (status === 'invalid') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Invalid Verification Link</h2>
        <p className="text-lg">This verification link is invalid or has been corrupted.<br/>Please check your email for the correct link or contact support.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Error</h2>
      <p className="text-lg">An error occurred during verification. Please try again later.</p>
    </div>
  );
};

export default VerifyAccount;

