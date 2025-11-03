-- RPC: send funds to another user by their profile display_name
-- Requirements:
-- - Caller must own the source account
-- - Recipient must have at least one account in the same currency; we pick their default (name='Main') if available, else any
-- - Creates a transfer and posts it via post_transfer

set search_path = public;

CREATE OR REPLACE FUNCTION public.send_to_user(
  _from_account UUID,
  _recipient_handle TEXT,
  _amount NUMERIC,
  _currency TEXT,
  _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  src_currency TEXT;
  recipient_id UUID;
  dest_account UUID;
  transfer_id UUID;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Verify caller owns from account and currency matches
  SELECT currency INTO src_currency
  FROM public.accounts a
  WHERE a.id = _from_account AND a.user_id = caller;

  IF src_currency IS NULL THEN
    RAISE EXCEPTION 'Source account not found or not owned by user';
  END IF;

  IF src_currency <> _currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  -- Resolve recipient by handle
  SELECT user_id INTO recipient_id
  FROM public.profiles
  WHERE display_name = _recipient_handle;

  IF recipient_id IS NULL THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  -- Find recipient destination account in same currency (prefer Main)
  SELECT id INTO dest_account
  FROM public.accounts
  WHERE user_id = recipient_id AND currency = _currency AND name = 'Main'
  LIMIT 1;

  IF dest_account IS NULL THEN
    SELECT id INTO dest_account
    FROM public.accounts
    WHERE user_id = recipient_id AND currency = _currency
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF dest_account IS NULL THEN
    RAISE EXCEPTION 'Recipient has no account in %', _currency;
  END IF;

  -- Create transfer
  INSERT INTO public.transfers(
    from_account_id, to_account_id, amount, currency, description, initiated_by
  ) VALUES (
    _from_account, dest_account, _amount, _currency, _description, caller
  ) RETURNING id INTO transfer_id;

  -- Post transfer
  PERFORM public.post_transfer(transfer_id);

  RETURN transfer_id;
END;
$$;


