import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
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
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-muted-foreground mb-4">
              Last updated: July 27, 2025
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">1. Information We Collect</h3>
            <p>
              We collect information you provide directly to us, such as when you create an account, update your profile, or contact us for support.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">2. How We Use Your Information</h3>
            <p>
              We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">3. Information Sharing</h3>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">4. Data Security</h3>
            <p>
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">5. HIPAA Compliance</h3>
            <p>
              Care is committed to complying with the Health Insurance Portability and Accountability Act (HIPAA) and protecting the privacy and security of protected health information (PHI).
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">6. Your Rights</h3>
            <p>
              You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us.
            </p>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">7. Contact Us</h3>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@elderflowcare.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
