'use strict';
process.chdir('/var/www/html/backend');
require('dotenv').config({ path: '/var/www/html/backend/.env' });

const { createClient } = require('@supabase/supabase-js');

async function run() {
  console.log('SUPABASE_URL present:', !!process.env.SUPABASE_URL);
  console.log('SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: integration, error } = await sb.from('integrations')
    .select('*')
    .eq('id', '1a7a6a2c-60ac-4d85-9200-029bb95f5721')
    .single();

  if (error) { console.error('Integration fetch error:', error.message); process.exit(1); }

  const integrationService = require('./integrationService');
  const creds = integrationService.decryptCredentials(integration.credentials);

  console.log('API key present:', !!creds.api_key);
  console.log('API key length:', creds.api_key?.length);

  const url = 'https://api.apollo.io/api/v1/phone_calls/search?per_page=5&sort_by_field=created_at&sort_ascending=false';
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'X-Api-Key': creds.api_key,
    },
  });

  console.log('Apollo API status:', res.status, res.statusText);
  const data = await res.json();
  console.log('Total calls found:', data.pagination?.total_entries);
  console.log('Calls array length:', data.phone_calls?.length);

  if (data.phone_calls?.length > 0) {
    console.log('\nFirst call raw structure:');
    console.log(JSON.stringify(data.phone_calls[0], null, 2));
  } else {
    console.log('\nFull response:');
    console.log(JSON.stringify(data, null, 2));
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
