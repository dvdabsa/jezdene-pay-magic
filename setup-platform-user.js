#!/usr/bin/env node

/**
 * Setup script to configure the platform treasury user
 * This script helps set up the PLATFORM_USER_ID environment variable
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupPlatformUser() {
  try {
    console.log('🔍 Looking for platform treasury user...');
    
    // Check if platform user exists
    const { data: platformUser, error: userError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('display_name', 'Platform Treasury')
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    if (!platformUser) {
      console.log('❌ Platform treasury user not found. Please run the migration first:');
      console.log('   supabase db reset');
      console.log('   or');
      console.log('   supabase migration up');
      return;
    }

    console.log('✅ Platform treasury user found:', platformUser.user_id);
    
    // Check if treasury account exists
    const { data: treasuryAccount, error: accountError } = await supabase
      .from('accounts')
      .select('id, balance')
      .eq('user_id', platformUser.user_id)
      .eq('name', 'Treasury')
      .eq('currency', 'USD')
      .single();

    if (accountError) {
      throw accountError;
    }

    console.log('✅ Treasury account found:', treasuryAccount.id);
    console.log('💰 Treasury balance:', treasuryAccount.balance || 0);

    console.log('\n📋 Next steps:');
    console.log('1. Set the PLATFORM_USER_ID environment variable in your Supabase project:');
    console.log(`   PLATFORM_USER_ID=${platformUser.user_id}`);
    console.log('\n2. In your Supabase dashboard:');
    console.log('   - Go to Settings > Edge Functions');
    console.log('   - Add environment variable: PLATFORM_USER_ID');
    console.log('   - Set value to:', platformUser.user_id);
    console.log('\n3. Redeploy your edge functions:');
    console.log('   supabase functions deploy stripe-webhook');

  } catch (error) {
    console.error('❌ Error setting up platform user:', error.message);
    process.exit(1);
  }
}

setupPlatformUser();
