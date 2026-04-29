'use strict';
process.chdir('/var/www/html/backend');
require('dotenv').config({ path: '/var/www/html/backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: integration } = await sb.from('integrations')
    .select('*').eq('id', '1a7a6a2c-60ac-4d85-9200-029bb95f5721').single();

  const is = require('./integrationService');
  const creds = is.decryptCredentials(integration.credentials);

  const res = await fetch('https://api.apollo.io/api/v1/opportunity_stages', {
    headers: { 'X-Api-Key': creds.api_key, 'Content-Type': 'application/json' },
  });
  const data = await res.json();

  console.log('\nAll Apollo Deal Stages (sorted by display_order):');
  console.log('='.repeat(70));
  data.opportunity_stages
    .sort((a, b) => a.display_order - b.display_order)
    .forEach(s => {
      const flags = [s.is_won && 'WON', s.is_closed && 'CLOSED', s.is_meeting_set && 'MEETING_SET'].filter(Boolean).join(' ');
      console.log(`  ${s.display_order}. ${s.name.padEnd(25)} prob:${String(s.probability).padStart(3)}%  type:${s.type.padEnd(8)}  ${flags}  id:${s.id}`);
    });

  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
