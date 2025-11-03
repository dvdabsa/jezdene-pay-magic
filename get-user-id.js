#!/usr/bin/env node

/**
 * Script to get your user ID for setting up platform treasury
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserInfo() {
  try {
    console.log('🔍 Getting your user information...\n');
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('❌ Not authenticated. Please log in to your app first.');
      console.log('   Go to your app, log in, then run this script again.');
      return;
    }

    if (!user) {
      console.log('❌ No user found. Please log in to your app first.');
      return;
    }

    console.log('✅ User found!');
    console.log('👤 Email:', user.email);
    console.log('🆔 User ID:', user.id);
    console.log('📅 Created:', new Date(user.created_at).toLocaleString());
    
    // Check if user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, created_at')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.log('⚠️  Could not fetch profile:', profileError.message);
    } else if (profile) {
      console.log('📝 Display Name:', profile.display_name);
    }

    console.log('\n🎯 Next steps:');
    console.log('1. Copy your User ID:', user.id);
    console.log('2. Go to Supabase Dashboard → Functions → Settings');
    console.log('3. Add environment variable:');
    console.log('   Name: PLATFORM_USER_ID');
    console.log('   Value:', user.id);
    console.log('4. Redeploy your stripe-webhook function');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure you are logged in to your app first.');
  }
}

getUserInfo();
