#!/bin/bash

# Deploy the balance fix to Supabase
# Make sure you have SUPABASE_ACCESS_TOKEN set

echo "🚀 Deploying balance fix to Supabase..."

# Check if access token is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ SUPABASE_ACCESS_TOKEN not set"
    echo "Please get your token from: https://supabase.com/dashboard/account/tokens"
    echo "Then run: export SUPABASE_ACCESS_TOKEN=your_token_here"
    exit 1
fi

# Deploy the updated webhook function
echo "📦 Deploying stripe-webhook function..."
npx supabase functions deploy stripe-webhook --project-ref cmcdksmgkjfikerrgugy

if [ $? -eq 0 ]; then
    echo "✅ Webhook function deployed successfully!"
    echo ""
    echo "🎉 The balance fix is now live!"
    echo "   - Money received via Stripe will now be credited to user accounts"
    echo "   - Account balances will update in real-time"
    echo "   - Admin dashboard and user balance will stay in sync"
    echo ""
    echo "🧪 To test the fix:"
    echo "   1. Create a payment link in your app"
    echo "   2. Complete a test payment"
    echo "   3. Check that the account balance updates"
else
    echo "❌ Deployment failed. Please check the error above."
    exit 1
fi
