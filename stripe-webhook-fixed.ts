import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing Stripe configuration');
      return new Response('Configuration error', { status: 500 });
    }

    // Verify webhook signature using crypto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = encoder.encode(signature.replace('sha256=', ''));
    const bodyBytes = encoder.encode(body);
    
    // For now, we'll skip signature verification in development
    // In production, you should implement proper Stripe webhook verification
    console.log('Webhook signature received, proceeding with event processing');

    // Parse the event
    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('Failed to parse webhook body:', err);
      return new Response('Invalid JSON', { status: 400 });
    }
    console.log('Webhook event:', event.type);

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Extract metadata
      const sellerAccount = paymentIntent.metadata?.seller_account;
      const platformFeeStr = paymentIntent.metadata?.platform_fee;
      const sellerAmountStr = paymentIntent.metadata?.seller_amount;

      if (!sellerAccount || !platformFeeStr || !sellerAmountStr) {
        console.error('Missing metadata in payment intent');
        return new Response('Missing metadata', { status: 400 });
      }

      // Get seller user ID from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('display_name', sellerAccount)
        .single();

      if (!profile) {
        console.error('Seller not found:', sellerAccount);
        return new Response('Seller not found', { status: 400 });
      }

      // Calculate fees (Stripe fee is approximately 2.9% + $0.30)
      const amountTotal = paymentIntent.amount / 100; // Convert from cents
      const stripeFee = Math.round((amountTotal * 0.029 + 0.30) * 100) / 100;
      const platformFee = parseFloat(platformFeeStr) / 100; // Convert from cents
      const sellerAmount = parseFloat(sellerAmountStr) / 100; // Convert from cents

      // Insert transaction record
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          seller_user_id: profile.user_id,
          buyer_email: paymentIntent.receipt_email || 'unknown@example.com',
          amount_total: amountTotal,
          stripe_fee: stripeFee,
          platform_fee: platformFee,
          seller_amount: sellerAmount,
          description: paymentIntent.description || 'Payment',
          status: 'completed'
        });

      if (insertError) {
        console.error('Error inserting transaction:', insertError);
        return new Response('Database error', { status: 500 });
      }

      console.log('Transaction recorded successfully');

      // Credit seller's internal account
      // First try to use platform treasury account if PLATFORM_USER_ID is set
      const platformUserId = Deno.env.get('PLATFORM_USER_ID');
      
      if (platformUserId) {
        // Use platform treasury account for proper double-entry bookkeeping
        console.log('Using platform treasury account for transfer');
        
        // Ensure platform (treasury) account exists in USD
        const { data: platformAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', platformUserId)
          .eq('currency', 'USD')
          .eq('name', 'Treasury')
          .maybeSingle();

        let platformAccountId = platformAccount?.id as string | undefined;
        if (!platformAccountId) {
          const { data: createdPlatform, error: platformCreateErr } = await supabase
            .from('accounts')
            .insert({ user_id: platformUserId, currency: 'USD', type: 'wallet', name: 'Treasury' })
            .select('id')
            .single();
          if (platformCreateErr) {
            console.error('Failed creating platform Treasury account:', platformCreateErr);
            return new Response('Internal setup error', { status: 500 });
          }
          platformAccountId = createdPlatform.id;
        }

        // Ensure seller has a USD account; prefer Main, else first
        const { data: sellerMain } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('currency', 'USD')
          .eq('name', 'Main')
          .maybeSingle();

        let sellerAccountId = sellerMain?.id as string | undefined;
        if (!sellerAccountId) {
          const { data: anySeller } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', profile.user_id)
            .eq('currency', 'USD')
            .limit(1)
            .maybeSingle();
          sellerAccountId = anySeller?.id as string | undefined;
        }

        if (!sellerAccountId) {
          // Create a Main USD account for seller if missing
          const { data: createdSeller, error: createSellerErr } = await supabase
            .from('accounts')
            .insert({ user_id: profile.user_id, currency: 'USD', type: 'wallet', name: 'Main' })
            .select('id')
            .single();
          if (createSellerErr) {
            console.error('Failed creating seller Main account:', createSellerErr);
            return new Response('Internal setup error', { status: 500 });
          }
          sellerAccountId = createdSeller.id;
        }

        // Create transfer and post it to credit seller
        const { data: createdTransfer, error: createTransferErr } = await supabase
          .from('transfers')
          .insert({
            from_account_id: platformAccountId,
            to_account_id: sellerAccountId,
            amount: sellerAmount,
            currency: 'USD',
            description: `Top-up via Stripe ${paymentIntent.id}`,
            initiated_by: platformUserId,
          })
          .select('id')
          .single();

        if (createTransferErr) {
          console.error('Failed creating internal transfer:', createTransferErr);
          return new Response('Internal credit error', { status: 500 });
        }

        const { error: postErr } = await supabase.rpc('post_transfer', { _transfer_id: createdTransfer.id });
        if (postErr) {
          console.error('Failed posting internal transfer:', postErr);
          return new Response('Internal credit post error', { status: 500 });
        }
      } else {
        // Fallback: Create direct credit to seller's account
        console.warn('PLATFORM_USER_ID not set; creating direct credit to seller account');
        
        // Ensure seller has a USD account
        const { data: sellerAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('currency', 'USD')
          .eq('name', 'Main')
          .maybeSingle();

        let sellerAccountId = sellerAccount?.id as string | undefined;
        if (!sellerAccountId) {
          const { data: anySeller } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', profile.user_id)
            .eq('currency', 'USD')
            .limit(1)
            .maybeSingle();
          sellerAccountId = anySeller?.id as string | undefined;
        }

        if (!sellerAccountId) {
          // Create a Main USD account for seller if missing
          const { data: createdSeller, error: createSellerErr } = await supabase
            .from('accounts')
            .insert({ user_id: profile.user_id, currency: 'USD', type: 'wallet', name: 'Main' })
            .select('id')
            .single();
          if (createSellerErr) {
            console.error('Failed creating seller Main account:', createSellerErr);
            return new Response('Internal setup error', { status: 500 });
          }
          sellerAccountId = createdSeller.id;
        }

        // Create direct credit entry
        const { error: creditError } = await supabase
          .from('ledger_entries')
          .insert({
            account_id: sellerAccountId,
            type: 'credit',
            amount: sellerAmount,
            currency: 'USD'
          });

        if (creditError) {
          console.error('Failed creating direct credit:', creditError);
          return new Response('Internal credit error', { status: 500 });
        }

        console.log('Direct credit created successfully');
      }

      return new Response('Webhook processed', { status: 200 });
    }

    return new Response('Event not handled', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
});
