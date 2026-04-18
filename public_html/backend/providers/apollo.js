'use strict';

const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

/**
 * Apollo Full CRM Provider — Apptivia Integration Framework
 * ----------------------------------------------------------
 * API Key auth (personal integration per rep).
 * Syncs: Calls, Emails, Opportunities, Conversations (call intelligence), Sequences, Tasks.
 * 15 KPIs total — matches Salesforce/HubSpot parity for Planera pilot.
 *
 * Field names verified against real Apollo API responses from Sean's account.
 */

// Shared guard: skip non-reps and missing profile_id
async function guardRep(freshIntegration, sb) {
  const profileId = freshIntegration.profile_id;
  if (!profileId) return null;
  const { data: profile } = await sb.from('profiles')
    .select('role, carries_quota')
    .eq('id', profileId)
    .maybeSingle();
  if (!profile) return null;
  const isLeader = ['admin', 'manager', 'coach'].includes(profile.role);
  if (isLeader && !profile.carries_quota) return null;
  return profileId;
}

// Shared cursor helper — advances to the latest record's timestamp
// instead of new Date().toISOString() which skips records created during sync
function latestTimestamp(records, field, fallback) {
  if (!records.length) return fallback;
  return records.reduce((max, r) => {
    const ts = r[field];
    return ts && ts > max ? ts : max;
  }, records[0][field] || fallback) || fallback;
}

// Shared Apollo API helper — uses X-Api-Key header (verified)
async function apolloGet(apiKey, path) {
  const res = await fetch(`https://api.apollo.io/api/v1${path}`, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
  });
  return { res, status: res.status };
}

