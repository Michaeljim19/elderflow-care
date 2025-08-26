import { useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { CheckCircle, AlertCircle, ArrowLeft, Mail, User, Shield, Heart } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAccountByGeneratedEmail, verifyAccount as verifyAccountInDB } from "@/services/firebase/accounts"
import { useToast } from "@/hooks/use-toast"

interface VerificationData {
  email: string
  name: string
  role: 'caregiver' | 'guardian'
  status: 'verified' | 'already_verified' | 'invalid' | 'expired'
  verifiedAt?: string
}

const AccountVerification = () => {
  const [searchParams] = useSearchParams()
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    
    // Real verification process using Firebase
    const verifyAccount = async () => {
      setLoading(true)
      
      try {
        if (!token || !email) {
          setVerificationData({
            email: email || '',
            name: 'Unknown User',
            role: 'caregiver',
            status: 'invalid'
          })
          return
        }

        // Decode the token to validate (basic validation)
        try {
          const decodedToken = atob(token)
          const [tokenEmail, timestamp, random] = decodedToken.split('-')
          
          // Check if token email matches the provided email
          if (tokenEmail !== email) {
            throw new Error('Token mismatch')
          }
          
          // Check if token is not too old (24 hours = 86400000 ms)
          const tokenTime = parseInt(timestamp)
          const currentTime = Date.now()
          const timeDiff = currentTime - tokenTime
          
          if (timeDiff > 86400000) { // 24 hours
            setVerificationData({
              email: email,
              name: 'Unknown User',
              role: 'caregiver',
              status: 'expired'
            })
            return
          }
        } catch (error) {
          setVerificationData({
            email: email,
            name: 'Unknown User',
            role: 'caregiver',
            status: 'invalid'
          })
          return
        }

        // Find the account in Firebase by generated email
        const account = await getAccountByGeneratedEmail(email)
        
        if (!account) {
          setVerificationData({
            email: email,
            name: 'Unknown User',
            role: 'caregiver',
            status: 'invalid'
          })
          return
        }

        // Check if already verified
        if (account.verified) {
          setVerificationData({
            email: account.generated_email,
            name: account.name,
            role: account.role,
            status: 'already_verified',
            verifiedAt: account.verifiedAt?.toDate().toISOString()
          })
          return
        }

        // Verify the account in Firebase
        await verifyAccountInDB(account.id)
        
        setVerificationData({
          email: account.generated_email,
          name: account.name,
          role: account.role,
          status: 'verified',
          verifiedAt: new Date().toISOString()
        })

        // Show success toast
        toast({
          title: "Account Verified!",
          description: "Your account has been successfully verified and is ready to use.",
        })
        
      } catch (error) {
        console.error('Verification error:', error)
        setVerificationData({
          email: email || '',
          name: 'Unknown User',
          role: 'caregiver',
          status: 'invalid'
        })

        toast({
          title: "Verification Failed",
          description: "Unable to verify your account. Please try again or contact support.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    verifyAccount()
  }, [searchParams, toast])

  const getRoleIcon = (role: 'caregiver' | 'guardian') => {
    return role === 'caregiver' ? (
      <Heart className="h-6 w-6 text-blue-500" />
    ) : (
      <Shield className="h-6 w-6 text-green-500" />
    )
  }

  const getRoleBadgeColor = (role: 'caregiver' | 'guardian') => {
    return role === 'caregiver' 
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-green-100 text-green-800 border-green-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <h3 className="text-lg font-semibold">Verifying Account</h3>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we verify your account details...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!verificationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h3 className="text-lg font-semibold text-red-800">Verification Failed</h3>
              <p className="text-sm text-red-600 text-center">
                Unable to process verification request. Please try again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              {verificationData.status === 'verified' || verificationData.status === 'already_verified' ? (
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              ) : (
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="h-12 w-12 text-red-600" />
                </div>
              )}
            </div>
            
            {verificationData.status === 'verified' && (
              <>
                <CardTitle className="text-2xl font-bold text-green-800">
                  Account Verified Successfully!
                </CardTitle>
                <CardDescription className="text-green-700">
                  Your account is now ready to use for login
                </CardDescription>
              </>
            )}
            
            {verificationData.status === 'already_verified' && (
              <>
                <CardTitle className="text-2xl font-bold text-blue-800">
                  Account Already Verified
                </CardTitle>
                <CardDescription className="text-blue-700">
                  This account has already been verified and is ready to use
                </CardDescription>
              </>
            )}
            
            {verificationData.status === 'invalid' && (
              <>
                <CardTitle className="text-2xl font-bold text-red-800">
                  Invalid Verification Link
                </CardTitle>
                <CardDescription className="text-red-700">
                  This verification link is invalid or has been corrupted
                </CardDescription>
              </>
            )}
            
            {verificationData.status === 'expired' && (
              <>
                <CardTitle className="text-2xl font-bold text-orange-800">
                  Verification Link Expired
                </CardTitle>
                <CardDescription className="text-orange-700">
                  This verification link has expired. Please request a new one
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {(verificationData.status === 'verified' || verificationData.status === 'already_verified') && (
              <>
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Great news!</strong> Your account has been successfully verified. You can now log in to the ElderFlow Care system using your email and temporary password.
                  </AlertDescription>
                </Alert>

                {/* Account Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Account Details
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Login Email:</span>
                      <span className="font-medium text-sm text-blue-600">{verificationData.email}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="font-medium">{verificationData.name}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Role:</span>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(verificationData.role)}
                        <Badge className={getRoleBadgeColor(verificationData.role)} variant="outline">
                          {verificationData.role === 'caregiver' ? 'Caregiver' : 'Patient Guardian'}
                        </Badge>
                      </div>
                    </div>
                    
                    {verificationData.verifiedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Verified:</span>
                        <span className="font-medium text-sm">
                          {new Date(verificationData.verifiedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Next Steps
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">1.</span>
                      <span>Use your <strong>login email</strong> ({verificationData.email}) as your username</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">2.</span>
                      <span>Log in with the temporary password provided in your original email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold">3.</span>
                      <span>You'll be prompted to change your password on first login</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  <Button asChild className="w-full">
                    <Link to="/login">
                      Proceed to Login
                    </Link>
                  </Button>
                  
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/" className="flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Back to Home
                    </Link>
                  </Button>
                </div>
              </>
            )}

            {(verificationData.status === 'invalid' || verificationData.status === 'expired') && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {verificationData.status === 'invalid' 
                      ? "The verification link you used is invalid. Please check your email for the correct link or contact support."
                      : "This verification link has expired. Please contact support to request a new verification email."
                    }
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-3">
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/login" className="flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Back to Login
                    </Link>
                  </Button>
                  
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/">
                      Back to Home
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AccountVerification
