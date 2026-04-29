'use strict';
process.chdir('/var/www/html/backend');
require('dotenv').config({ path: '/var/www/html/backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Use Caleb's Apollo integration (personal)
  const { data: integration, error } = await sb.from('integrations')
    .select('*')
    .eq('id', '1a7a6a2c-60ac-4d85-9200-029bb95f5721')
    .single();

  if (error || !integration) {
    console.error('Integration not found:', error?.message);
    process.exit(1);
  }

  const is = require('./integrationService');
  const creds = is.decryptCredentials(integration.credentials);

  const res = await fetch('https://api.apollo.io/api/v1/opportunities/search?per_page=1', {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'X-Api-Key': creds.api_key,
    },
  });

  console.log('Apollo API status:', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text();
    console.error('Error:', text.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();
  const opps = data.opportunities || [];

  if (opps.length === 0) {
    console.log('No opportunities found.');
    process.exit(0);
  }

  const opp = opps[0];
  console.log('\n=== ALL FIELD NAMES on Apollo Opportunity ===');
  console.log(Object.keys(opp).sort().join('\n'));

  console.log('\n=== FULL FIRST OPPORTUNITY ===');
  console.log(JSON.stringify(opp, null, 2));

  // Specifically check for date/update fields
  console.log('\n=== DATE/UPDATE FIELDS ===');
  const dateFields = Object.keys(opp).filter(k =>
    k.includes('date') || k.includes('time') || k.includes('update') || k.includes('modif') || k.includes('created') || k.includes('close')
  );
  for (const f of dateFields) {
    console.log(`  ${f}: ${opp[f]}`);
  }

  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
