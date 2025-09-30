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
import Patients from "./pages/Patients";
import Medications from "./pages/Medications";
import Reminders from "./pages/Reminders";
import MedicalRecords from "./pages/MedicalRecords";
import Caregivers from "./pages/Caregivers";
import Schedule from "./pages/Schedule";
import Account from "./pages/Account";
import BackupRestore from "./pages/BackupRestore";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Endorsements from "./pages/Endorsements";
import AccountVerification from "./pages/AccountVerification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppHeader = () => {
  const { userData } = useAuth();
  
  return (
    <header className="h-16 flex items-center justify-between border-b bg-card px-4">
      <SidebarTrigger />
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          Welcome back, {userData?.firstName || 'Healthcare Team'}
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
                          <Route path="/backup-restore" element={<BackupRestore />} />
                          <Route path="/endorsements" element={<Endorsements />} />
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
    </AuthProvider>
  </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App;
