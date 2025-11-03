import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface Transaction {
  id: string;
  buyer_email: string;
  amount_total: number;
  platform_fee: number;
  seller_amount: number;
  description: string;
  status: string;
  created_at: string;
}

export const FeeEarnings = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserTransactions();
    }
  }, [user]);

  const fetchUserTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('seller_user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      setTransactions(data || []);
      
      // Calculate total platform fees earned by this user
      const total = data?.reduce((sum, tx) => sum + tx.platform_fee, 0) || 0;
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading earnings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Your Platform Fee Earnings
          <div className="text-2xl font-bold text-primary">
            ${totalEarnings.toFixed(2)}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Fees earned from your successful payment links
        </p>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No transactions yet. Create a payment link to start earning!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Platform Fee</TableHead>
                <TableHead>Your Earnings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transaction.buyer_email}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${transaction.amount_total.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    ${transaction.platform_fee.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${transaction.seller_amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                      {transaction.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};