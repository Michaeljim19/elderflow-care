import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Dashboard from "@/components/Dashboard";
import { ThemeProvider, useTheme } from "next-themes";
import { Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import Patients from "./pages/Patients";
import Medications from "./pages/Medications";
import Reminders from "./pages/Reminders";
import MedicalRecords from "./pages/MedicalRecords";
import Caregivers from "./pages/Caregivers";
import Schedule from "./pages/Schedule";
import Account from "./pages/Account";
import BackupRestore from "./pages/BackupRestore";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Endorsements from "./pages/Endorsements";
import AuditTrail from "./pages/AuditTrail";
import AccountVerification from "./pages/AccountVerification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppHeader = () => {
  const { userData } = useAuth();
  const { theme, setTheme } = useTheme();
  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim() || userData?.email || 'Healthcare Team';
  const isDark = theme !== 'light';
  
  return (
    <header className="h-16 flex items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-9 w-9"
        >
          {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          Welcome back, {displayName}
        </div>
      </div>
    </header>
  );
};

const App = () => {
  console.log("App: Component rendering")
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/verify-account" element={<AccountVerification />} />
              
              {/* Protected routes */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-background">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/patients" element={<Patients />} />
                            <Route path="/medications" element={<Medications />} />
                            <Route path="/reminders" element={<Reminders />} />
                            <Route path="/medical-records" element={<MedicalRecords />} />
                            <Route path="/caregivers" element={<Caregivers />} />
                            <Route path="/schedule" element={<Schedule />} />
                            <Route path="/account" element={<Account />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/backup-restore" element={<BackupRestore />} />
                            <Route path="/endorsements" element={<Endorsements />} />
                            <Route path="/audit-trail" element={<AuditTrail />} />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App;
