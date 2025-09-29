import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { DollarSign, Calendar, TrendingUp } from "lucide-react";

interface Payout {
  id: string;
  amount: number;
  status: string;
  payout_date: string;
  transaction_count: number;
  created_at: string;
  stripe_transfer_id?: string;
  notes?: string;
}

const Payouts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [nextPayoutDate, setNextPayoutDate] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchPayouts();
      calculatePendingAmount();
    }
  }, [user]);

  const fetchPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payouts:', error);
        return;
      }

      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePendingAmount = async () => {
    try {
      // Get all completed transactions that haven't been paid out yet
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('seller_amount')
        .eq('seller_user_id', user?.id)
        .eq('status', 'completed');

      if (error) {
        console.error('Error calculating pending amount:', error);
        return;
      }

      const totalEarnings = transactions?.reduce((sum, tx) => sum + tx.seller_amount, 0) || 0;
      
      // Get total already paid out
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('status', 'completed');

      if (payoutError) {
        console.error('Error fetching completed payouts:', payoutError);
        return;
      }

      const totalPaidOut = payoutData?.reduce((sum, payout) => sum + payout.amount, 0) || 0;
      setPendingAmount(totalEarnings - totalPaidOut);

      // Calculate next payout date (every Friday)
      const today = new Date();
      const nextFriday = new Date(today);
      nextFriday.setDate(today.getDate() + (5 - today.getDay() + 7) % 7);
      setNextPayoutDate(nextFriday.toLocaleDateString());
    } catch (error) {
      console.error('Error calculating pending amount:', error);
    }
  };

  const requestPayout = async () => {
    if (pendingAmount < 10) {
      toast({
        title: "Minimum Payout",
        description: "Minimum payout amount is $10.00",
        variant: "destructive",
      });
      return;
    }

    try {
      // In a real implementation, this would trigger a payout process
      toast({
        title: "Payout Requested",
        description: "Your payout request has been submitted and will be processed on the next payout date.",
      });
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast({
        title: "Error",
        description: "Failed to request payout. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground mt-2">
          Manage your weekly payouts and earnings
        </p>
      </div>

      {/* Payout Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${pendingAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for payout
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Next Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextPayoutDate}
            </div>
            <p className="text-xs text-muted-foreground">
              Every Friday
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payouts.filter(p => p.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Request Payout */}
      <Card>
        <CardHeader>
          <CardTitle>Request Payout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Request a payout for your pending earnings. Payouts are processed every Friday.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum payout amount: $10.00
              </p>
            </div>
            <Button 
              onClick={requestPayout}
              disabled={pendingAmount < 10}
            >
              Request Payout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payouts History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Requested</TableHead>
                <TableHead>Payout Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transfer ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(payout.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(payout.payout_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${payout.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {payout.transaction_count} transactions
                  </TableCell>
                  <TableCell>
                    <Badge variant={payout.status === 'completed' ? 'default' : 'secondary'}>
                      {payout.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {payout.stripe_transfer_id || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {payouts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No payouts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Payouts;