-- Create support tickets table for help system
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  admin_response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own support tickets" 
ON public.support_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own support tickets" 
ON public.support_tickets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all support tickets" 
ON public.support_tickets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create payouts table
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_date TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stripe_transfer_id TEXT,
  notes TEXT
);

-- Enable RLS for payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for payouts
CREATE POLICY "Users can view their own payouts" 
ON public.payouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts" 
ON public.payouts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action_url TEXT
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();