import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import heroImage from "@/assets/healthcare-hero.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
      const role = String(userDoc.data()?.role || '').toLowerCase();

      if (role !== 'admin') {
        await signOut(auth);
        setError('Only admin accounts can log in to this website');
        return;
      }

      toast({
        title: "Login successful",
        description: "Welcome back to Care!",
      });
      navigate("/");
    } catch (loginError: any) {
      console.error("Login error:", loginError);
      setError(getErrorMessage(loginError.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case "auth/user-not-found":
        return "No account found with this email address";
      case "auth/wrong-password":
        return "Incorrect password";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/user-disabled":
        return "This account has been disabled";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later";
      default:
        return "Login failed. Please try again";
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 bg-cover bg-center bg-no-repeat p-4 md:p-8 lg:p-10"
      style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.66)), url(${heroImage})` }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_auto] lg:gap-16">
        <div className="hidden max-w-2xl lg:block lg:pl-6 xl:pl-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/85 shadow-lg backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Care for elders, designed with clarity
          </div>
          <div className="mt-8 space-y-6 text-white">
            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight md:text-6xl xl:text-7xl">
              C.A.R.E
            </h1>
            <p className="max-w-xl text-2xl font-medium text-white/90 md:text-3xl xl:text-4xl">
              Cognitive Assissant and Reminder for Elders
            </p>
            <p className="max-w-lg text-base leading-7 text-white/75 md:text-lg">
              A calm, focused workspace for reminders, schedules, medication tracking, and caregiver coordination.
            </p>
            <div className="grid max-w-lg gap-3 text-sm text-white/85 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Medication and reminder support
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Caregiver and patient scheduling
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Clear account and access control
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Built for simple daily use
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end lg:pr-8 xl:pr-16">
        <Card className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/55 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:min-w-[28rem]">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="mx-auto inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Secure Sign In
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</CardTitle>
            <CardDescription className="text-base text-slate-600">
              Sign in to your Care account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 border-slate-200 bg-white/90 pl-12 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-slate-200 bg-white/90 pl-12 pr-12 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-10 w-10 rounded-full px-0 py-0 text-slate-500 hover:bg-slate-100"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full bg-slate-900 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="text-base">Signing in...</span>
                  </>
                ) : (
                  <span className="text-base">Sign In</span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 border-t border-slate-200/70 pt-6">
            <p className="w-full text-center text-base text-slate-600">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-emerald-700 hover:underline">
                Sign up
              </Link>
            </p>
            <div className="text-center text-sm text-slate-500">
              <Link to="/endorsements" className="font-medium text-emerald-700 hover:underline">
                ⭐ See what our users say
              </Link>
              {" • "}
              <Link to="/terms" className="hover:underline">
                Terms
              </Link>
              {" • "}
              <Link to="/privacy" className="hover:underline">
                Privacy
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Login;
