'use strict';
process.chdir('/var/www/html/backend');
require('dotenv').config({ path: '/var/www/html/backend/.env' });

const { createClient } = require('@supabase/supabase-js');

async function run() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: integration, error } = await sb.from('integrations')
    .select('*')
    .eq('id', '1a7a6a2c-60ac-4d85-9200-029bb95f5721')
    .single();

  if (error) { console.error('Integration fetch error:', error.message); process.exit(1); }

  const integrationService = require('./integrationService');
  const creds = integrationService.decryptCredentials(integration.credentials);
  const headers = { 'Cache-Control': 'no-cache', 'Content-Type': 'application/json', 'X-Api-Key': creds.api_key };

  const tryEndpoint = async (label, url, method = 'GET', body = null) => {
    console.log(`\n=== ${label}: ${method} ${url} ===`);
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log('Top-level keys:', Object.keys(data));
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          console.log(`  "${key}": array of ${data[key].length} items`);
          if (data[key].length > 0) {
            console.log('  First item:');
            console.log(JSON.stringify(data[key][0], null, 2));
          }
        } else if (key === 'pagination') {
          console.log(`  pagination: ${JSON.stringify(data[key])}`);
        }
      }
      if (!Object.values(data).some(v => Array.isArray(v) && v.length > 0)) {
        console.log('Full response:', JSON.stringify(data, null, 2));
      }
    } else {
      const body = await res.text();
      console.log('Error body:', body.slice(0, 500));
    }
  };

  // Per Apollo docs: GET /opportunities/search (list deals)
  await tryEndpoint('List Deals (docs)', 'https://api.apollo.io/api/v1/opportunities/search?per_page=5');

  // Deal stages
  await tryEndpoint('Deal Stages', 'https://api.apollo.io/api/v1/opportunity_stages');

  // Fallback: POST /opportunities/search
  await tryEndpoint('List Deals POST', 'https://api.apollo.io/api/v1/opportunities/search', 'POST', { per_page: 5 });

  // Fallback: GET /opportunities (no /search)
  await tryEndpoint('GET /opportunities', 'https://api.apollo.io/api/v1/opportunities?per_page=5');

  process.exit(0);
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