module.exports = {
  type: 'apollo',

  sync: {
    // === CALLS (verified field names: duration, status, logged, start_time) ===
    calls: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      const { res } = await apolloGet(api_key, '/phone_calls/search?per_page=100&sort_by_field=start_time&sort_ascending=false');
      if (!res.ok) throw new Error(`Apollo calls API error: ${res.status} ${res.statusText}`);
      const data = await res.json();

      const calls = (data.phone_calls || []).filter(c => {
        const startTime = new Date(c.start_time);
        return startTime >= new Date(since);
      });

      const kpiMappings = [];

      for (const call of calls) {
        // Only completed calls (verified: status === 'completed' and logged === true)
        if (call.status !== 'completed' || !call.logged) continue;

        const callId = call.id;
        const weekStart = getWeekStart(call.start_time);

        // call_connects
        const connectMapping = buildKpiMapping({
          profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:call:${callId}:call_connects`, weekStart,
        });
        if (connectMapping) kpiMappings.push(connectMapping);

        // talk_time_minutes — verified field: 'duration' (seconds)
        const durationSec = call.duration || 0;
        if (durationSec > 0) {
          const talkTimeMapping = buildKpiMapping({
            profileId, kpiKey: 'talk_time_minutes', rawValue: durationSec, fromUnit: 'Seconds',
            source: 'apollo', externalEventId: `apollo:call:${callId}:talk_time_minutes`, weekStart,
          });
          if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
        }

        // meetings — calls with opportunity_id or meeting/demo keywords in note
        if (call.opportunity_id || (call.note && /meeting|demo|presentation/i.test(call.note))) {
          const meetingMapping = buildKpiMapping({
            profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:call:${callId}:meetings`, weekStart,
          });
          if (meetingMapping) kpiMappings.push(meetingMapping);
        }
      }

      // Advance cursor to latest call's start_time
      const latestCallTime = calls.length > 0
        ? calls.reduce((max, c) => c.start_time > max ? c.start_time : max, calls[0].start_time)
        : since;

      console.log(`[apollo:calls] Processed ${calls.length} calls, ${kpiMappings.length} KPI mappings`);
      return { records: calls, nextCursor: latestCallTime, kpiMappings };
    },

    // === EMAILS ===
    emails: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/activities?types[]=email&sort_by_field=created_at&sort_ascending=false&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo emails network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:emails] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        throw new Error(`Apollo emails API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const emails = (data.activities || []).filter(e => {
        const created = new Date(e.created_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const email of emails) {
        if (email.direction === 'inbound') continue;

        const emailId = email.id;
        const weekStart = getWeekStart(email.created_at);

        // emails_sent
        const sentMapping = buildKpiMapping({
          profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:email:${emailId}:emails_sent`, weekStart,
        });
        if (sentMapping) kpiMappings.push(sentMapping);

        // sequence_replies — sequence email that got a reply
        if ((email.sequence_id || email.emailer_campaign_id) &&
            (email.was_replied || email.reply_received)) {
          const replyMapping = buildKpiMapping({
            profileId, kpiKey: 'sequence_replies', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:email:${emailId}:sequence_replies`, weekStart,
          });
          if (replyMapping) kpiMappings.push(replyMapping);
        }
      }

      console.log(`[apollo:emails] Processed ${emails.length} emails, ${kpiMappings.length} KPI mappings`);
      return { records: emails, nextCursor: latestTimestamp(emails, 'created_at', since), kpiMappings };
    },

    // === OPPORTUNITIES (Pipeline) ===
    opportunities: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/opportunities?sort_by_field=created_at&sort_ascending=false&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo opportunities network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:opportunities] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        throw new Error(`Apollo opportunities API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const opps = (data.opportunities || []).filter(opp => {
        const created = new Date(opp.created_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const opp of opps) {
        const oppId = opp.id;
        const weekStart = getWeekStart(opp.created_at);
        const stage = opp.stage_name || opp.stage || '';
        const status = (opp.status || '').toLowerCase();

        // sourced_opps
        const sourcedMapping = buildKpiMapping({
          profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:opp:${oppId}:sourced_opps`, weekStart,
        });
        if (sourcedMapping) kpiMappings.push(sourcedMapping);

        // stage2_opps — beyond initial contact/prospecting
        if (/qualified|demo|proposal|negotiation|closing|stage\s*[2-9]/i.test(stage) || opp.stage_order > 1) {
          const stage2Mapping = buildKpiMapping({
            profileId, kpiKey: 'stage2_opps', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:stage2_opps`, weekStart,
          });
          if (stage2Mapping) kpiMappings.push(stage2Mapping);
        }

        // closed_won
        const isWon = status === 'won' || status === 'closed_won' || /won|closed.won/i.test(stage);
        if (isWon) {
          const wonMapping = buildKpiMapping({
            profileId, kpiKey: 'closed_won', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:closed_won`, weekStart,
          });
          if (wonMapping) kpiMappings.push(wonMapping);

          // revenue_generated
          const amount = opp.amount || opp.value || opp.deal_value || 0;
          if (amount > 0) {
            const revenueMapping = buildKpiMapping({
              profileId, kpiKey: 'revenue_generated', rawValue: amount, fromUnit: 'Dollars',
              source: 'apollo', externalEventId: `apollo:opp:${oppId}:revenue_generated`, weekStart,
            });
            if (revenueMapping) kpiMappings.push(revenueMapping);
          }
        }
      }

      console.log(`[apollo:opportunities] Processed ${opps.length} opportunities, ${kpiMappings.length} KPI mappings`);
      return { records: opps, nextCursor: latestTimestamp(opps, 'created_at', since), kpiMappings };
    },

    // === CONVERSATIONS (Call Intelligence — plan-dependent, 403 = skip) ===
    conversations: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let listRes;
      try {
        ({ res: listRes } = await apolloGet(api_key, '/conversations?sort_by_field=created_at&sort_ascending=false&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo conversations network error: ${err.message}`);
      }

      if (!listRes.ok) {
        if (listRes.status === 403 || listRes.status === 404) {
          console.log('[apollo:conversations] Not available on current plan, skipping');
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        throw new Error(`Apollo conversations API error: ${listRes.status} ${listRes.statusText}`);
      }

      const listData = await listRes.json();
      const conversations = (listData.conversations || []).filter(conv => {
        const created = new Date(conv.created_at || conv.recorded_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const conv of conversations) {
        const convId = conv.id;
        if (!convId) continue;
        const weekStart = getWeekStart(conv.created_at || conv.recorded_at);

        // talk_to_listen_ratio
        const talkRatio = conv.talk_time_ratio || conv.rep_talk_ratio || conv.agent_talk_ratio;
        if (talkRatio != null && talkRatio >= 0 && talkRatio <= 1) {
          const ratioMapping = buildKpiMapping({
            profileId, kpiKey: 'talk_to_listen_ratio', rawValue: talkRatio, fromUnit: 'Ratio',
            source: 'apollo', externalEventId: `apollo:conv:${convId}:talk_to_listen_ratio`, weekStart,
          });
          if (ratioMapping) kpiMappings.push(ratioMapping);
        }

        // longest_monologue_sec
        const longestMono = conv.longest_monologue_duration || conv.longest_monologue_seconds;
        if (longestMono != null && longestMono > 0) {
          const monoMapping = buildKpiMapping({
            profileId, kpiKey: 'longest_monologue_sec', rawValue: longestMono, fromUnit: 'Seconds',
            source: 'apollo', externalEventId: `apollo:conv:${convId}:longest_monologue_sec`, weekStart,
          });
          if (monoMapping) kpiMappings.push(monoMapping);
        }

        // questions_asked
        let questionsCount = conv.questions_asked_count || conv.rep_questions || 0;
        if (conv.transcription && questionsCount === 0) {
          const questionMatches = (conv.transcription || '').match(/\?/g);
          questionsCount = questionMatches ? questionMatches.length : 0;
        }
        if (questionsCount > 0) {
          const questionsMapping = buildKpiMapping({
            profileId, kpiKey: 'questions_asked', rawValue: questionsCount, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:conv:${convId}:questions_asked`, weekStart,
          });
          if (questionsMapping) kpiMappings.push(questionsMapping);
        }

        // next_steps_mentioned
        let nextSteps = conv.next_steps_mentioned || conv.has_next_steps;
        if (nextSteps == null && conv.transcription) {
          nextSteps = /next steps?|follow.?up|schedule|meeting|call back|touch base/i.test(conv.transcription);
        }
        if (nextSteps != null) {
          const nextStepsMapping = buildKpiMapping({
            profileId, kpiKey: 'next_steps_mentioned', rawValue: nextSteps, fromUnit: 'Boolean',
            source: 'apollo', externalEventId: `apollo:conv:${convId}:next_steps_mentioned`, weekStart,
          });
          if (nextStepsMapping) kpiMappings.push(nextStepsMapping);
        }

        // interactivity_score
        let interactivity = conv.interactivity_score || conv.engagement_score;
        if (interactivity == null && conv.speaker_changes) {
          const duration = conv.duration || 60;
          const changesPerMinute = conv.speaker_changes / (duration / 60);
          interactivity = Math.min(100, changesPerMinute * 15);
        }
        if (interactivity != null && interactivity >= 0) {
          const interactivityMapping = buildKpiMapping({
            profileId, kpiKey: 'interactivity_score', rawValue: interactivity, fromUnit: 'Score',
            source: 'apollo', externalEventId: `apollo:conv:${convId}:interactivity_score`, weekStart,
          });
          if (interactivityMapping) kpiMappings.push(interactivityMapping);
        }
      }

      console.log(`[apollo:conversations] Processed ${conversations.length} conversations, ${kpiMappings.length} intelligence KPI mappings`);
      return { records: conversations, nextCursor: latestTimestamp(conversations, 'created_at', since), kpiMappings };
    },

    // === SEQUENCES (emailer campaign steps) ===
    sequences: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/emailer_campaign_steps?sort_by_field=created_at&sort_ascending=false&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo sequences network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          console.log('[apollo:sequences] Not available, skipping');
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        throw new Error(`Apollo sequences API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const steps = (data.emailer_campaign_steps || []).filter(step => {
        const created = new Date(step.created_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const step of steps) {
        const stepId = step.id;
        const weekStart = getWeekStart(step.created_at);

        // emails_sent — sequence emails
        if (step.status === 'sent' || step.executed_at) {
          const sentMapping = buildKpiMapping({
            profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:seq:${stepId}:emails_sent`, weekStart,
          });
          if (sentMapping) kpiMappings.push(sentMapping);
        }

        // sequence_replies
        if (step.replied || (step.reply_count && step.reply_count > 0)) {
          const replyMapping = buildKpiMapping({
            profileId, kpiKey: 'sequence_replies', rawValue: step.reply_count || 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:seq:${stepId}:sequence_replies`, weekStart,
          });
          if (replyMapping) kpiMappings.push(replyMapping);
        }
      }

      console.log(`[apollo:sequences] Processed ${steps.length} steps, ${kpiMappings.length} KPI mappings`);
      return { records: steps, nextCursor: latestTimestamp(steps, 'created_at', since), kpiMappings };
    },

    // === TASKS (general activities — maps to appropriate KPIs by type) ===
    tasks: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/activities?sort_by_field=created_at&sort_ascending=false&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo tasks network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:tasks] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        throw new Error(`Apollo tasks API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const activities = (data.activities || []).filter(a => {
        const created = new Date(a.created_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const activity of activities) {
        const actId = activity.id;
        const weekStart = getWeekStart(activity.created_at);
        const aType = (activity.type || activity.activity_type || '').toLowerCase();

        if ((aType === 'meeting' || aType === 'demo' || aType === 'presentation') && activity.status === 'completed') {
          const m = buildKpiMapping({
            profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:task:${actId}:meetings`, weekStart,
          });
          if (m) kpiMappings.push(m);
        } else if (aType === 'call' && activity.status === 'completed' && activity.duration > 0) {
          const c = buildKpiMapping({
            profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:task:${actId}:call_connects`, weekStart,
          });
          if (c) kpiMappings.push(c);
          const t = buildKpiMapping({
            profileId, kpiKey: 'talk_time_minutes', rawValue: activity.duration, fromUnit: 'Seconds',
            source: 'apollo', externalEventId: `apollo:task:${actId}:talk_time_minutes`, weekStart,
          });
          if (t) kpiMappings.push(t);
        }
      }

      console.log(`[apollo:tasks] Processed ${activities.length} activities, ${kpiMappings.length} KPI mappings`);
      return { records: activities, nextCursor: latestTimestamp(activities, 'created_at', since), kpiMappings };
    },
  },
};
