-- Core digital banking schema: accounts, beneficiaries, transfers, ledger_entries, views, RLS
-- Assumes existing: public.app_role enum and public.has_role(user_id, role) from earlier migrations
-- Assumes existing timestamp update trigger function: public.update_updated_at_column()

set search_path = public;

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('active', 'frozen', 'closed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE public.account_type AS ENUM ('wallet', 'savings', 'escrow');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE public.transfer_status AS ENUM ('pending', 'posted', 'failed', 'cancelled', 'reversed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_type') THEN
    CREATE TYPE public.entry_type AS ENUM ('debit', 'credit');
  END IF;
END $$;

-- Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.account_type NOT NULL DEFAULT 'wallet',
  currency TEXT NOT NULL, -- ISO 4217 code like 'USD', 'EUR'
  status public.account_status NOT NULL DEFAULT 'active',
  name TEXT NOT NULL DEFAULT 'Main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accounts_currency_chk CHECK (char_length(currency) = 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_type_currency_name_uidx
  ON public.accounts (user_id, type, currency, name);

-- Beneficiaries (external payees)
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- owner
  display_name TEXT NOT NULL,
  bank_name TEXT,
  iban TEXT,
  account_number TEXT,
  routing_number TEXT,
  swift_bic TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beneficiaries_owner_name_unique UNIQUE (user_id, display_name)
);

-- Transfers
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  description TEXT,
  external_ref TEXT,
  initiated_by UUID NOT NULL, -- auth.users.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  failed_reason TEXT,
  CONSTRAINT transfers_positive_amount CHECK (amount > 0),
  CONSTRAINT transfers_currency_len CHECK (char_length(currency) = 3),
  CONSTRAINT transfers_accounts_distinct CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS transfers_from_idx ON public.transfers (from_account_id);
CREATE INDEX IF NOT EXISTS transfers_to_idx ON public.transfers (to_account_id);
CREATE INDEX IF NOT EXISTS transfers_status_idx ON public.transfers (status);

-- Ledger entries (double-entry lines)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transfer_id UUID REFERENCES public.transfers(id) ON DELETE SET NULL,
  type public.entry_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ledger_amount_positive CHECK (amount > 0),
  CONSTRAINT ledger_currency_len CHECK (char_length(currency) = 3)
);

CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON public.ledger_entries (account_id);
CREATE INDEX IF NOT EXISTS ledger_entries_transfer_idx ON public.ledger_entries (transfer_id);

-- Keep updated_at current
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficiaries_updated_at
BEFORE UPDATE ON public.beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Derived view for account balances (credits - debits)
CREATE OR REPLACE VIEW public.account_balances AS
SELECT a.id                AS account_id,
       a.user_id           AS user_id,
       a.currency          AS currency,
       COALESCE(SUM(CASE WHEN le.type = 'credit' THEN le.amount ELSE 0 END), 0)::NUMERIC(18,2)
       - COALESCE(SUM(CASE WHEN le.type = 'debit'  THEN le.amount ELSE 0 END), 0)::NUMERIC(18,2)
       AS balance
FROM public.accounts a
LEFT JOIN public.ledger_entries le ON le.account_id = a.id
GROUP BY a.id, a.user_id, a.currency;

-- Convenience view: accounts with computed balance
CREATE OR REPLACE VIEW public.accounts_with_balance AS
SELECT a.*, ab.balance
FROM public.accounts a
LEFT JOIN public.account_balances ab ON ab.account_id = a.id;

-- Function to post a transfer (security definer)
CREATE OR REPLACE FUNCTION public.post_transfer(_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.transfers%ROWTYPE;
  from_currency TEXT;
  to_currency TEXT;
BEGIN
  SELECT * INTO t FROM public.transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer % not found', _transfer_id;
  END IF;

  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer % is not pending', _transfer_id;
  END IF;

  SELECT currency INTO from_currency FROM public.accounts WHERE id = t.from_account_id;
  SELECT currency INTO to_currency   FROM public.accounts WHERE id = t.to_account_id;

  IF from_currency IS NULL OR to_currency IS NULL THEN
    RAISE EXCEPTION 'Invalid accounts for transfer %', _transfer_id;
  END IF;

  IF from_currency <> t.currency OR to_currency <> t.currency THEN
    RAISE EXCEPTION 'Currency mismatch for transfer %', _transfer_id;
  END IF;

  -- Create debit from source account
  INSERT INTO public.ledger_entries(account_id, transfer_id, type, amount, currency)
  VALUES (t.from_account_id, t.id, 'debit', t.amount, t.currency);

  -- Create credit to destination account
  INSERT INTO public.ledger_entries(account_id, transfer_id, type, amount, currency)
  VALUES (t.to_account_id, t.id, 'credit', t.amount, t.currency);

  UPDATE public.transfers
  SET status = 'posted', posted_at = now()
  WHERE id = t.id;
END;
$$;

-- RLS enablement
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Accounts policies
DROP POLICY IF EXISTS "Users own accounts" ON public.accounts;
CREATE POLICY "Users own accounts"
ON public.accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all accounts" ON public.accounts;
CREATE POLICY "Admins can manage all accounts"
ON public.accounts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Beneficiaries policies
DROP POLICY IF EXISTS "Users own beneficiaries" ON public.beneficiaries;
CREATE POLICY "Users own beneficiaries"
ON public.beneficiaries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all beneficiaries" ON public.beneficiaries;
CREATE POLICY "Admins can view all beneficiaries"
ON public.beneficiaries
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Transfers policies: visible to owners of from/to accounts
DROP POLICY IF EXISTS "Users can create transfers from own accounts" ON public.transfers;
CREATE POLICY "Users can create transfers from own accounts"
ON public.transfers
FOR INSERT
WITH CHECK (
  auth.uid() = initiated_by AND
  EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = from_account_id AND a.user_id = auth.uid()
  ) AND
  (
    -- allow internal transfer to own or others' accounts; viewing policy will scope visibility
    EXISTS (SELECT 1 FROM public.accounts a2 WHERE a2.id = to_account_id)
  )
);

DROP POLICY IF EXISTS "Users can view transfers involving their accounts" ON public.transfers;
CREATE POLICY "Users can view transfers involving their accounts"
ON public.transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = from_account_id AND a.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = to_account_id AND a.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all transfers" ON public.transfers;
CREATE POLICY "Admins can manage all transfers"
ON public.transfers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ledger entries policies: visible to owners of the account
DROP POLICY IF EXISTS "Users can view their ledger entries" ON public.ledger_entries;
CREATE POLICY "Users can view their ledger entries"
ON public.ledger_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all ledger entries" ON public.ledger_entries;
CREATE POLICY "Admins can view all ledger entries"
ON public.ledger_entries
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Optional safety: prevent direct insert into ledger_entries by users
DROP POLICY IF EXISTS "No user inserts ledger" ON public.ledger_entries;
CREATE POLICY "No user inserts ledger"
ON public.ledger_entries
FOR INSERT
TO public
WITH CHECK (false);

-- Helpful indexes for views/filters
CREATE INDEX IF NOT EXISTS accounts_user_idx ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS beneficiaries_user_idx ON public.beneficiaries(user_id);


