import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { sendAccountCreationEmail } from "@/services/emailjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, User, Phone } from "lucide-react";
import heroImage from "@/assets/healthcare-hero.jpg";

const generateTemporaryPassword = () => {
  const characters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let password = "";

  for (let index = 0; index < 12; index += 1) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return password;
};

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email } = formData;
    
    if (!firstName || !lastName || !email) {
      setError("Please fill in all required fields");
      return false;
    }

    if (!acceptedTerms) {
      setError("Please accept the terms and conditions");
      return false;
    }

    return true;
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const temporaryPassword = generateTemporaryPassword();

      // Create user account
      console.log("Creating user account...");
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, temporaryPassword);
      const user = userCredential.user;
      console.log("User account created:", user.uid);

      // Update user profile
      console.log("Updating user profile...");
      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`,
      });

      // Generate a temporary password for email (this is just for the welcome email format)
      // Send welcome email using EmailJS
      console.log("Sending welcome email via EmailJS...");
      try {
        await sendAccountCreationEmail({
          to_email: formData.email,
          to_name: `${formData.firstName} ${formData.lastName}`,
          account_type: 'admin',
          temporary_password: temporaryPassword,
          login_url: window.location.origin + '/login',
          admin_notes: `Welcome to Care! Your account has been created successfully with administrator privileges.\n\nLogin email: ${formData.email}\nTemporary password: ${temporaryPassword}\nLogin here: ${window.location.origin + '/login'}`,
          username: formData.email
        });
        console.log("Welcome email sent successfully");
      } catch (emailError) {
        console.warn("Failed to send welcome email, but account was created:", emailError);
        // Don't fail registration if email fails
      }

      // Save additional user data to Firestore
      try {
        console.log("Saving user data to Firestore...");
        await setDoc(doc(db, "users", user.uid), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          role: "Admin",
          createdAt: new Date().toISOString(),
          isActive: true,
          emailVerified: true, // Since we're not using Firebase verification
        });
        console.log("User data saved to Firestore successfully");
      } catch (firestoreError) {
        console.warn("Failed to save to Firestore, but account was created:", firestoreError);
      }

      setEmailSent(true);
      
      toast({
        title: "Registration successful!",
        description: "Your account has been created successfully. A welcome email has been sent to your inbox.",
        duration: 7000,
      });
      
    } catch (error: any) {
      console.error("Registration error:", error);
      setError(getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case "auth/email-already-in-use":
        return "An account with this email already exists";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/weak-password":
        return "Password is too weak";
      case "auth/operation-not-allowed":
        return "Email registration is not enabled";
      default:
        return "Registration failed. Please try again";
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
              Create your account to manage reminders, schedules, caregivers, and patient support in one place.
            </p>
            <div className="grid max-w-lg gap-3 text-sm text-white/85 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Fast secure registration
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Designed for caregiver teams
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Simple daily access
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Clear account setup
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end lg:pr-8 xl:pr-16">
          <Card className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/55 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:min-w-[28rem]">
            <CardHeader className="space-y-3 pb-6 text-center">
              <div className="mx-auto inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Secure Registration
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Create Account</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Join Care to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!emailSent ? (
                <>
                  <form onSubmit={handleEmailRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-base">First Name *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                          <Input
                            id="firstName"
                            type="text"
                            placeholder="First name"
                            value={formData.firstName}
                            onChange={(e) => handleInputChange("firstName", e.target.value)}
                            className="h-12 border-slate-200 bg-white/90 pl-12 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-base">Last Name *</Label>
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Last name"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className="h-12 border-slate-200 bg-white/90 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-base">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className="h-12 border-slate-200 bg-white/90 pl-12 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-base">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          className="h-12 border-slate-200 bg-white/90 pl-12 text-base shadow-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        disabled={loading}
                      />
                      <Label htmlFor="terms" className="text-base">
                        I agree to the{" "}
                        <Link to="/terms" className="text-primary hover:underline text-base">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link to="/privacy" className="text-primary hover:underline text-base">
                          Privacy Policy
                        </Link>
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full bg-slate-900 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          <span className="text-base">Creating account...</span>
                        </>
                      ) : (
                        <span className="text-base">Create Account</span>
                      )}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                        <Mail className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-emerald-800">Registration Successful!</h3>
                    <p className="mb-4 text-base text-emerald-700">
                      Welcome to Care! Your admin account has been created successfully.
                      A welcome email has been sent to <strong>{formData.email}</strong>.
                    </p>
                    <div className="space-y-1 text-base text-emerald-700">
                      <p><strong>📧 Email delivery tips:</strong></p>
                      <ul className="ml-2 list-inside list-disc space-y-1 text-sm">
                        <li>Check your <strong>spam/junk</strong> folder</li>
                        <li>Look for emails from Care</li>
                        <li>Wait up to <strong>5-10 minutes</strong> for delivery</li>
                      </ul>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => navigate("/login")}
                    className="h-12 w-full border-slate-300 bg-white/80 text-base text-slate-700 hover:bg-white"
                  >
                    Go to Login Page
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-slate-200/70 pt-6">
              <p className="w-full text-center text-base text-slate-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline text-lg"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
    </div>
    </div>
  );
};

export default Register;
