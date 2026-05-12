/**
 * Salesforce Provider — Apptivia Integration Framework
 * -----------------------------------------------------
 * OAuth 2.0 Web Server flow, REST API v59.0, SOQL queries.
 * Syncs: Tasks (calls), Events (meetings), Opportunities (deals), Contacts.
 * Pushes: Create Events (meetings), log Tasks (activities).
 *
 * Env vars:
 *   SALESFORCE_CLIENT_ID
 *   SALESFORCE_CLIENT_SECRET
 */

'use strict';

const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

const SF_API_VERSION = process.env.SALESFORCE_API_VERSION || 'v59.0';
const LOGIN_URL = 'https://login.salesforce.com';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('SALESFORCE_CLIENT_ID'),
    redirect_uri: redirectUri,
    state,
    scope: 'api refresh_token offline_access',
    prompt: 'login',
  });
  return `${LOGIN_URL}/services/oauth2/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('SALESFORCE_CLIENT_ID'),
    client_secret: env('SALESFORCE_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Salesforce token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    instance_url: data.instance_url,
    scope: data.scope,
    expires_in: 7200, // Salesforce access tokens typically expire in 2 hours
    extra: { id: data.id, issued_at: data.issued_at },
  };
}

async function refreshToken(creds) {
  const tokenUrl = creds.instance_url
    ? `${creds.instance_url}/services/oauth2/token`
    : `${LOGIN_URL}/services/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('SALESFORCE_CLIENT_ID'),
    client_secret: env('SALESFORCE_CLIENT_SECRET'),
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Salesforce token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    instance_url: data.instance_url || creds.instance_url,
    expires_in: 7200,
  };
}

// ── SOQL Helpers ─────────────────────────────────────────────

function isSkippableError(err) {
  const status = err.status || 0;
  return status === 403 || status === 404 || status === 422;
}

