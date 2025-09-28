import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, description, seller_account } = await req.json();

    // Validate input
    if (!amount || !description || !seller_account) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fees: 3% + $0.30
    const platformFeeAmount = Math.round((amount * 0.03 + 0.30) * 100); // Convert to cents
    const sellerAmount = Math.round(amount * 100) - platformFeeAmount;

    console.log(`Creating payment link for $${amount}`);
    console.log(`Platform fee: $${platformFeeAmount / 100}`);
    console.log(`Seller amount: $${sellerAmount / 100}`);

    // Create Stripe payment link
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, create a product
    const productResponse = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: description,
        description: `Payment for: ${description} | Seller: ${seller_account}`,
      }),
    });

    if (!productResponse.ok) {
      const error = await productResponse.text();
      console.error('Stripe product creation failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create product' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const product = await productResponse.json();

    // Create a price for the product
    const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: Math.round(amount * 100).toString(), // Convert to cents
        currency: 'usd',
      }),
    });

    if (!priceResponse.ok) {
      const error = await priceResponse.text();
      console.error('Stripe price creation failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create price' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const price = await priceResponse.json();

    // Create payment link
    const paymentLinkResponse = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
        'metadata[seller_account]': seller_account,
        'metadata[platform_fee]': (platformFeeAmount / 100).toString(),
        'metadata[seller_amount]': (sellerAmount / 100).toString(),
      }),
    });

    if (!paymentLinkResponse.ok) {
      const error = await paymentLinkResponse.text();
      console.error('Stripe payment link creation failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentLink = await paymentLinkResponse.json();

    console.log('Payment link created successfully:', paymentLink.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_link: paymentLink,
        fees: {
          platform_fee: platformFeeAmount / 100,
          seller_amount: sellerAmount / 100,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-payment-link function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
