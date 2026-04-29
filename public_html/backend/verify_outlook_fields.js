#!/usr/bin/env node

/**
 * Microsoft Outlook Field Verification Script
 *
 * Tests Microsoft Graph API field structure for both calendar events and emails.
 * Requires: Microsoft Graph API permissions + OAuth credentials
 *
 * Usage:
 * 1. Set MICROSOFT_GRAPH_REFRESH_TOKEN environment variable
 * 2. Run: node verify_outlook_fields.js
 */

const fetch = require('node-fetch');

const REFRESH_TOKEN = process.env.MICROSOFT_GRAPH_REFRESH_TOKEN;
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET;
const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID || 'common';

if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables:');
  console.error('   MICROSOFT_GRAPH_REFRESH_TOKEN');
  console.error('   MICROSOFT_GRAPH_CLIENT_ID');
  console.error('   MICROSOFT_GRAPH_CLIENT_SECRET');
  console.error('   MICROSOFT_GRAPH_TENANT_ID (optional, defaults to "common")');
  process.exit(1);
}

async function getAccessToken() {
  console.log('Getting Microsoft Graph access token...');

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default'
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}\n${errorData}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testCalendarEvents(accessToken) {
  console.log('\nTesting Microsoft Graph Calendar Events API...');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const url = 'https://graph.microsoft.com/v1.0/me/events?' + new URLSearchParams({
    $filter: `start/dateTime ge '${weekAgo.toISOString()}' and start/dateTime le '${now.toISOString()}'`,
    $orderby: 'start/dateTime',
    $top: '10'
  });

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    if (response.status === 403) {
      console.log(`   Calendar access forbidden - check permissions`);
    } else {
      console.log(`   Calendar API error`);
    }
    return { available: false, reason: `http_${response.status}` };
  }

  const data = await response.json();
  const events = data.value || [];

  console.log(`   Found ${events.length} events in past week`);

  if (events.length === 0) {
    console.log(`   No events to analyze field structure`);
    return { available: true, events: 0 };
  }

  const event = events[0];
  console.log(`   Sample event: "${event.subject || 'Untitled'}"`);

  const fieldResults = {};

  if (event.start) {
    console.log(`   start.dateTime: ${event.start.dateTime}`);
    console.log(`   start.timeZone: ${event.start.timeZone}`);
    fieldResults.startDateTime = !!event.start.dateTime;
    fieldResults.startTimeZone = !!event.start.timeZone;
  } else {
    console.log(`   start: MISSING`);
    fieldResults.startDateTime = false;
    fieldResults.startTimeZone = false;
  }

  if (event.end) {
    console.log(`   end.dateTime: ${event.end.dateTime}`);
    console.log(`   end.timeZone: ${event.end.timeZone}`);
    fieldResults.endDateTime = !!event.end.dateTime;
    fieldResults.endTimeZone = !!event.end.timeZone;
  } else {
    console.log(`   end: MISSING`);
    fieldResults.endDateTime = false;
    fieldResults.endTimeZone = false;
  }

  if (event.responseStatus) {
    console.log(`   responseStatus.response: ${event.responseStatus.response}`);
    console.log(`   responseStatus.time: ${event.responseStatus.time}`);
    fieldResults.responseStatus = !!event.responseStatus.response;
  } else {
    console.log(`   responseStatus: MISSING`);
    fieldResults.responseStatus = false;
  }

  if (event.organizer) {
    console.log(`   organizer.emailAddress.address: ${event.organizer.emailAddress?.address}`);
    console.log(`   organizer.emailAddress.name: ${event.organizer.emailAddress?.name}`);
    fieldResults.organizerEmail = !!event.organizer.emailAddress?.address;
  } else {
    console.log(`   organizer: MISSING`);
    fieldResults.organizerEmail = false;
  }

  if (event.attendees && event.attendees.length > 0) {
    console.log(`   attendees: ${event.attendees.length} attendees`);
    const firstAttendee = event.attendees[0];
    console.log(`   attendees[0].emailAddress.address: ${firstAttendee.emailAddress?.address}`);
    console.log(`   attendees[0].status.response: ${firstAttendee.status?.response}`);
    fieldResults.attendees = true;
    fieldResults.attendeeStatus = !!firstAttendee.status?.response;
  } else {
    console.log(`   attendees: None (solo event or organizer-only)`);
    fieldResults.attendees = false;
    fieldResults.attendeeStatus = false;
  }

  console.log(`   isAllDay: ${event.isAllDay}`);
  console.log(`   showAs: ${event.showAs}`);
  console.log(`   sensitivity: ${event.sensitivity}`);
  fieldResults.isAllDay = event.hasOwnProperty('isAllDay');
  fieldResults.showAs = !!event.showAs;

  if (event.start?.dateTime && event.end?.dateTime) {
    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);
    const durationMinutes = (endTime - startTime) / (1000 * 60);
    console.log(`   Calculated duration: ${durationMinutes} minutes`);
    fieldResults.durationCalculation = true;
  } else {
    console.log(`   Cannot calculate duration`);
    fieldResults.durationCalculation = false;
  }

  console.log(`   Full event keys:`, Object.keys(event));

  return {
    available: true,
    events: events.length,
    fields: fieldResults,
    sampleEvent: event
  };
}

