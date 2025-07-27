import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/register">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Registration
            </Button>
          </Link>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-muted-foreground mb-4">
              Last updated: July 27, 2025
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">1. Acceptance of Terms</h3>
            <p>
              By accessing and using ElderFlow Care, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">2. Use License</h3>
            <p>
              Permission is granted to temporarily download one copy of ElderFlow Care per device for personal, non-commercial transitory viewing only.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">3. Privacy and Data Protection</h3>
            <p>
              We are committed to protecting your privacy and ensuring the security of your personal health information in compliance with HIPAA regulations.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">4. User Responsibilities</h3>
            <p>
              Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">5. Limitation of Liability</h3>
            <p>
              In no event shall ElderFlow Care or its suppliers be liable for any damages arising out of the use or inability to use the service.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">6. Contact Information</h3>
            <p>
              For questions about these Terms of Service, please contact us at legal@elderflowcare.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
