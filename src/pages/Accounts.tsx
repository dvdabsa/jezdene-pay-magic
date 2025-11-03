import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Account = {
  id: string;
  user_id: string;
  type: string;
  currency: string;
  status: string;
  name: string;
  created_at: string;
  balance?: number;
};

const Accounts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [profileHandle, setProfileHandle] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchProfileHandle();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts_with_balance')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
    } catch (e) {
      console.error('Failed to fetch accounts', e);
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

  const createDefaultAccount = async () => {
    try {
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .limit(1);
      if (existing && existing.length > 0) {
        toast({ title: 'Account exists', description: 'You already have an account.' });
        return;
      }
      const { error } = await supabase.from('accounts').insert({
        user_id: user?.id,
        currency: 'USD',
        type: 'wallet',
        name: 'Main',
      });
      if (error) {
        toast({ title: 'Failed to create account', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Account created', description: 'Default USD account was created.' });
      await fetchAccounts();
    } catch (e) {
      console.error('Failed to create account', e);
      const message = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditingName(acc.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ name: editingName })
        .eq('id', editingId);
      if (error) {
        toast({ title: 'Rename failed', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Account renamed' });
      setEditingId(null);
      setEditingName("");
      await fetchAccounts();
    } catch (e) {
      toast({ title: 'Rename failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const createPaymentLink = async (acc: Account) => {
    try {
      const amt = Number(topUpAmount);
      if (!amt || amt <= 0) {
        toast({ title: 'Enter a valid amount', variant: 'destructive' });
        return;
      }
      if (acc.currency !== 'USD') {
        toast({ title: 'USD only for now', description: 'Payment link uses USD currently.' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground mt-2">Manage your internal accounts and view balances.</p>
        </div>
        <Button onClick={createDefaultAccount}>Create Default USD Account</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Top-up amount (USD)" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="w-48" />
            <div className="text-sm text-muted-foreground">Use Add Money on your chosen USD account.</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    {editingId === acc.id ? (
                      <div className="flex items-center gap-2">
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-40" />
                        <Button size="sm" onClick={saveEdit}>Save</Button>
                        <Button size="sm" variant="secondary" onClick={() => { setEditingId(null); setEditingName(""); }}>Cancel</Button>
                      </div>
                    ) : (
                      acc.name
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{acc.type}</TableCell>
                  <TableCell className="capitalize">{acc.status}</TableCell>
                  <TableCell>{acc.currency}</TableCell>
                  <TableCell>${(acc.balance ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{new Date(acc.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingId !== acc.id && (
                        <Button size="sm" variant="secondary" onClick={() => startEdit(acc)}>Rename</Button>
                      )}
                      <Button size="sm" onClick={() => createPaymentLink(acc)}>Add Money</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">No accounts yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;


