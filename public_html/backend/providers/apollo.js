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

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/phone_calls/search?per_page=100&sort_by_field=start_time&sort_ascending=true'));
      } catch (err) {
        throw new Error(`Apollo calls network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:calls] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo calls API error: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();

      const calls = (data.phone_calls || []).filter(c => {
        const startTime = new Date(c.start_time);
        return startTime > new Date(since);
      });

      const kpiMappings = [];
      const activityRecords = [];

      for (const call of calls) {
        const callId = call.id;
        const weekStart = getWeekStart(call.start_time);

        // dials — every call record is a dial attempt, regardless of status
        const dialMapping = buildKpiMapping({
          profileId, kpiKey: 'dials', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:call:${callId}:dials`, weekStart,
        });
        if (dialMapping) kpiMappings.push(dialMapping);

        // Activity record for ALL calls (before KPI-completion filter)
        activityRecords.push({
          profileId,
          activityType: 'call',
          activityDate: call.start_time,
          source: 'apollo',
          externalId: String(callId),
          subject: call.note ? call.note.slice(0, 200) : null,
          contactName: call.contact?.name || null,
          contactEmail: call.contact?.email || null,
          direction: 'outbound',
          durationSeconds: call.duration || null,
          status: call.status || null,
          notes: call.note ? call.note.slice(0, 2000) : null,
          metadata: { opportunity_id: call.opportunity_id },
        });

        // Only completed calls for remaining KPIs
        if (call.status !== 'completed' || !call.logged) continue;

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
      return { records: calls, nextCursor: latestCallTime, kpiMappings, activityRecords };
    },

    // === EMAILS ===
    emails: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let res;
      try {
        ({ res } = await apolloGet(api_key, '/activities?types[]=email&sort_by_field=created_at&sort_ascending=true&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo emails network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:emails] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo emails API error: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const emails = (data.activities || []).filter(e => {
        const created = new Date(e.created_at);
        return created > new Date(since);
      });

      const kpiMappings = [];
      const activityRecords = [];

      for (const email of emails) {
        const emailId = email.id;

        // Activity record for ALL emails (including inbound)
        activityRecords.push({
          profileId,
          activityType: 'email',
          activityDate: email.created_at,
          source: 'apollo',
          externalId: String(emailId),
          subject: email.subject || null,
          contactName: email.contact?.name || null,
          contactEmail: email.contact?.email || null,
          direction: email.direction === 'inbound' ? 'inbound' : 'outbound',
          status: 'sent',
          notes: email.body ? email.body.slice(0, 500) : null,
          metadata: {},
        });

        if (email.direction === 'inbound') continue;

        const weekStart = getWeekStart(email.created_at);

        // emails_sent
        const sentMapping = buildKpiMapping({
          profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:email:${emailId}:emails_sent`, weekStart,
        });
        if (sentMapping) kpiMappings.push(sentMapping);

        // sequence_replies — owned by sequences handler to avoid cross-handler double-counting
      }

      console.log(`[apollo:emails] Processed ${emails.length} emails, ${kpiMappings.length} KPI mappings`);
      return { records: emails, nextCursor: latestTimestamp(emails, 'created_at', since), kpiMappings, activityRecords };
    },

    // === OPPORTUNITIES / DEALS (Pipeline) ===
    // Verified fields from real Apollo API (2026-04-21):
    //   Endpoint:  GET /opportunities/search  (NOT /opportunities — that 404s)
    //   Response:  { opportunities: [...] }
    //   Deal obj:  id, opportunity_created_at, amount, is_won, is_closed, opportunity_stage_id
    //   Stages:    GET /opportunity_stages → display_order + name
    //   Stage map: 0=Lead, 1=Sales Qualified, 2=Meeting Booked, 3=Negotiation,
    //              4=Contract Sent, 5=Closed Won, 6=Closed Lost
    opportunities: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 90 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      // 1. Fetch deal stages to build lookup (stageId → display_order)
      let stageMap = {};
      try {
        const { res: stageRes } = await apolloGet(api_key, '/opportunity_stages');
        if (stageRes.ok) {
          const stageData = await stageRes.json();
          for (const s of (stageData.opportunity_stages || [])) {
            stageMap[s.id] = { name: s.name, order: s.display_order, isWon: s.is_won, isClosed: s.is_closed };
          }
          console.log(`[apollo:opportunities] Loaded ${Object.keys(stageMap).length} deal stages`);
        }
      } catch (err) {
        console.warn(`[apollo:opportunities] Could not fetch stages: ${err.message}, falling back to deal-level flags`);
      }

      // 2. Fetch deals — correct endpoint is /opportunities/search (GET)
      let res;
      try {
        ({ res } = await apolloGet(api_key, '/opportunities/search?per_page=100'));
      } catch (err) {
        throw new Error(`Apollo opportunities network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:opportunities] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo opportunities API error: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      // Filter by stage_updated_at (catches stage changes), fall back to opportunity_created_at
      const opps = (data.opportunities || []).filter(opp => {
        const ts = opp.stage_updated_at || opp.opportunity_created_at;
        return ts && new Date(ts) > new Date(since);
      });

      const kpiMappings = [];

      for (const opp of opps) {
        const oppId = opp.id;
        const weekStart = getWeekStart(opp.opportunity_created_at);

        // Resolve stage via lookup, fall back to deal-level flags
        const stage = stageMap[opp.opportunity_stage_id] || {};
        const displayOrder = stage.order ?? -1;
        const isWon = opp.is_won === true;
        const isClosed = opp.is_closed === true;

        // sourced_opps — all deals
        const sourcedMapping = buildKpiMapping({
          profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:opp:${oppId}:sourced_opps`, weekStart,
        });
        if (sourcedMapping) kpiMappings.push(sourcedMapping);

        // pipeline_created — value of new opportunities
        const oppAmount = opp.amount || 0;
        if (oppAmount > 0) {
          const pipelineMapping = buildKpiMapping({
            profileId, kpiKey: 'pipeline_created', rawValue: oppAmount, fromUnit: 'Dollars',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:pipeline_created`, weekStart,
          });
          if (pipelineMapping) kpiMappings.push(pipelineMapping);
        }

        // stage2_opps — Meeting Booked (order 2) and beyond, excluding Closed Lost
        const isStage2 = displayOrder >= 2 && (!isClosed || isWon);
        if (isStage2) {
          const stage2Mapping = buildKpiMapping({
            profileId, kpiKey: 'stage2_opps', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:stage2_opps`, weekStart,
          });
          if (stage2Mapping) kpiMappings.push(stage2Mapping);
        }

        // stage3_opps — Negotiation (order 3) and beyond, excluding Closed Lost
        const isStage3 = displayOrder >= 3 && (!isClosed || isWon);
        if (isStage3) {
          const stage3Mapping = buildKpiMapping({
            profileId, kpiKey: 'stage3_opps', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:stage3_opps`, weekStart,
          });
          if (stage3Mapping) kpiMappings.push(stage3Mapping);
        }

        // closed_won — verified: opp.is_won boolean
        if (isWon) {
          // Use closed_date for won deals (when they actually closed), fall back to creation date
          const closedWeek = getWeekStart(opp.closed_date || opp.opportunity_created_at);
          const wonMapping = buildKpiMapping({
            profileId, kpiKey: 'closed_won', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:opp:${oppId}:closed_won`, weekStart: closedWeek,
          });
          if (wonMapping) kpiMappings.push(wonMapping);

          // revenue_generated — verified field: opp.amount
          const amount = opp.amount || 0;
          if (amount > 0) {
            const revenueMapping = buildKpiMapping({
              profileId, kpiKey: 'revenue_generated', rawValue: amount, fromUnit: 'Dollars',
              source: 'apollo', externalEventId: `apollo:opp:${oppId}:revenue_generated`, weekStart: closedWeek,
            });
            if (revenueMapping) kpiMappings.push(revenueMapping);
          }

          // sales_cycle_days — days from creation to close
          if (opp.opportunity_created_at && opp.closed_date) {
            const cycleDays = (new Date(opp.closed_date) - new Date(opp.opportunity_created_at)) / (1000 * 60 * 60 * 24);
            if (cycleDays >= 0) {
              const cycleMapping = buildKpiMapping({
                profileId, kpiKey: 'sales_cycle_days', rawValue: cycleDays, fromUnit: 'Days',
                source: 'apollo', externalEventId: `apollo:opp:${oppId}:sales_cycle_days`, weekStart: closedWeek,
              });
              if (cycleMapping) kpiMappings.push(cycleMapping);
            }
          }
        }
      }

      console.log(`[apollo:opportunities] Processed ${opps.length} deals, ${kpiMappings.length} KPI mappings`);

      // Build pipeline deals for engage_pipeline_deals upsert
      const pipelineDeals = opps.map(opp => {
        const stage = stageMap[opp.opportunity_stage_id] || {};
        return {
          ownerId: profileId,
          dealName: opp.name || `Apollo Opp ${opp.id.slice(0, 8)}`,
          dealValue: opp.amount || 0,
          stage: stage.name || 'discovery',
          probability: opp.is_won ? 100 : (opp.is_closed ? 0 : Math.min((stage.order || 0) * 20, 80)),
          closeDate: opp.closed_date || null,
          lastActivityAt: opp.stage_updated_at || opp.opportunity_created_at || null,
          source: 'apollo',
          externalId: opp.id,
          crmUrl: null,
          metadata: { apolloStageId: opp.opportunity_stage_id, stageName: stage.name },
        };
      });

      // Advance cursor by stage_updated_at (catches stage changes), fall back to opportunity_created_at
      const cursorField = opps.length > 0 && opps[0].stage_updated_at ? 'stage_updated_at' : 'opportunity_created_at';
      return { records: opps, nextCursor: latestTimestamp(opps, cursorField, since), kpiMappings, pipelineDeals };
    },

    // === CONVERSATIONS (Call Intelligence — plan-dependent, 403 = skip) ===
    conversations: async (freshIntegration, cursor, sb) => {
      const profileId = await guardRep(freshIntegration, sb);
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      if (!profileId) return { records: [], nextCursor: since, kpiMappings: [] };

      const { api_key } = freshIntegration.decryptedCreds;

      let listRes;
      try {
        ({ res: listRes } = await apolloGet(api_key, '/conversations?sort_by_field=created_at&sort_ascending=true&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo conversations network error: ${err.message}`);
      }

      if (!listRes.ok) {
        if (listRes.status === 403 || listRes.status === 404) {
          console.log('[apollo:conversations] Not available on current plan, skipping');
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo conversations API error: ${listRes.status} ${listRes.statusText}`);
        err.status = listRes.status;
        throw err;
      }

      const listData = await listRes.json();
      const conversations = (listData.conversations || []).filter(conv => {
        const created = new Date(conv.created_at || conv.recorded_at);
        return created > new Date(since);
      });

      const kpiMappings = [];

      for (const conv of conversations) {
        const convId = conv.id;
        if (!convId) continue;
        const weekStart = getWeekStart(conv.created_at || conv.recorded_at);

        // conversations — count each conversation record
        const convCountMapping = buildKpiMapping({
          profileId, kpiKey: 'conversations', rawValue: 1, fromUnit: 'Count',
          source: 'apollo', externalEventId: `apollo:conv:${convId}:conversations`, weekStart,
        });
        if (convCountMapping) kpiMappings.push(convCountMapping);

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
        ({ res } = await apolloGet(api_key, '/emailer_campaign_steps?sort_by_field=created_at&sort_ascending=true&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo sequences network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          console.log('[apollo:sequences] Not available, skipping');
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo sequences API error: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const steps = (data.emailer_campaign_steps || []).filter(step => {
        const created = new Date(step.created_at);
        return created > new Date(since);
      });

      const kpiMappings = [];

      // sequences_started — count unique campaigns (each campaign = one sequence started)
      const seenCampaigns = new Set();
      for (const step of steps) {
        const campaignId = step.emailer_campaign_id;
        if (campaignId && !seenCampaigns.has(campaignId)) {
          seenCampaigns.add(campaignId);
          const seqWeekStart = getWeekStart(step.created_at);
          const seqMapping = buildKpiMapping({
            profileId, kpiKey: 'sequences_started', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:campaign:${campaignId}:sequences_started`, weekStart: seqWeekStart,
          });
          if (seqMapping) kpiMappings.push(seqMapping);
        }
      }

      for (const step of steps) {
        const stepId = step.id;
        const weekStart = getWeekStart(step.created_at);

        // emails_sent — owned by emails handler to avoid cross-handler double-counting

        // sequence_replies — sole owner of this KPI
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
        ({ res } = await apolloGet(api_key, '/activities?sort_by_field=created_at&sort_ascending=true&per_page=100'));
      } catch (err) {
        throw new Error(`Apollo tasks network error: ${err.message}`);
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 422) {
          console.log(`[apollo:tasks] API returned ${res.status}, skipping`);
          return { records: [], nextCursor: since, kpiMappings: [] };
        }
        const err = new Error(`Apollo tasks API error: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const activities = (data.activities || []).filter(a => {
        const created = new Date(a.created_at);
        return created > new Date(since);
      });

      const kpiMappings = [];

      for (const activity of activities) {
        const actId = activity.id;
        const weekStart = getWeekStart(activity.created_at);
        const aType = (activity.type || activity.activity_type || '').toLowerCase();

        // Only process meeting-type activities — calls/emails are owned by their dedicated handlers
        if ((aType === 'meeting' || aType === 'demo' || aType === 'presentation') && activity.status === 'completed') {
          const m = buildKpiMapping({
            profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
            source: 'apollo', externalEventId: `apollo:task:${actId}:meetings`, weekStart,
          });
          if (m) kpiMappings.push(m);
        }
        // call_connects + talk_time_minutes — owned by calls handler to avoid double-counting
      }

      console.log(`[apollo:tasks] Processed ${activities.length} activities, ${kpiMappings.length} KPI mappings`);
      return { records: activities, nextCursor: latestTimestamp(activities, 'created_at', since), kpiMappings };
    },
  },
};
