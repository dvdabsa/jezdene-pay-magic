import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { from_account_id, to_account_id, amount, currency, description } = await req.json();

    if (!from_account_id || !to_account_id || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Who is calling?
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const initiated_by = userData.user.id;

    // Validate ownership of from_account via RLS (select should succeed only if owner)
    const { data: fromAcc, error: fromAccErr } = await supabase
      .from('accounts')
      .select('id, currency')
      .eq('id', from_account_id)
      .single();

    if (fromAccErr || !fromAcc) {
      return new Response(
        JSON.stringify({ error: 'Invalid from_account or not owned by user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure destination exists (can be any account; viewing is not required)
    const { data: toAcc, error: toAccErr } = await supabase
      .from('accounts')
      .select('id, currency')
      .eq('id', to_account_id)
      .single();

    if (toAccErr || !toAcc) {
      return new Response(
        JSON.stringify({ error: 'Destination account not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fromAcc.currency !== currency || toAcc.currency !== currency) {
      return new Response(
        JSON.stringify({ error: 'Currency mismatch with accounts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transfer (RLS enforces ownership of from_account and initiated_by)
    const { data: transfer, error: createErr } = await supabase
      .from('transfers')
      .insert({
        from_account_id,
        to_account_id,
        amount,
        currency,
        description: description ?? null,
        initiated_by,
      })
      .select('*')
      .single();

    if (createErr || !transfer) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? 'Failed to create transfer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Post the transfer (creates ledger entries, sets status)
    const { error: postErr } = await supabase.rpc('post_transfer', { _transfer_id: transfer.id });
    if (postErr) {
      return new Response(
        JSON.stringify({ error: postErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


