import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { auth } from "@/lib/firebase"
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { User, Mail, Shield, Phone, BadgeCheck, KeyRound } from "lucide-react"

const Profile = () => {
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ").trim() || "User"
  const initials = [userData?.firstName?.[0], userData?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U"

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user?.email) {
      toast({
        title: "Error",
        description: "No signed-in email was found for this account.",
        variant: "destructive"
      })
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please complete all password fields.",
        variant: "destructive"
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long.",
        variant: "destructive"
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive"
      })
      return
    }

    if (!auth.currentUser) {
      toast({
        title: "Error",
        description: "You need to be signed in to change your password.",
        variant: "destructive"
      })
      return
    }

    try {
      setSavingPassword(true)
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast({
        title: "Success",
        description: "Your password has been updated."
      })
    } catch (error: any) {
      console.error("Error changing password:", error)

      const message = error?.code === "auth/wrong-password"
        ? "Current password is incorrect."
        : error?.code === "auth/requires-recent-login"
          ? "Please sign in again before changing your password."
          : "Unable to update password. Please try again."

      toast({
        title: "Password Update Failed",
        description: message,
        variant: "destructive"
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">View your account details and system access.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="items-center text-center">
            <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4 text-2xl">{displayName}</CardTitle>
            <CardDescription>{userData?.role || "User"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Account status</span>
              <Badge variant={userData?.isActive ? "default" : "secondary"}>
                {userData?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="text-sm font-medium capitalize">{userData?.role || "User"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Basic information linked to your signed-in account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-primary" />
                Full Name
              </div>
              <p className="text-sm text-muted-foreground">{displayName}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-primary" />
                Email Address
              </div>
              <p className="text-sm text-muted-foreground break-all">{userData?.email || "Not available"}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-primary" />
                Phone Number
              </div>
              <p className="text-sm text-muted-foreground">{userData?.phone || "Not available"}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                User ID
              </div>
              <p className="text-sm text-muted-foreground break-all">{userData?.uid || "Not available"}</p>
            </div>

            <div className="rounded-xl border p-4 sm:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <BadgeCheck className="h-4 w-4 text-primary" />
                Access Summary
              </div>
              <p className="text-sm text-muted-foreground">
                This page shows the currently signed-in user profile used by the system navigation and account access checks.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password by confirming your current password first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleChangePassword}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Updating..." : "Change Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Profile