import { PaymentLinks } from "./PaymentLinks";
import { BankingInfo } from "./BankingInfo";
import { AdminPanel } from "./AdminPanel";
import { FeeEarnings } from "./FeeEarnings";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Tables } from "@/integrations/supabase/types";

export const DashboardOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [profileHandle, setProfileHandle] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [recipientHandle, setRecipientHandle] = useState<string>("");
  const [sendDescription, setSendDescription] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchProfileHandle();
      fetchProfile();
    }
  }, [user]);

  // Set up real-time subscription for balance updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('balance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ledger_entries'
        },
        (payload) => {
          console.log('New ledger entry received:', payload);
          // Check if this affects the current user's account
          if (payload.new && payload.new.account_id) {
            // Fetch the account to see if it belongs to current user
            supabase
              .from('accounts')
              .select('user_id')
              .eq('id', payload.new.account_id)
              .single()
              .then(({ data }) => {
                if (data && data.user_id === user.id) {
                  console.log('Balance update detected, refreshing...');
                  fetchBalance();
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts_with_balance')
        .select('balance')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setBalance(data?.balance ?? 0);
    } catch (e) {
      console.error('Failed to fetch balance', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileHandle = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id)
        .single();
      setProfileHandle(data?.display_name || "");
    } catch (_) {}
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const createMainAccount = async () => {
    try {
      const { error } = await supabase.from('accounts').insert({
        user_id: user?.id,
        currency: 'USD',
        type: 'wallet',
        name: 'Main',
      });
      if (error) throw error;
      toast({ title: 'Account created', description: 'Your main USD account is ready.' });
      await fetchBalance();
    } catch (e) {
      toast({ title: 'Failed to create account', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const createPaymentLink = async () => {
    try {
      const amt = Number(topUpAmount);
      if (!amt || amt <= 0) {
        toast({ title: 'Enter a valid amount', variant: 'destructive' });
        return;
      }
      if (!profileHandle) {
        toast({ title: 'Missing profile handle', description: 'Set your display name in Settings.', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: { amount: amt, description: `Top-up ${profileHandle}`, seller_account: profileHandle }
      });
      if (error) {
        toast({ title: 'Payment link failed', description: error.message, variant: 'destructive' });
        return;
      }
      const url = (data as any)?.payment_link?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast({ title: 'Payment link failed', description: 'No URL returned', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Payment link error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const sendMoney = async () => {
    if (!balance || balance <= 0) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }
    if (!sendAmount || !recipientHandle) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    const amt = Number(sendAmount);
    if (amt <= 0 || amt > balance) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // Get user's main account
      const { data: account, error: accountErr } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user?.id)
        .eq('currency', 'USD')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (accountErr || !account) {
        toast({ title: 'Account not found', variant: 'destructive' });
        return;
      }

      // Send to user via RPC
      const { error } = await supabase.rpc('send_to_user', {
        _from_account: account.id,
        _recipient_handle: recipientHandle.trim(),
        _amount: amt,
        _currency: 'USD',
        _description: sendDescription || `Payment to ${recipientHandle}`,
      });

      if (error) {
        toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Money sent!', description: `$${amt.toFixed(2)} sent to ${recipientHandle}` });
      setSendAmount("");
      setRecipientHandle("");
      setSendDescription("");
      await fetchBalance(); // Refresh balance
    } catch (e) {
      toast({ title: 'Send error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const displayName = profile?.display_name || profile?.company_name || user?.email?.split('@')[0] || "User";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {displayName}</h1>
        <p className="text-muted-foreground mt-2">
          Your digital bank account
        </p>
      </div>
      
      {/* Main Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : balance === null ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">No account found. Create your main account to get started.</p>
              <Button onClick={createMainAccount}>Create Main Account</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl font-bold">${balance.toFixed(2)} USD</div>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Add money amount" 
                  value={topUpAmount} 
                  onChange={(e) => setTopUpAmount(e.target.value)} 
                  className="w-48" 
                />
                <Button onClick={createPaymentLink}>Add Money</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Money Card */}
      {balance !== null && balance > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Money</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">To User Handle</label>
                  <Input 
                    placeholder="friend_handle" 
                    value={recipientHandle} 
                    onChange={(e) => setRecipientHandle(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={sendAmount} 
                    onChange={(e) => setSendAmount(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Input 
                    placeholder="Payment for..." 
                    value={sendDescription} 
                    onChange={(e) => setSendDescription(e.target.value)} 
                  />
                </div>
              </div>
              <Button onClick={sendMoney} disabled={sending} className="w-full">
                {sending ? 'Sending...' : 'Send Money'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentLinks />
        <BankingInfo />
      </div>
      
      {/* <FeeEarnings /> */}
      <AdminPanel />
    </div>
  );
};