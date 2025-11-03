-- Setup platform treasury user for internal transfers
-- This migration creates a platform user and sets up the treasury account

set search_path = public;

-- Create a platform user (using a fixed UUID for consistency)
-- In production, you should use a real user ID from auth.users
DO $$
DECLARE
    platform_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- Insert platform user into auth.users if it doesn't exist
    -- Note: In production, this should be done through Supabase Auth
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        platform_user_id,
        '00000000-0000-0000-0000-000000000000'::UUID,
        'authenticated',
        'authenticated',
        'platform@treasury.local',
        '$2a$10$dummy.hash.for.platform.user',
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;

    -- Create platform profile
    INSERT INTO public.profiles (
        user_id,
        display_name,
        created_at,
        updated_at
    ) VALUES (
        platform_user_id,
        'Platform Treasury',
        now(),
        now()
    ) ON CONFLICT (user_id) DO NOTHING;

    -- Create platform treasury account
    INSERT INTO public.accounts (
        user_id,
        type,
        currency,
        status,
        name,
        created_at,
        updated_at
    ) VALUES (
        platform_user_id,
        'wallet',
        'USD',
        'active',
        'Treasury',
        now(),
        now()
    ) ON CONFLICT (user_id, type, currency, name) DO NOTHING;

    -- Add initial balance to treasury account (this is just for setup)
    -- In production, you would fund this account through real money flows
    INSERT INTO public.ledger_entries (
        account_id,
        type,
        amount,
        currency,
        created_at
    ) 
    SELECT 
        a.id,
        'credit',
        1000000.00, -- $1M initial treasury balance
        'USD',
        now()
    FROM public.accounts a
    WHERE a.user_id = platform_user_id 
    AND a.currency = 'USD' 
    AND a.name = 'Treasury'
    AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le 
        WHERE le.account_id = a.id
    );

END $$;

-- Grant necessary permissions to the platform user
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
