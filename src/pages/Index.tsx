import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CreditCard, BarChart3, Users, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect if still loading
    if (loading) return;
    
    // Redirect to auth if not logged in
    if (!user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <CreditCard className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render main content if not authenticated
  if (!user) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background gradient" >
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Jezdene</h1>
          </div>
          <div className="space-x-4">
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Button onClick={() => navigate("/dashboard")}>Dashboard</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Welcome to Jezdene
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your payment gateway is ready! Start processing payments with transparent 3% + $0.30 fees. 
            Access your merchant dashboard and API credentials below.
          </p>
          <div className="space-x-4">
            <Button size="lg" onClick={() => navigate("/dashboard")}>Merchant Dashboard</Button>
            <Button variant="outline" size="lg">API Documentation</Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 cardsss">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Why Choose Jezdene?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader className="text-center">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Secure & Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Bank-grade encryption and tokenization with full PCI compliance
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <CreditCard className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Direct Deposits</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Payments go directly to your bank account with automatic fee deduction
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <BarChart3 className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Real-time Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor transactions, fees, and settlements with detailed reporting
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Easy Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Simple REST API for seamless integration into any platform
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-muted/20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">No hidden fees, no monthly charges</p>
          </div>
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Pay Per Transaction</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-primary mb-4">3% + $0.30</div>
              <p className="text-muted-foreground mb-6">per successful transaction</p>
              <ul className="text-left space-y-2 text-sm text-muted-foreground">
                <li>✓ Direct bank deposits</li>
                <li>✓ Real-time processing</li>
                <li>✓ Detailed transaction records</li>
                <li>✓ Admin dashboard included</li>
                <li>✓ 24/7 support</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-muted-foreground">
          <p>&copy; 2024 Jezdene. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
