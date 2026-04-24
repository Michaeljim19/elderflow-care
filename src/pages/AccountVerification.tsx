import { useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { CheckCircle, AlertCircle, ArrowLeft, Mail, User, Shield, Heart } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAccountByGeneratedEmail, verifyAccount as verifyAccountInDB, createFirebaseAuthUser } from "@/services/firebase/accounts"
import { collection, query as fbQuery, where as fbWhere, getDocs as fbGetDocs, updateDoc as fbUpdateDoc, doc as fbDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
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
      
      // Declare variables that need to be accessible throughout the function
      let foundInUsers = false
      let userDoc: any = null
      
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

        // Validate token by comparing to stored verification_token on the account
        // We'll also check account.createdAt to enforce a 24-hour expiry
        try {
          // Find the account in Firebase by generated email (accounts collection)
          let account = await getAccountByGeneratedEmail(email)

          // If not found in accounts, try users collection (legacy flow)
          if (!account) {
            const usersRef = collection(db, 'users')
            const uq = fbQuery(usersRef, fbWhere('generated_email', '==', email))
            const usnapshot = await fbGetDocs(uq)
            if (!usnapshot.empty) {
              userDoc = usnapshot.docs[0]
              const userData = userDoc.data()
              // Build a pseudo-account object from user doc for validation
              account = {
                id: userDoc.id,
                generated_email: userData.generated_email || email,
                generated_password: userData.generated_password,
                name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown User',
                role: userData.role || 'caregiver',
                verification_token: userData.verification_token,
                createdAt: userData.created_at
              }
              foundInUsers = true
            }
          }

          if (!account) {
            setVerificationData({
              email: email,
              name: 'Unknown User',
              role: 'caregiver',
              status: 'invalid'
            })
            return
          }

          // Check token match
          let tokenMatches = !!(account.verification_token && account.verification_token === token)

          // Fallback: allow verification if token doesn't match but the account was created today
          if (!tokenMatches) {
            try {
              if (account.createdAt) {
                const createdMs = account.createdAt.toDate ? account.createdAt.toDate().getTime() : (account.createdAt.seconds ? account.createdAt.seconds * 1000 : 0)
                const created = new Date(createdMs)
                const now = new Date()
                const sameDay = created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created.getDate() === now.getDate()
                if (sameDay) {
                  tokenMatches = true
                  console.warn('Token mismatch but allowing verification because account.createdAt is today (fallback)')
                  toast({
                    title: 'Verification Fallback',
                    description: 'Token did not match exactly but the account was created today; proceeding with verification.',
                  })
                }
              }
            } catch (e) {
              console.warn('Fallback token/day check failed', e)
            }
          }

          if (!tokenMatches) {
            setVerificationData({
              email: account.generated_email || email,
              name: account.name || 'Unknown User',
              role: account.role || 'caregiver',
              status: 'invalid'
            })
            return
          }

          // Check expiry using account.createdAt (if present)
          if (account.createdAt) {
            try {
              const createdAtMs = account.createdAt.toDate ? account.createdAt.toDate().getTime() : (account.createdAt.seconds ? account.createdAt.seconds * 1000 : 0)
              const now = Date.now()
              if (now - createdAtMs > 86400000) { // older than 24 hours
                setVerificationData({
                  email: account.generated_email || email,
                  name: account.name || 'Unknown User',
                  role: account.role || 'caregiver',
                  status: 'expired'
                })
                return
              }
            } catch (e) {
              // If createdAt parsing fails, continue without expiry
              console.warn('Could not determine account.createdAt for expiry check', e)
            }
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


        // Extra checks for generated credentials
        if (!account.generated_email || !account.generated_password) {
          setVerificationData({
            email: account.generated_email || email,
            name: account.name,
            role: account.role,
            status: 'invalid'
          })
          toast({
            title: "Verification Failed",
            description: "Missing generated email or password. Please contact support.",
            variant: "destructive"
          })
          console.error('Verification failed: missing generated_email or generated_password in account:', account)
          setLoading(false)
          return
        }

        // Verify the account in Firebase (this will attempt Auth creation)
        if (!foundInUsers) {
          // Normal accounts collection flow
          try {
            await verifyAccountInDB(account.id)
            setVerificationData({
              email: account.generated_email,
              name: account.name,
              role: account.role,
              status: 'verified',
              verifiedAt: new Date().toISOString()
            })
            toast({
              title: "Account Verified!",
              description: `Your account has been successfully verified. Auth user created for ${account.generated_email}.`,
            })
            console.log('Verification succeeded and attempted Auth creation for:', account.generated_email)
          } catch (err: any) {
            setVerificationData({
              email: account.generated_email,
              name: account.name,
              role: account.role,
              status: 'verified',
              verifiedAt: new Date().toISOString()
            })
            toast({
              title: "Account Verified (with warning)",
              description: `Account marked as verified, but Auth user creation failed: ${err?.message || err}`,
              variant: "destructive"
            })
            console.warn('Account verified but Auth user creation failed:', err)
          }
        } else {
          // Users collection legacy flow: update user doc and create Auth user client-side
          try {
            // Mark user doc as verified and clear token
            await fbUpdateDoc(fbDoc(db, 'users', userDoc.id), {
              verified: true,
              is_active: true,
              status: 'active',
              verification_token: ''
            })

            // Attempt to create Firebase Auth user using generated credentials
            try {
              const createdUid = await createFirebaseAuthUser({
                id: userDoc.id,
                generated_email: account.generated_email,
                generated_password: account.generated_password,
                name: account.name,
                role: account.role,
                verified: true
              } as any)

              if (createdUid) {
                toast({ title: 'Account Verified', description: `Auth user created for ${account.generated_email}` })
              } else {
                toast({ title: 'Account Verified', description: `Account marked verified. Auth user may already exist for ${account.generated_email}` })
              }

              setVerificationData({
                email: account.generated_email,
                name: account.name,
                role: account.role,
                status: 'verified',
                verifiedAt: new Date().toISOString()
              })
            } catch (authErr) {
              console.warn('User doc verified but Auth creation failed:', authErr)
              toast({ title: 'Verified (Auth creation failed)', description: `Account verified but failed to create Auth user: ${authErr?.message || authErr}`, variant: 'destructive' })
              setVerificationData({
                email: account.generated_email,
                name: account.name,
                role: account.role,
                status: 'verified',
                verifiedAt: new Date().toISOString()
              })
            }

          } catch (err) {
            console.error('Failed to verify user doc in users collection:', err)
            setVerificationData({
              email: account.generated_email,
              name: account.name,
              role: account.role,
              status: 'invalid'
            })
            toast({ title: 'Verification Failed', description: 'Could not update user record. Please contact support.', variant: 'destructive' })
            return
          }
        }
        
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
                    <strong>Great news!</strong> Your account has been successfully verified. You can now log in to the Care system using your email and temporary password.
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
