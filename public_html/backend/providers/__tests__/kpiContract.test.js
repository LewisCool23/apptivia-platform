/**
 * KPI Canonical Contract Tests
 *
 * Validates that the canonical KPI translation layer produces
 * consistent, correct mappings across all providers.
 *
 * Run: node providers/__tests__/kpiContract.test.js
 * (No jest required — standalone assertions)
 */

'use strict';

const { KPI_CANONICAL, buildKpiMapping, getWeekStart } = require('../kpiCanonical');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, expectedMsg, label) {
  try {
    fn();
    failed++;
    console.error(`  FAIL: ${label} — expected throw but did not throw`);
  } catch (err) {
    if (err.message.includes(expectedMsg)) {
      passed++;
    } else {
      failed++;
      console.error(`  FAIL: ${label} — threw "${err.message}" but expected "${expectedMsg}"`);
    }
  }
}

// ── Transformer Tests ────────────────────────────────────────

console.log('\n=== KPI Canonical Transformer Tests ===\n');

// talk_time_minutes: seconds -> minutes with 2 decimal precision
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 300, fromUnit: 'Seconds',
    source: 'test', externalEventId: 'test:1:tt', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 5.00, 'talk_time_minutes 300s = 5.00min');
  assertEq(mapping.aggregation, 'sum', 'talk_time_minutes aggregation = sum');
}

// talk_time_minutes: 67 seconds (real Apollo value)
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 67, fromUnit: 'Seconds',
    source: 'apollo', externalEventId: 'test:2:tt', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 1.12, 'talk_time_minutes 67s = 1.12min');
}

// talk_time_minutes: milliseconds (HubSpot uses ms)
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 180000, fromUnit: 'Milliseconds',
    source: 'hubspot', externalEventId: 'test:3:tt', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 3.00, 'talk_time_minutes 180000ms = 3.00min');
}

// talk_to_listen_ratio: 0.65 ratio -> 65.0%
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_to_listen_ratio', rawValue: 0.65, fromUnit: 'Ratio',
    source: 'apollo', externalEventId: 'test:4:ratio', weekStart: '2026-04-14',
  });
  assertEq(mapping.value, 65.0, 'talk_to_listen_ratio 0.65 = 65.0%');
  assertEq(mapping.aggregation, 'avg', 'talk_to_listen_ratio aggregation = avg');
  assert(mapping.increment === undefined, 'talk_to_listen_ratio has no increment (uses value)');
}

// talk_to_listen_ratio: already percent
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_to_listen_ratio', rawValue: 72.3, fromUnit: 'Percent',
    source: 'gong', externalEventId: 'test:5:ratio', weekStart: '2026-04-14',
  });
  assertEq(mapping.value, 72.3, 'talk_to_listen_ratio 72.3% = 72.3%');
}

// longest_monologue_sec: max aggregation
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'longest_monologue_sec', rawValue: 45.7, fromUnit: 'Seconds',
    source: 'gong', externalEventId: 'test:6:mono', weekStart: '2026-04-14',
  });
  assertEq(mapping.value, 46, 'longest_monologue_sec 45.7 rounds to 46');
  assertEq(mapping.aggregation, 'max', 'longest_monologue_sec aggregation = max');
}

// next_steps_mentioned: boolean -> count
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'next_steps_mentioned', rawValue: true, fromUnit: 'Boolean',
    source: 'apollo', externalEventId: 'test:7:ns', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 1, 'next_steps_mentioned true = 1');
}
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'next_steps_mentioned', rawValue: false, fromUnit: 'Boolean',
    source: 'apollo', externalEventId: 'test:8:ns', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 0, 'next_steps_mentioned false = 0');
}

// revenue_generated: dollars
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'revenue_generated', rawValue: 49999.995, fromUnit: 'Dollars',
    source: 'salesforce', externalEventId: 'test:9:rev', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 50000.00, 'revenue_generated rounds to 2 decimals');
  assertEq(mapping.aggregation, 'sum', 'revenue_generated aggregation = sum');
}

// revenue_generated: cents
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'revenue_generated', rawValue: 1599, fromUnit: 'Cents',
    source: 'test', externalEventId: 'test:10:rev', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 15.99, 'revenue_generated 1599 cents = $15.99');
}

// call_connects: simple count
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
    source: 'outreach', externalEventId: 'test:11:cc', weekStart: '2026-04-14',
  });
  assertEq(mapping.increment, 1, 'call_connects = 1');
  assertEq(mapping.aggregation, 'sum', 'call_connects aggregation = sum');
}

