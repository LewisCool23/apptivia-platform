'use strict';

/**
 * Canonical KPI definitions for Apptivia.
 *
 * Single source of truth for how external data becomes Apptivia KPIs.
 * Every provider module MUST use buildKpiMapping() — no ad-hoc unit conversion.
 *
 * Prevents drift like "Apollo duration/60 vs Outreach Math.round(duration/60) vs Gong Math.round(durationSec/60)"
 * All transformers output the canonical unit and precision for each KPI.
 */

const KPI_CANONICAL = {
  // === Call Activity KPIs ===
  call_connects: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  talk_time_minutes: {
    unit: 'minutes',
    precision: 2,
    aggregation: 'sum',
    fromSeconds: (sec) => Math.round((Number(sec) / 60) * 100) / 100,
    fromMilliseconds: (ms) => Math.round((Number(ms) / 60000) * 100) / 100,
    fromMinutes: (min) => Math.round(Number(min) * 100) / 100,
  },

  meetings: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  // === Email/Sequence KPIs ===
  emails_sent: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  sequence_replies: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  sequences_started: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  emails_opened: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  tasks_completed: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  // === Pipeline KPIs ===
  sourced_opps: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  stage2_opps: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  closed_won: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  revenue_generated: {
    unit: 'dollars',
    precision: 2,
    aggregation: 'sum',
    fromDollars: (d) => Math.round(Number(d) * 100) / 100,
    fromCents: (c) => Math.round(Number(c)) / 100,
  },

  // === Call Intelligence KPIs (Gong + Apollo Conversations) ===
  talk_to_listen_ratio: {
    unit: 'percent',
    precision: 1,
    aggregation: 'avg',
    fromPercent: (p) => Math.round(Number(p) * 10) / 10,
    fromRatio: (r) => Math.round(Number(r) * 1000) / 10, // 0.65 -> 65.0%
  },

  longest_monologue_sec: {
    unit: 'seconds',
    precision: 0,
    aggregation: 'max',
    fromSeconds: (s) => Math.round(Number(s)),
    fromMilliseconds: (ms) => Math.round(Number(ms) / 1000),
  },

  questions_asked: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 0),
  },

  next_steps_mentioned: {
    unit: 'boolean_count',
    precision: 0,
    aggregation: 'sum',
    fromBoolean: (b) => (b ? 1 : 0),
    fromCount: (n) => Math.round(Number(n) || 0),
  },

  interactivity_score: {
    unit: 'score_0_100',
    precision: 1,
    aggregation: 'avg',
    fromScore: (s) => Math.round(Number(s) * 10) / 10,
    fromPercent: (p) => Math.round(Number(p) * 10) / 10,
  },

  // === Marketing/Gift KPIs (Sendoso, Marketo) ===
  sends_sent: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  gifts_accepted: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  gift_influenced_meetings: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  form_submissions: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },

  campaign_responses: {
    unit: 'count',
    precision: 0,
    aggregation: 'sum',
    fromCount: (n) => Math.round(Number(n) || 1),
  },
};

/**
 * Build a KPI mapping with canonical value transformation.
 *
 * @param {Object} params
 * @param {string} params.profileId
 * @param {string} params.kpiKey - Must exist in KPI_CANONICAL
 * @param {any}    params.rawValue - Raw value from external system
 * @param {string} params.fromUnit - Transformer name: 'Seconds', 'Count', 'Boolean', 'Ratio', etc.
 * @param {string} params.source - Provider name
 * @param {string} params.externalEventId - Unique dedup key
 * @param {string} params.weekStart - ISO date (YYYY-MM-DD)
 * @returns {Object|null} KPI mapping for upsertKpiValue, or null if invalid
 */
function buildKpiMapping({ profileId, kpiKey, rawValue, fromUnit, source, externalEventId, weekStart }) {
  const canonical = KPI_CANONICAL[kpiKey];
  if (!canonical) {
    throw new Error(`[kpiCanonical] Unknown KPI key: ${kpiKey}. Available: ${Object.keys(KPI_CANONICAL).join(', ')}`);
  }

  const transformerKey = `from${fromUnit}`;
  const transformer = canonical[transformerKey];
  if (!transformer) {
    const available = Object.keys(canonical).filter(k => k.startsWith('from'));
    throw new Error(`[kpiCanonical] KPI ${kpiKey} has no transformer for unit: ${fromUnit}. Available: ${available.join(', ')}`);
  }

  let value;
  try {
    value = transformer(rawValue);
  } catch (err) {
    console.warn(`[kpiCanonical] Transform failed for ${kpiKey} ${fromUnit}(${rawValue}):`, err.message);
    return null;
  }

  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const mapping = {
    profileId,
    kpiKey,
    source,
    externalEventId,
    weekStart,
    aggregation: canonical.aggregation,
  };

  if (canonical.aggregation === 'sum') {
    mapping.increment = value;
  } else {
    mapping.value = value;
  }

  return mapping;
}

/**
 * Shared getWeekStart — consolidates the identical helper duplicated across all providers.
 */
function getWeekStart(fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

module.exports = { KPI_CANONICAL, buildKpiMapping, getWeekStart };
