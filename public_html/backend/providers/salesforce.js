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
    result = await fetchJson(`${creds.instance_url}${result.nextRecordsUrl}`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    });
    records.push(...(result.records || []));
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

  const query = `
    SELECT Id, Subject, Type, Status, ActivityDate, OwnerId,
           CallDurationInSeconds, WhoId, WhatId, SystemModstamp
    FROM Task
    WHERE (Type = 'Call' OR Type = 'Email')
    AND Status = 'Completed'
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  const records = await soqlQueryAll(creds, query);
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );
    if (!profileId) continue;

    const weekStart = getWeekStart(record.ActivityDate || record.SystemModstamp);

    if (record.Type === 'Call') {
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
    } else if (record.Type === 'Email') {
      const emailMapping = buildKpiMapping({
        profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:task:${record.Id}:emails_sent`, weekStart,
      });
      if (emailMapping) kpiMappings.push(emailMapping);
    }
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.SystemModstamp || cursor,
    kpiMappings,
  };
}

// ── Sync: Meetings (Events) ─────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `AND SystemModstamp > ${cursor}`
    : `AND SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, Subject, StartDateTime, EndDateTime, OwnerId,
           Location, Description, WhoId, SystemModstamp
    FROM Event
    ${sinceFilter ? 'WHERE 1=1 ' + sinceFilter : ''}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  const records = await soqlQueryAll(creds, query);
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );

    if (profileId) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:event:${record.Id}:meetings`,
        weekStart: getWeekStart(record.StartDateTime || record.SystemModstamp),
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
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
    ? `AND SystemModstamp > ${cursor}`
    : `AND SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, Name, StageName, Amount, OwnerId, CreatedDate,
           CloseDate, Probability, SystemModstamp
    FROM Opportunity
    WHERE 1=1
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  const records = await soqlQueryAll(creds, query);
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const email = await resolveUserEmail(creds, record.OwnerId);
    if (!email) continue;
    const profileId = await resolveProfileByEmail(
      sb, integration.organization_id, email
    );
    if (!profileId) continue;

    const weekStart = getWeekStart(record.CreatedDate || record.SystemModstamp);

    // New opportunity created
    const sourcedMapping = buildKpiMapping({
      profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
      source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:sourced`, weekStart,
    });
    if (sourcedMapping) kpiMappings.push(sourcedMapping);

    // Stage 2+ (qualified)
    if (record.Probability && record.Probability >= 20) {
      const stage2Mapping = buildKpiMapping({
        profileId, kpiKey: 'stage2_opps', rawValue: 1, fromUnit: 'Count',
        source: 'salesforce', externalEventId: `salesforce:opp:${record.Id}:stage2`, weekStart,
      });
      if (stage2Mapping) kpiMappings.push(stage2Mapping);
    }

    // Closed Won
    if (record.StageName === 'Closed Won') {
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
    }
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.SystemModstamp || cursor,
    kpiMappings,
  };
}

// ── Sync: Contacts ───────────────────────────────────────────

async function syncContacts(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const sinceFilter = cursor
    ? `AND SystemModstamp > ${cursor}`
    : `AND SystemModstamp > ${getISODateDaysAgo(90)}`;

  const query = `
    SELECT Id, FirstName, LastName, Email, Phone, AccountId, OwnerId, SystemModstamp
    FROM Contact
    WHERE 1=1
    ${sinceFilter}
    ORDER BY SystemModstamp ASC
    LIMIT 1000
  `.replace(/\s+/g, ' ').trim();

  const records = await soqlQueryAll(creds, query);

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

  const taskBody = {
    Subject: data.subject || data.title,
    Type: data.type || 'Call',
    Status: 'Completed',
    ActivityDate: data.date || new Date().toISOString().split('T')[0],
    Description: data.description || '',
    CallDurationInSeconds: data.durationMinutes ? data.durationMinutes * 60 : null,
  };

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
