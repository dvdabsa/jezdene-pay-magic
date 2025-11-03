import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BankingInfo {
  account_holder_name: string;
  iban: string;
}

export const BankingInfo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bankingInfo, setBankingInfo] = useState<BankingInfo>({
    account_holder_name: "",
    iban: "",
  });

  useEffect(() => {
    if (user) {
      fetchBankingInfo();
    }
  }, [user]);

  const fetchBankingInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("seller_banking_info")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching banking info:", error);
        return;
      }

      if (data) {
        setBankingInfo({
          account_holder_name: data.account_holder_name,
          iban: data.iban,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const saveBankingInfo = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("seller_banking_info")
        .upsert(
          {
            user_id: user.id,
            ...bankingInfo,
          },
          { onConflict: "user_id" } // 👈 fixes duplicate key issue
        );

      if (error) {
        throw error;
      }

      toast({
        title: "Banking information saved",
        description: "Your banking details have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving banking info:", error);
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
    setBankingInfo((prev) => ({
      ...prev,
      [field]: value,
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
            <Label htmlFor="account_holder_name">Account Holder Name</Label>
            <Input
              id="account_holder_name"
              value={bankingInfo.account_holder_name}
              onChange={(e) =>
                handleInputChange("account_holder_name", e.target.value)
              }
              placeholder="Name on the account"
            />
          </div>

          <div>
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={bankingInfo.iban}
              onChange={(e) => handleInputChange("iban", e.target.value)}
              placeholder="Enter your IBAN"
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
