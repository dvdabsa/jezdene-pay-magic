import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BankingInfo {
  bank_name: string;
  routing_number: string;
  account_number: string;
  account_holder_name: string;
}

export const BankingInfo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bankingInfo, setBankingInfo] = useState<BankingInfo>({
    bank_name: "",
    routing_number: "",
    account_number: "",
    account_holder_name: "",
  });

  useEffect(() => {
    if (user) {
      fetchBankingInfo();
    }
  }, [user]);

  const fetchBankingInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_banking_info')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching banking info:', error);
        return;
      }

      if (data) {
        setBankingInfo({
          bank_name: data.bank_name,
          routing_number: data.routing_number,
          account_number: data.account_number,
          account_holder_name: data.account_holder_name,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const saveBankingInfo = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('seller_banking_info')
        .upsert({
          user_id: user.id,
          ...bankingInfo,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Banking information saved",
        description: "Your banking details have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving banking info:', error);
      toast({
        title: "Error",
        description: "Failed to save banking information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BankingInfo, value: string) => {
    setBankingInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banking Information</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add your banking details to receive payments from sales.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input
              id="bank_name"
              value={bankingInfo.bank_name}
              onChange={(e) => handleInputChange('bank_name', e.target.value)}
              placeholder="Enter your bank name"
            />
          </div>
          
          <div>
            <Label htmlFor="routing_number">Routing Number</Label>
            <Input
              id="routing_number"
              value={bankingInfo.routing_number}
              onChange={(e) => handleInputChange('routing_number', e.target.value)}
              placeholder="9-digit routing number"
              maxLength={9}
            />
          </div>
          
          <div>
            <Label htmlFor="account_number">Account Number</Label>
            <Input
              id="account_number"
              type="password"
              value={bankingInfo.account_number}
              onChange={(e) => handleInputChange('account_number', e.target.value)}
              placeholder="Enter your account number"
            />
          </div>
          
          <div>
            <Label htmlFor="account_holder_name">Account Holder Name</Label>
            <Input
              id="account_holder_name"
              value={bankingInfo.account_holder_name}
              onChange={(e) => handleInputChange('account_holder_name', e.target.value)}
              placeholder="Name on the account"
            />
          </div>
        </div>
        
        <Button 
          onClick={saveBankingInfo} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Saving..." : "Save Banking Information"}
        </Button>
      </CardContent>
    </Card>
  );
};