async function testEmails(accessToken) {
  console.log('\nTesting Microsoft Graph Mail API...');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const url = 'https://graph.microsoft.com/v1.0/me/messages?' + new URLSearchParams({
    $filter: `sentDateTime ge ${weekAgo.toISOString()} and isDraft eq false`,
    $orderby: 'sentDateTime desc',
    $top: '10'
  });

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    if (response.status === 403) {
      console.log(`   Mail access forbidden - check permissions`);
    } else {
      console.log(`   Mail API error`);
    }
    return { available: false, reason: `http_${response.status}` };
  }

  const data = await response.json();
  const emails = data.value || [];

  console.log(`   Found ${emails.length} sent emails in past week`);

  if (emails.length === 0) {
    console.log(`   No emails to analyze field structure`);
    return { available: true, emails: 0 };
  }

  const email = emails[0];
  console.log(`   Sample email: "${email.subject || 'No Subject'}"`);

  const fieldResults = {};

  console.log(`   sentDateTime: ${email.sentDateTime}`);
  console.log(`   createdDateTime: ${email.createdDateTime}`);
  console.log(`   receivedDateTime: ${email.receivedDateTime}`);
  fieldResults.sentDateTime = !!email.sentDateTime;
  fieldResults.createdDateTime = !!email.createdDateTime;

  console.log(`   isDraft: ${email.isDraft}`);
  console.log(`   isRead: ${email.isRead}`);
  fieldResults.isDraft = email.hasOwnProperty('isDraft');
  fieldResults.isRead = email.hasOwnProperty('isRead');

  if (email.toRecipients && email.toRecipients.length > 0) {
    console.log(`   toRecipients: ${email.toRecipients.length} recipients`);
    const firstRecipient = email.toRecipients[0];
    console.log(`   toRecipients[0].emailAddress.address: ${firstRecipient.emailAddress?.address}`);
    fieldResults.toRecipients = true;
  } else {
    console.log(`   toRecipients: MISSING`);
    fieldResults.toRecipients = false;
  }

  if (email.sender) {
    console.log(`   sender.emailAddress.address: ${email.sender.emailAddress?.address}`);
    fieldResults.senderEmail = !!email.sender.emailAddress?.address;
  } else {
    console.log(`   sender: MISSING`);
    fieldResults.senderEmail = false;
  }

  if (email.ccRecipients) {
    console.log(`   ccRecipients: ${email.ccRecipients.length} CC recipients`);
    fieldResults.ccRecipients = true;
  }
  if (email.bccRecipients) {
    console.log(`   bccRecipients: ${email.bccRecipients.length} BCC recipients`);
    fieldResults.bccRecipients = true;
  }

  console.log(`   Full email keys:`, Object.keys(email));

  return {
    available: true,
    emails: emails.length,
    fields: fieldResults,
    sampleEmail: email
  };
}

async function main() {
  console.log('Microsoft Outlook Field Verification');
  console.log('=======================================');

  try {
    const accessToken = await getAccessToken();
    console.log('   Access token obtained');

    const calendarResult = await testCalendarEvents(accessToken);
    const emailResult = await testEmails(accessToken);

    console.log('\nMICROSOFT OUTLOOK FIELD SUMMARY');
    console.log('===================================');

    if (calendarResult.available) {
      const fields = calendarResult.fields || {};
      const criticalFields = ['startDateTime', 'endDateTime', 'responseStatus', 'organizerEmail'];
      const missingCritical = criticalFields.filter(field => !fields[field]);

      if (missingCritical.length === 0) {
        console.log('All critical calendar fields present for meeting KPI mapping');
      } else {
        console.log(`Missing critical calendar fields: ${missingCritical.join(', ')}`);
      }
    }

    if (emailResult.available) {
      const fields = emailResult.fields || {};
      const criticalFields = ['sentDateTime', 'isDraft', 'toRecipients'];
      const missingCritical = criticalFields.filter(field => !fields[field]);

      if (missingCritical.length === 0) {
        console.log('All critical email fields present for email KPI mapping');
      } else {
        console.log(`Missing critical email fields: ${missingCritical.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testCalendarEvents, testEmails, getAccessToken };
