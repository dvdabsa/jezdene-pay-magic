import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Account = { id: string; name: string; currency: string };

const Transfer = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [description, setDescription] = useState<string>("");
  const [recipientHandle, setRecipientHandle] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from('accounts_with_balance')
      .select('id, name, currency');
    if (!error) setAccounts(data || []);
  };

  const submitTransfer = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const amt = Number(amount);
      if (!fromAccountId || !amt || !currency) {
        throw new Error('Please fill all required fields');
      }
      
      if (recipientHandle.trim()) {
        const { error } = await supabase.rpc('send_to_user', {
          _from_account: fromAccountId,
          _recipient_handle: recipientHandle.trim(),
          _amount: amt,
          _currency: currency,
          _description: description || null,
        });
        if (error) throw new Error(error.message);
      } else {
        if (!toAccountId) throw new Error('Select a destination account');
        const { data: created, error: createErr } = await supabase
          .from('transfers')
          .insert({
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount: amt,
            currency,
            description,
            initiated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .select('id')
          .single();
        if (createErr || !created) throw new Error(createErr?.message || 'Failed to create transfer');
        const { error: postErr } = await supabase.rpc('post_transfer', { _transfer_id: created.id });
        if (postErr) throw new Error(postErr.message);
      }

      setMessage('Transfer posted successfully');
      setAmount("");
      setDescription("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Make a Transfer</h1>
        <p className="text-muted-foreground mt-2">Move funds between internal accounts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">From Account</label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Recipient Handle (optional)</label>
              <Input placeholder="friend_handle" value={recipientHandle} onChange={(e) => setRecipientHandle(e.target.value)} />
              <div className="text-xs text-muted-foreground mt-1">Leave empty to transfer between your own accounts below.</div>
            </div>
          </div>

          {!recipientHandle && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium">To Account (your account)</label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button disabled={submitting} onClick={submitTransfer}>Submit Transfer</Button>
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Transfer;


