#!/usr/bin/env node

/**
 * Test script to verify the balance fix
 * This script simulates a payment and checks if the balance updates correctly
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBalanceFix() {
  try {
    console.log('🧪 Testing balance fix...\n');

    // 1. Find a test user
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .limit(1);

    if (usersError || !users.length) {
      console.log('❌ No users found. Please create a user account first.');
      return;
    }

    const testUser = users[0];
    console.log('👤 Test user:', testUser.display_name, '(' + testUser.user_id + ')');

    // 2. Check current balance
    const { data: currentBalance, error: balanceError } = await supabase
      .from('accounts_with_balance')
      .select('balance')
      .eq('user_id', testUser.user_id)
      .eq('currency', 'USD')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      throw balanceError;
    }

    const beforeBalance = currentBalance?.balance || 0;
    console.log('💰 Current balance: $' + beforeBalance.toFixed(2));

    // 3. Create a test ledger entry (simulating a payment)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', testUser.user_id)
      .eq('currency', 'USD')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (accountError) {
      console.log('❌ No USD account found for user. Creating one...');
      
      const { data: newAccount, error: createError } = await supabase
        .from('accounts')
        .insert({
          user_id: testUser.user_id,
          currency: 'USD',
          type: 'wallet',
          name: 'Main'
        })
        .select('id')
        .single();

      if (createError) throw createError;
      account.id = newAccount.id;
    }

    console.log('📊 Account ID:', account.id);

    // 4. Add a test credit
    const testAmount = 50.00;
    const { error: creditError } = await supabase
      .from('ledger_entries')
      .insert({
        account_id: account.id,
        type: 'credit',
        amount: testAmount,
        currency: 'USD'
      });

    if (creditError) {
      throw creditError;
    }

    console.log('✅ Added test credit of $' + testAmount.toFixed(2));

    // 5. Check updated balance
    const { data: updatedBalance, error: updatedBalanceError } = await supabase
      .from('accounts_with_balance')
      .select('balance')
      .eq('user_id', testUser.user_id)
      .eq('currency', 'USD')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (updatedBalanceError) {
      throw updatedBalanceError;
    }

    const afterBalance = updatedBalance?.balance || 0;
    console.log('💰 Updated balance: $' + afterBalance.toFixed(2));

    // 6. Verify the fix
    const expectedBalance = beforeBalance + testAmount;
    if (Math.abs(afterBalance - expectedBalance) < 0.01) {
      console.log('✅ SUCCESS: Balance updated correctly!');
      console.log('   Expected: $' + expectedBalance.toFixed(2));
      console.log('   Actual: $' + afterBalance.toFixed(2));
    } else {
      console.log('❌ FAILED: Balance not updated correctly');
      console.log('   Expected: $' + expectedBalance.toFixed(2));
      console.log('   Actual: $' + afterBalance.toFixed(2));
    }

    // 7. Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('ledger_entries')
      .delete()
      .eq('account_id', account.id)
      .eq('amount', testAmount)
      .eq('type', 'credit');

    if (cleanupError) {
      console.log('⚠️  Warning: Could not clean up test data:', cleanupError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBalanceFix();
