import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, CreditCard, Bell, Shield, HelpCircle } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    display_name: '',
    company_name: '',
    business_type: '',
    phone: '',
    address: ''
  });
  const [bankingInfo, setBankingInfo] = useState({
    account_holder_name: '',
    iban: ''
  });
  const [notifications, setNotifications] = useState({
    email_transactions: true,
    email_payouts: true,
    email_marketing: false
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setProfile({
          display_name: profileData.display_name || '',
          company_name: profileData.company_name || '',
          business_type: profileData.business_type || '',
          phone: profileData.phone || '',
          address: profileData.address || ''
        });
      }

      // Fetch banking info
      const { data: bankingData } = await supabase
        .from('seller_banking_info')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (bankingData) {
        setBankingInfo({
          account_holder_name: bankingData.account_holder_name || '',
          iban: bankingData.iban || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          ...profile,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBankingInfo = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('seller_banking_info')
        .upsert({
          user_id: user?.id,
          ...bankingInfo,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Banking Info Updated",
        description: "Your banking information has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating banking info:', error);
      toast({
        title: "Error",
        description: "Failed to update banking information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={profile.display_name}
                onChange={(e) => setProfile({...profile, display_name: e.target.value})}
                placeholder="Your display name"
              />
            </div>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={profile.company_name}
                onChange={(e) => setProfile({...profile, company_name: e.target.value})}
                placeholder="Your company name"
              />
            </div>
            <div>
              <Label htmlFor="business_type">Business Type</Label>
              <Input
                id="business_type"
                value={profile.business_type}
                onChange={(e) => setProfile({...profile, business_type: e.target.value})}
                placeholder="e.g., Freelancer, Agency, SaaS"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
                placeholder="Your phone number"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={profile.address}
              onChange={(e) => setProfile({...profile, address: e.target.value})}
              placeholder="Your business address"
              rows={3}
            />
          </div>
          <Button onClick={updateProfile} disabled={loading}>
            Update Profile
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Banking Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Banking Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="account_holder_name">Account Holder Name</Label>
              <Input
                id="account_holder_name"
                value={bankingInfo.account_holder_name}
                onChange={(e) => setBankingInfo({...bankingInfo, account_holder_name: e.target.value})}
                placeholder="Full name on account"
              />
            </div>
            <div>
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={bankingInfo.iban}
                onChange={(e) => setBankingInfo({...bankingInfo, iban: e.target.value})}
                placeholder="Enter your IBAN"
              />
            </div>
          </div>
          <Button onClick={updateBankingInfo} disabled={loading}>
            Update Banking Information
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_transactions">Transaction Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you receive payments
              </p>
            </div>
            <Switch
              id="email_transactions"
              checked={notifications.email_transactions}
              onCheckedChange={(checked) => setNotifications({...notifications, email_transactions: checked})}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_payouts">Payout Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about payout status updates
              </p>
            </div>
            <Switch
              id="email_payouts"
              checked={notifications.email_payouts}
              onCheckedChange={(checked) => setNotifications({...notifications, email_payouts: checked})}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_marketing">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about new features and tips
              </p>
            </div>
            <Switch
              id="email_marketing"
              checked={notifications.email_marketing}
              onCheckedChange={(checked) => setNotifications({...notifications, email_marketing: checked})}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Change Password</Label>
              <p className="text-sm text-muted-foreground">
                Update your account password
              </p>
            </div>
            <Button variant="outline">
              Change Password
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline">
              Enable 2FA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;