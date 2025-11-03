import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  description: string;
  seller_account: string;
  created_at: string;
}

export const PaymentLinks = () => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();
        setUserProfile(data);
      }
    };
    fetchUserProfile();
  }, [user]);

  const calculateFees = (amount: number) => {
    const platformFee = Math.round((amount * 0.03 + 0.30) * 100); // 3% + $0.30
    const sellerAmount = amount * 100 - platformFee; // Convert to cents
    return { platformFee, sellerAmount };
  };

  const createPaymentLink = async () => {
    if (!amount || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!userProfile?.display_name) {
      toast({
        title: "Profile Required",
        description: "Please set up your profile first",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Call edge function to create payment link
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          amount: amountNum,
          description,
          seller_account: userProfile.display_name,
        }
      });

      if (error) throw error;

      const newLink: PaymentLink = {
        id: data.payment_link.id,
        url: data.payment_link.url,
        amount: amountNum,
        description,
        seller_account: userProfile.display_name,
        created_at: new Date().toISOString(),
      };

      setPaymentLinks([newLink, ...paymentLinks]);
      
      toast({
        title: "Payment Link Created",
        description: "Your payment link has been created successfully",
      });

      // Reset form
      setAmount("");
      setDescription("");
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast({
        title: "Error",
        description: "Failed to create payment link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "Payment link copied to clipboard",
    });
  };

  const amountNum = parseFloat(amount) || 0;
  const fees = calculateFees(amountNum);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Payment Link</CardTitle>
          <CardDescription>
            Generate a payment link with automatic fee calculation (3% + $0.30)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="seller-account">Seller Account</Label>
              <Input
                id="seller-account"
                value={userProfile?.display_name || "Loading..."}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is automatically set to your profile name
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Product or service description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {amountNum > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Fee Breakdown</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Customer pays:</span>
                  <span className="font-semibold">${amountNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (3% + $0.30):</span>
                  <span className="text-red-600">-${(fees.platformFee / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span>Seller receives:</span>
                  <span className="font-semibold text-green-600">${(fees.sellerAmount / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <Button onClick={createPaymentLink} disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Payment Link"}
          </Button>
        </CardContent>
      </Card>

      {paymentLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Payment Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentLinks.map((link) => (
                <div key={link.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{link.description}</h4>
                    <span className="text-lg font-bold">${link.amount.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Seller: {link.seller_account}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={link.url}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(link.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(link.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};