async function soqlQuery(creds, query) {
  const { fetchJson } = require('../integrationService');
  const url = `${creds.instance_url}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(query)}`;
  return fetchJson(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
}

async function soqlQueryAll(creds, query, maxRecords = 1000) {
  const { fetchJson } = require('../integrationService');
  const records = [];
  let result = await soqlQuery(creds, query);
  records.push(...(result.records || []));

  while (result.nextRecordsUrl && records.length < maxRecords) {
    try {
      result = await fetchJson(`${creds.instance_url}${result.nextRecordsUrl}`, {
        headers: { Authorization: `Bearer ${creds.access_token}` },
      });
      records.push(...(result.records || []));
    } catch (err) {
      console.warn(`[salesforce] soqlQueryAll pagination failed mid-page: ${err.message}. Returning ${records.length} partial records.`);
      break;
    }
  }

  return records;
}

async function sfApiCall(creds, method, path, body) {
  const url = `${creds.instance_url}/services/data/${SF_API_VERSION}${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Salesforce API ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return {}; // No content
  return res.json();
}

// ── Stage Mapping ────────────────────────────────────────────

// Cache per instance URL to avoid re-fetching during same sync cycle
const _stageMapCache = {};

async function fetchStageMap(creds) {
  const cacheKey = creds.instance_url;
  if (_stageMapCache[cacheKey]) return _stageMapCache[cacheKey];

  try {
    const result = await soqlQuery(creds,
      'SELECT MasterLabel, SortOrder, IsClosed, IsWon, DefaultProbability FROM OpportunityStage ORDER BY SortOrder ASC'
    );
    const stages = result.records || [];
    if (stages.length === 0) throw new Error('No stages returned');

    const stageMap = {};
    for (const s of stages) {
      stageMap[s.MasterLabel] = {
        sortOrder: s.SortOrder,
        isClosed: s.IsClosed,
        isWon: s.IsWon,
        probability: s.DefaultProbability,
      };
    }
    console.log(`[salesforce] Loaded ${stages.length} stages: ${stages.map(s => `${s.MasterLabel}(${s.SortOrder})`).join(', ')}`);
    _stageMapCache[cacheKey] = stageMap;
    return stageMap;
  } catch (err) {
    console.warn(`[salesforce] Could not fetch stages: ${err.message}, using hardcoded fallback`);
    return null; // signals caller to use hardcoded logic
  }
}

// ── User Mapping ─────────────────────────────────────────────

// Cache: { instanceUrl: { sfUserId: email } }
const _userCache = {};

async function resolveUserEmail(creds, sfUserId) {
  if (!sfUserId) return null;
  const cacheKey = creds.instance_url;
  if (!_userCache[cacheKey]) _userCache[cacheKey] = {};
  if (_userCache[cacheKey][sfUserId]) return _userCache[cacheKey][sfUserId];

  try {
    const result = await soqlQuery(creds, `SELECT Email FROM User WHERE Id = '${sfUserId}' LIMIT 1`);
    const email = result.records?.[0]?.Email || null;
    if (email) _userCache[cacheKey][sfUserId] = email;
    return email;
  } catch {
    return null;
  }
}

// ── Sync: Activities (Tasks/Calls) ───────────────────────────

async function syncActivities(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `AND SystemModstamp > ${cursor}`
    : `AND SystemModstamp > ${getISODateDaysAgo(90)}`;

  // Broadened query: ALL calls (any status for dials) + completed emails
  const query = `
    SELECT Id, Subject, TaskSubtype, Status, ActivityDate, OwnerId,
           CallDurationInSeconds, WhoId, WhatId, SystemModstamp
    FROM Task
    WHERE ((TaskSubtype = 'Call') OR (TaskSubtype = 'Email' AND Status = 'Completed'))
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  let records;
  try {
    records = await soqlQueryAll(creds, query);
  } catch (err) {
    if (isSkippableError(err)) {
      console.warn(`[salesforce:activities] Skipping — ${err.message}`);
      return { records: [], nextCursor: cursor, kpiMappings: [] };
    }
    throw err;
  }
  const kpiMappings = [];
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );
    if (!profileId) continue;
    if (await shouldSkipProfile(sb, profileId)) continue;

    const weekStart = getWeekStart(record.ActivityDate || record.SystemModstamp);

    if (record.TaskSubtype === 'Call') {
      // dials — every call task is a dial attempt, regardless of status
      const dialMapping = buildKpiMapping({
        profileId, kpiKey: 'dials', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:dials`, weekStart,
      });
      if (dialMapping) kpiMappings.push(dialMapping);

      // call_connects — only completed calls
      if (record.Status === 'Completed') {
        const connectMapping = buildKpiMapping({
          profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
          source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:call_connects`, weekStart,
        });
        if (connectMapping) kpiMappings.push(connectMapping);

        if (record.CallDurationInSeconds > 0) {
          const talkTimeMapping = buildKpiMapping({
            profileId, kpiKey: 'talk_time_minutes', rawValue: record.CallDurationInSeconds, fromUnit: 'Seconds',
            source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:talk_time`, weekStart,
          });
          if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
        }
      }

      // discovery_calls — calls with "discovery" in subject
      if (record.Subject && /discovery/i.test(record.Subject)) {
        const discMapping = buildKpiMapping({
          profileId, kpiKey: 'discovery_calls', rawValue: 1, fromUnit: 'Count',
          source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:discovery_calls`, weekStart,
        });
        if (discMapping) kpiMappings.push(discMapping);
      }
    } else if (record.TaskSubtype === 'Email') {
      const emailMapping = buildKpiMapping({
        profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:emails_sent`, weekStart,
      });
      if (emailMapping) kpiMappings.push(emailMapping);
    }
  }

  // --- Follow-ups: non-call, non-email completed tasks ---
  const followUpQuery = `
    SELECT Id, Subject, ActivityDate, OwnerId, SystemModstamp
    FROM Task
    WHERE TaskSubtype NOT IN ('Call', 'Email')
    AND Status = 'Completed'
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  let followUpRecords = [];
  try {
    followUpRecords = await soqlQueryAll(creds, followUpQuery);
  } catch (err) {
    if (!isSkippableError(err)) console.warn(`[salesforce:follow_ups] ${err.message}`);
  }

  for (const record of followUpRecords) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;
    if (await shouldSkipProfile(sb, profileId)) continue;

    const weekStart = getWeekStart(record.ActivityDate || record.SystemModstamp);
    const followMapping = buildKpiMapping({
      profileId, kpiKey: 'follow_ups', rawValue: 1, fromUnit: 'Count',
      source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:follow_ups`, weekStart,
    });
    if (followMapping) kpiMappings.push(followMapping);
  }

  // Cursor: max SystemModstamp across both queries
  const allRecords = [...records, ...followUpRecords];
  const lastStamp = allRecords.reduce((max, r) => {
    return r.SystemModstamp > max ? r.SystemModstamp : max;
  }, cursor || '');

  return {
    records: allRecords,
    nextCursor: lastStamp || cursor,
    kpiMappings,
  };
}

// ── Sync: Meetings (Events) ─────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `WHERE SystemModstamp > ${cursor}`
    : `WHERE SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, Subject, StartDateTime, EndDateTime, OwnerId,
           Location, Description, WhoId, SystemModstamp
    FROM Event
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  let records;
  try {
    records = await soqlQueryAll(creds, query);
  } catch (err) {
    if (isSkippableError(err)) {
      console.warn(`[salesforce:meetings] Skipping — ${err.message}`);
      return { records: [], nextCursor: cursor, kpiMappings: [], calendarEvents: [] };
    }
    throw err;
  }
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );

    if (profileId && !(await shouldSkipProfile(sb, profileId))) {
      const meetingWeekStart = getWeekStart(record.StartDateTime || record.SystemModstamp);

      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:event:${record.Id}:meetings`,
        weekStart: meetingWeekStart,
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);

      // demos_completed — meetings with "demo" in subject
      if (record.Subject && /demo/i.test(record.Subject)) {
        const demoMapping = buildKpiMapping({
          profileId, kpiKey: 'demos_completed', rawValue: 1, fromUnit: 'Count',
          source: 'salesforce', externalEventId: `salesforce:event:${record.Id}:demos_completed`,
          weekStart: meetingWeekStart,
        });
        if (demoMapping) kpiMappings.push(demoMapping);
      }

      // discovery_calls — meetings with "discovery" in subject
      if (record.Subject && /discovery/i.test(record.Subject)) {
        const discMapping = buildKpiMapping({
          profileId, kpiKey: 'discovery_calls', rawValue: 1, fromUnit: 'Count',
          source: 'salesforce', externalEventId: `salesforce:event:${record.Id}:discovery_calls`,
          weekStart: meetingWeekStart,
        });
        if (discMapping) kpiMappings.push(discMapping);
      }
    }

    calendarEvents.push({
      externalEventId: `salesforce:${record.Id}`,
      title: record.Subject || 'Salesforce Event',
      description: record.Description,
      startTime: record.StartDateTime,
      endTime: record.EndDateTime,
      location: record.Location,
      profileId,
      organizerEmail: email,
      eventType: 'meeting',
      rawData: record,
    });
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.SystemModstamp || cursor,
    kpiMappings,
    calendarEvents,
  };
}

// ── Sync: Deals (Opportunities) ──────────────────────────────

async function syncDeals(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `WHERE SystemModstamp > ${cursor}`
    : `WHERE SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, Name, StageName, Amount, OwnerId, CreatedDate,
           CloseDate, Probability, SystemModstamp
    FROM Opportunity
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  let records;
  try {
    records = await soqlQueryAll(creds, query);
  } catch (err) {
    if (isSkippableError(err)) {
      console.warn(`[salesforce:deals] Skipping — ${err.message}`);
      return { records: [], nextCursor: cursor, kpiMappings: [] };
    }
    throw err;
  }
  const kpiMappings = [];
  const pipelineDeals = [];
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  // Fetch dynamic stage metadata — falls back to hardcoded if API fails
  const stageMap = await fetchStageMap(creds);

  // Hardcoded fallback lists (used only when stageMap is null)
  const FALLBACK_STAGE2 = ['Meet & Present', 'Propose', 'Negotiate', 'Closed Won'];
  const FALLBACK_STAGE3 = ['Propose', 'Negotiate', 'Closed Won'];

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );
    if (!profileId) continue;
    if (await shouldSkipProfile(sb, profileId)) continue;

    const weekStart = getWeekStart(record.CreatedDate || record.SystemModstamp);

    // New opportunity created
    const sourcedMapping = buildKpiMapping({
      profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
      source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:sourced`, weekStart,
    });
    if (sourcedMapping) kpiMappings.push(sourcedMapping);

    // pipeline_created — value of new opportunities
    if (record.Amount > 0) {
      const pipelineMapping = buildKpiMapping({
        profileId, kpiKey: 'pipeline_created', rawValue: record.Amount, fromUnit: 'Dollars',
        source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:pipeline_created`, weekStart,
      });
      if (pipelineMapping) kpiMappings.push(pipelineMapping);
    }

    const stageName = record.StageName || '';
    const stageInfo = stageMap ? stageMap[stageName] : null;

    // Dynamic: use SortOrder thresholds (matching Apollo: >=2 = stage2, >=3 = stage3)
    // Fallback: use hardcoded stage name lists
    let isStage2, isStage3, isClosedWon;

    if (stageInfo) {
      const order = stageInfo.sortOrder ?? -1;
      isStage2 = order >= 2 && (!stageInfo.isClosed || stageInfo.isWon);
      isStage3 = order >= 3 && (!stageInfo.isClosed || stageInfo.isWon);
      isClosedWon = stageInfo.isWon === true;
    } else {
      isStage2 = FALLBACK_STAGE2.includes(stageName);
      isStage3 = FALLBACK_STAGE3.includes(stageName);
      isClosedWon = stageName === 'Closed Won';
    }

    if (isStage2) {
      const stage2Mapping = buildKpiMapping({
        profileId, kpiKey: 'stage2_opps', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:stage2`, weekStart,
      });
      if (stage2Mapping) kpiMappings.push(stage2Mapping);
    }

    if (isStage3) {
      const stage3Mapping = buildKpiMapping({
        profileId, kpiKey: 'stage3_opps', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:stage3`, weekStart,
      });
      if (stage3Mapping) kpiMappings.push(stage3Mapping);
    }

    if (isClosedWon) {
      const closedWeek = getWeekStart(record.CloseDate || record.SystemModstamp);
      const wonMapping = buildKpiMapping({
        profileId, kpiKey: 'closed_won', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:closed_won`, weekStart: closedWeek,
      });
      if (wonMapping) kpiMappings.push(wonMapping);

      if (record.Amount > 0) {
        const revenueMapping = buildKpiMapping({
          profileId, kpiKey: 'revenue_generated', rawValue: record.Amount, fromUnit: 'Dollars',
          source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:revenue`, weekStart: closedWeek,
        });
        if (revenueMapping) kpiMappings.push(revenueMapping);
      }

      // sales_cycle_days — days from creation to close
      if (record.CreatedDate && record.CloseDate) {
        const cycleDays = (new Date(record.CloseDate) - new Date(record.CreatedDate)) / (1000 * 60 * 60 * 24);
        if (cycleDays >= 0) {
          const cycleMapping = buildKpiMapping({
            profileId, kpiKey: 'sales_cycle_days', rawValue: cycleDays, fromUnit: 'Days',
            source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:sales_cycle_days`, weekStart: closedWeek,
          });
          if (cycleMapping) kpiMappings.push(cycleMapping);
        }
      }
    }

    // Build pipeline deal for engage_pipeline_deals upsert
    pipelineDeals.push({
      ownerId: profileId,
      dealName: record.Name || `Salesforce Opp ${record.Id.slice(0, 8)}`,
      dealValue: record.Amount || 0,
      stage: stageName || 'discovery',
      probability: record.Probability ?? 0,
      closeDate: record.CloseDate || null,
      lastActivityAt: record.SystemModstamp || null,
      source: 'salesforce',
      externalId: record.Id,
      crmUrl: `${creds.instance_url}/${record.Id}`,
      metadata: { sfStageName: stageName },
    });
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.SystemModstamp || cursor,
    kpiMappings,
    pipelineDeals,
  };
}

// ── Sync: Contacts ───────────────────────────────────────────

async function syncContacts(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `WHERE SystemModstamp > ${cursor}`
    : `WHERE SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, FirstName, LastName, Email, Phone, AccountId, OwnerId, SystemModstamp
    FROM Contact
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  let records;
  try {
    records = await soqlQueryAll(creds, query);
  } catch (err) {
    if (isSkippableError(err)) {
      console.warn(`[salesforce:contacts] Skipping — ${err.message}`);
      return { records: [], nextCursor: cursor, kpiMappings: [] };
    }
    throw err;
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.SystemModstamp || cursor,
    kpiMappings: [], // Contacts don't directly map to KPIs
  };
}

// ── Push: Create Meeting ─────────────────────────────────────

async function createMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const eventBody = {
    Subject: data.title,
    StartDateTime: data.startTime,
    EndDateTime: data.endTime,
    Location: data.location || '',
    Description: data.description || '',
  };

  const result = await sfApiCall(creds, 'POST', '/sobjects/Event', eventBody);

  return {
    externalId: result.id,
    webLink: `${creds.instance_url}/${result.id}`,
  };
}

// ── Push: Log Activity ───────────────────────────────────────

async function logActivity(integration, data) {
  const creds = integration.decryptedCreds;

  // Build subject from explicit field or derive from payload type
  let subject = data.subject || data.title;
  if (!subject && data.type) {
    const label = data.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    subject = data.deal_name ? `${label}: ${data.deal_name}` : label;
  }

  // Build description from payload fields
  let description = data.description || '';
  if (!description && data.type) {
    const parts = [];
    if (data.deal_name) parts.push(`Deal: ${data.deal_name}`);
    if (data.deal_value) parts.push(`Value: $${Number(data.deal_value).toLocaleString()}`);
    if (data.days_inactive) parts.push(`Days Inactive: ${data.days_inactive}`);
    if (data.stage) parts.push(`Stage: ${data.stage}`);
    parts.push(`Source: Apptivia (${data.type})`);
    description = parts.join('\n');
  }

  const taskBody = {
    Subject: subject || 'Apptivia Activity',
    Status: 'Completed',
    ActivityDate: data.date || new Date().toISOString().split('T')[0],
    Description: description,
  };
  if (data.durationMinutes) taskBody.CallDurationInSeconds = data.durationMinutes * 60;

  const result = await sfApiCall(creds, 'POST', '/sobjects/Task', taskBody);
  return { externalId: result.id };
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'task.created': [{ key: 'call_connects', increment: 1 }],
  'event.created': [{ key: 'meetings', increment: 1 }],
  'opportunity.created': [{ key: 'sourced_opps', increment: 1 }],
  'opportunity.closed_won': [{ key: 'closed_won', increment: 1 }],
};

function mapWebhookEvent(payload) {
  // Salesforce Platform Events / Change Data Capture format
  const eventName = payload?.ChangeEventHeader?.changeType
    ? `${(payload.ChangeEventHeader.entityName || '').toLowerCase()}.${payload.ChangeEventHeader.changeType.toLowerCase()}`
    : payload?.event || '';
  const eventId = payload?.ChangeEventHeader?.recordIds?.[0] || payload?.id || null;
  const userEmail = payload?.userEmail || payload?.ChangeEventHeader?.commitUser || null;
  return { eventName, eventId, userEmail };
}

// ── Helpers ──────────────────────────────────────────────────

function getISODateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'salesforce',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    activities: syncActivities,
    meetings: syncMeetings,
    deals: syncDeals,
    contacts: syncContacts,
  },
  push: {
    createMeeting,
    logActivity,
  },
  kpiMap,
  mapWebhookEvent,
};
