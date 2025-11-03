import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { HelpCircle, Send, MessageCircle, User, Shield } from "lucide-react";

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  admin_response?: string;
  responded_at?: string;
  profiles?: {
    display_name: string;
  };
}

const Help = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    message: '',
    priority: 'medium'
  });
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      fetchTickets();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .single();

      if (!error && data) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      // If not admin, only show user's own tickets
      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching support tickets:', error);
        return;
      }

      // Get user profiles for admin view
      if (isAdmin && data && data.length > 0) {
        const userIds = [...new Set(data.map(ticket => ticket.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {} as Record<string, any>);

        const ticketsWithProfiles = data.map(ticket => ({
          ...ticket,
          profiles: profilesMap[ticket.user_id] || { display_name: 'Unknown User' }
        }));

        setTickets(ticketsWithProfiles);
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
    }
  };

  const submitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id,
          subject: newTicket.subject.trim(),
          message: newTicket.message.trim(),
          priority: newTicket.priority
        });

      if (error) {
        console.error('Error submitting ticket:', error);
        toast({
          title: "Error",
          description: "Failed to submit your ticket. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Ticket Submitted",
        description: "Your support ticket has been submitted successfully.",
      });

      setNewTicket({ subject: '', message: '', priority: 'medium' });
      fetchTickets();
    } catch (error) {
      console.error('Error submitting ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const respondToTicket = async () => {
    if (!selectedTicket || !adminResponse.trim()) {
      toast({
        title: "Missing Response",
        description: "Please enter a response.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_response: adminResponse.trim(),
          responded_at: new Date().toISOString(),
          status: 'responded'
        })
        .eq('id', selectedTicket.id);

      if (error) {
        console.error('Error responding to ticket:', error);
        toast({
          title: "Error",
          description: "Failed to submit response. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Response Sent",
        description: "Your response has been sent to the user.",
      });

      setAdminResponse('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error) {
      console.error('Error responding to ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'destructive';
      case 'responded':
        return 'default';
      case 'closed':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">
            {isAdmin ? 'Support Management' : 'Help & Support'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isAdmin 
              ? 'Manage user support tickets and questions' 
              : 'Get help with your account and submit support requests'
            }
          </p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="ml-auto">
            <Shield className="h-4 w-4 mr-1" />
            Admin
          </Badge>
        )}
      </div>

      {/* Submit New Ticket (Non-Admin Only) */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit Support Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                placeholder="Brief description of your issue"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={newTicket.priority} 
                onValueChange={(value) => setNewTicket({...newTicket, priority: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={newTicket.message}
                onChange={(e) => setNewTicket({...newTicket, message: e.target.value})}
                placeholder="Please describe your issue in detail..."
                rows={4}
              />
            </div>
            <Button onClick={submitTicket} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Submit Ticket
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Response Modal */}
      {isAdmin && selectedTicket && (
        <Card>
          <CardHeader>
            <CardTitle>Respond to Ticket: {selectedTicket.subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">Original Message:</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedTicket.message}</p>
            </div>
            <div>
              <Label htmlFor="admin_response">Your Response</Label>
              <Textarea
                id="admin_response"
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Type your response to the user..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={respondToTicket} disabled={loading}>
                Send Response
              </Button>
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {isAdmin ? 'All Support Tickets' : 'Your Support Tickets'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                {isAdmin && <TableHead>User</TableHead>}
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {ticket.message}
                      </p>
                      {ticket.admin_response && (
                        <div className="mt-2 p-2 bg-green-50 rounded border-l-2 border-green-500">
                          <p className="text-sm">
                            <strong>Response:</strong> {ticket.admin_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {(ticket as any).profiles?.display_name || 'Unknown User'}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={getPriorityVariant(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {ticket.status === 'open' && (
                        <Button 
                          size="sm" 
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          Respond
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                    No support tickets found
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

export default Help;