// interactivity_score: avg aggregation
{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'interactivity_score', rawValue: 75.5, fromUnit: 'Score',
    source: 'gong', externalEventId: 'test:12:is', weekStart: '2026-04-14',
  });
  assertEq(mapping.value, 75.5, 'interactivity_score 75.5');
  assertEq(mapping.aggregation, 'avg', 'interactivity_score aggregation = avg');
}

// ── Error Tests ──────────────────────────────────────────────

console.log('\n=== Error Handling Tests ===\n');

assertThrows(
  () => buildKpiMapping({
    profileId: 'p1', kpiKey: 'unknown_kpi', rawValue: 1, fromUnit: 'Count',
    source: 'test', externalEventId: 'test:err1', weekStart: '2026-04-14',
  }),
  'Unknown KPI key: unknown_kpi',
  'throws on unknown KPI key'
);

assertThrows(
  () => buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 300, fromUnit: 'Bananas',
    source: 'test', externalEventId: 'test:err2', weekStart: '2026-04-14',
  }),
  'has no transformer for unit: Bananas',
  'throws on unknown unit transformer'
);

// ── Null/NaN Handling ────────────────────────────────────────

console.log('\n=== Null/NaN Safety Tests ===\n');

{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: NaN, fromUnit: 'Seconds',
    source: 'test', externalEventId: 'test:null1', weekStart: '2026-04-14',
  });
  assert(mapping === null, 'NaN rawValue returns null');
}

{
  const mapping = buildKpiMapping({
    profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 'not-a-number', fromUnit: 'Seconds',
    source: 'test', externalEventId: 'test:null2', weekStart: '2026-04-14',
  });
  assert(mapping === null, 'non-numeric string returns null');
}

// ── getWeekStart Tests ───────────────────────────────────────

console.log('\n=== getWeekStart Tests ===\n');

assertEq(getWeekStart('2026-04-16T14:30:00Z'), '2026-04-13', 'Wednesday 2026-04-16 -> Monday 2026-04-13');
assertEq(getWeekStart('2026-04-13T12:00:00Z'), '2026-04-13', 'Monday noon stays Monday');
assertEq(getWeekStart('2026-04-19T23:59:59Z'), '2026-04-13', 'Sunday 2026-04-19 -> Monday 2026-04-13');

// ── Coverage Tests ───────────────────────────────────────────

console.log('\n=== Canonical Coverage Tests ===\n');

const canonicalKeys = Object.keys(KPI_CANONICAL);
assert(canonicalKeys.length >= 19, `At least 19 canonical KPIs defined (got ${canonicalKeys.length})`);

// Verify every canonical KPI has at least one transformer
for (const key of canonicalKeys) {
  const kpi = KPI_CANONICAL[key];
  const transformers = Object.keys(kpi).filter(k => k.startsWith('from'));
  assert(transformers.length > 0, `${key} has at least one transformer`);
  assert(['sum', 'avg', 'max'].includes(kpi.aggregation), `${key} has valid aggregation: ${kpi.aggregation}`);
}

// ── Cross-Provider Consistency ───────────────────────────────

console.log('\n=== Cross-Provider Consistency ===\n');

// Same KPI from different providers should produce identical structure
const apolloConnect = buildKpiMapping({
  profileId: 'p1', kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
  source: 'apollo', externalEventId: 'apollo:1:cc', weekStart: '2026-04-14',
});
const gongConnect = buildKpiMapping({
  profileId: 'p1', kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
  source: 'gong', externalEventId: 'gong:1:cc', weekStart: '2026-04-14',
});
assertEq(apolloConnect.increment, gongConnect.increment, 'Apollo and Gong call_connects produce same increment');
assertEq(apolloConnect.aggregation, gongConnect.aggregation, 'Apollo and Gong call_connects have same aggregation');

// Same talk time from different providers: 300 seconds
const apolloTT = buildKpiMapping({
  profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 300, fromUnit: 'Seconds',
  source: 'apollo', externalEventId: 'apollo:1:tt', weekStart: '2026-04-14',
});
const sfTT = buildKpiMapping({
  profileId: 'p1', kpiKey: 'talk_time_minutes', rawValue: 300, fromUnit: 'Seconds',
  source: 'salesforce', externalEventId: 'sf:1:tt', weekStart: '2026-04-14',
});
assertEq(apolloTT.increment, sfTT.increment, 'Apollo and Salesforce talk_time from same seconds produce same value');

// ── Results ──────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
