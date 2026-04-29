'use strict';
process.chdir('/var/www/html/backend');
require('dotenv').config({ path: '/var/www/html/backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Find the Salesforce integration
  const { data: integration, error } = await sb.from('integrations')
    .select('*')
    .eq('integration_type', 'salesforce')
    .eq('status', 'connected')
    .limit(1)
    .single();

  if (error || !integration) {
    console.error('No connected Salesforce integration found:', error?.message);
    process.exit(1);
  }

  console.log('Integration ID:', integration.id);
  console.log('Org ID:', integration.organization_id);

  const is = require('./integrationService');
  const creds = is.decryptCredentials(integration.credentials);

  // Need to ensure token is fresh
  const freshIntegration = await is.ensureFreshToken(sb, integration);
  const freshCreds = freshIntegration.decryptedCreds;

  const SF_API_VERSION = process.env.SALESFORCE_API_VERSION || 'v59.0';
  const url = `${freshCreds.instance_url}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(
    'SELECT MasterLabel, SortOrder, IsClosed, IsWon, DefaultProbability, Description FROM OpportunityStage ORDER BY SortOrder'
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${freshCreds.access_token}` },
  });

  console.log('\nSalesforce API status:', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text();
    console.error('Error:', text.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();

  console.log('\nAll Salesforce Opportunity Stages (sorted by SortOrder):');
  console.log('='.repeat(80));
  for (const s of (data.records || [])) {
    const flags = [s.IsWon && 'WON', s.IsClosed && 'CLOSED'].filter(Boolean).join(' ');
    console.log(`  ${String(s.SortOrder).padStart(2)}. ${s.MasterLabel.padEnd(30)} prob:${String(s.DefaultProbability || 0).padStart(3)}%  ${flags.padEnd(12)} ${s.Description || ''}`);
  }

  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
