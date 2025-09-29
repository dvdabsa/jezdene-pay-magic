import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface Transaction {
  id: string;
  stripe_payment_intent_id: string;
  buyer_email: string;
  amount_total: number;
  stripe_fee: number;
  platform_fee: number;
  seller_amount: number;
  description: string;
  status: string;
  created_at: string;
  seller_profile?: {
    display_name: string;
  };
}

interface AdminStats {
  total_fees: number;
  total_transactions: number;
  total_volume: number;
}

export const AdminPanel = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total_fees: 0,
    total_transactions: 0,
    total_volume: 0,
  });

  useEffect(() => {
    console.log('AdminPanel useEffect - user:', user?.id);
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      // Set up real-time subscription for new transactions
      const channel = supabase
        .channel('admin-transactions')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions'
          },
          (payload) => {
            console.log('New transaction received:', payload);
            fetchAdminData(); // Refresh data when new transaction is added
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      console.log('Checking admin status for user:', user?.id);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .single();

      console.log('Admin check result:', { data, error });

      if (!error && data) {
        setIsAdmin(true);
        await fetchAdminData();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      console.log('Fetching admin data...');
      // Fetch all transactions with seller profile info
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles!seller_user_id(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('Transactions query result:', { transactionsData, transactionsError });

      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        return;
      }

      setTransactions(transactionsData || []);

      // Calculate stats from ALL completed transactions (not just the limited set)
      const { data: allTransactions, error: statsError } = await supabase
        .from('transactions')
        .select('platform_fee, amount_total, stripe_fee')
        .eq('status', 'completed');

      console.log('Stats query result:', { allTransactions, statsError });

      if (statsError) {
        console.error('Error fetching transaction stats:', statsError);
        return;
      }

      const totalFees = allTransactions?.reduce((sum, tx) => sum + (tx.platform_fee || 0), 0) || 0;
      const totalTransactions = allTransactions?.length || 0;
      const totalVolume = allTransactions?.reduce((sum, tx) => sum + (tx.amount_total || 0), 0) || 0;

      console.log('Calculated stats:', { totalFees, totalTransactions, totalVolume });

      setStats({
        total_fees: totalFees,
        total_transactions: totalTransactions,
        total_volume: totalVolume,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
  console.log('AdminPanel render - isAdmin:', isAdmin, 'loading:', loading, 'stats:', stats);
  
  return (
      <Card>
        <CardContent className="p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have admin privileges to view this panel.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${stats.total_fees.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_transactions}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.total_volume.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Platform Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {(transaction as any).profiles?.display_name || 'Unknown'}
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
                  <TableCell>
                    <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {transaction.description}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions found
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