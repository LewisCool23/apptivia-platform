#!/usr/bin/env node

/**
 * Google Calendar Field Verification Script
 *
 * Tests Google Calendar API field structure to verify integration mapping.
 * Requires: Google Calendar API enabled + OAuth credentials
 *
 * Usage:
 * 1. Set GOOGLE_CALENDAR_REFRESH_TOKEN environment variable
 * 2. Run: node verify_google_calendar_fields.js
 */

const fetch = require('node-fetch');

const REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables:');
  console.error('   GOOGLE_CALENDAR_REFRESH_TOKEN');
  console.error('   GOOGLE_CLIENT_ID');
  console.error('   GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

async function getAccessToken() {
  console.log('Getting Google Calendar access token...');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testCalendarEvents(accessToken) {
  console.log('\nTesting Google Calendar Events API...');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
    timeMin: weekAgo.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '10'
  });

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    console.log(`   Calendar API error`);
    return { available: false, reason: `http_${response.status}` };
  }

  const data = await response.json();
  const events = data.items || [];

  console.log(`   Found ${events.length} events in past week`);

  if (events.length === 0) {
    console.log(`   No events to analyze field structure`);
    return { available: true, events: 0 };
  }

  const event = events[0];
  console.log(`   Sample event: "${event.summary || 'Untitled'}"`);

  const fieldResults = {};

  if (event.start) {
    console.log(`   start.dateTime: ${event.start.dateTime}`);
    console.log(`   start.date: ${event.start.date}`);
    fieldResults.startDateTime = !!event.start.dateTime;
    fieldResults.startDate = !!event.start.date;
  } else {
    console.log(`   start: MISSING`);
    fieldResults.startDateTime = false;
    fieldResults.startDate = false;
  }

  if (event.end) {
    console.log(`   end.dateTime: ${event.end.dateTime}`);
    console.log(`   end.date: ${event.end.date}`);
    fieldResults.endDateTime = !!event.end.dateTime;
    fieldResults.endDate = !!event.end.date;
  } else {
    console.log(`   end: MISSING`);
    fieldResults.endDateTime = false;
    fieldResults.endDate = false;
  }

  console.log(`   status: "${event.status}"`);
  fieldResults.status = !!event.status;

  if (event.organizer) {
    console.log(`   organizer.email: ${event.organizer.email}`);
    console.log(`   organizer.displayName: ${event.organizer.displayName}`);
    fieldResults.organizerEmail = !!event.organizer.email;
  } else {
    console.log(`   organizer: MISSING`);
    fieldResults.organizerEmail = false;
  }

  if (event.creator) {
    console.log(`   creator.email: ${event.creator.email}`);
    fieldResults.creatorEmail = !!event.creator.email;
  } else {
    console.log(`   creator: MISSING`);
    fieldResults.creatorEmail = false;
  }

  if (event.attendees && event.attendees.length > 0) {
    console.log(`   attendees: ${event.attendees.length} attendees`);
    const firstAttendee = event.attendees[0];
    console.log(`   attendees[0].email: ${firstAttendee.email}`);
    console.log(`   attendees[0].responseStatus: ${firstAttendee.responseStatus}`);
    fieldResults.attendees = true;
    fieldResults.attendeeResponseStatus = !!firstAttendee.responseStatus;
  } else {
    console.log(`   attendees: None (solo event or creator-only)`);
    fieldResults.attendees = false;
    fieldResults.attendeeResponseStatus = false;
  }

  if (event.start?.dateTime && event.end?.dateTime) {
    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);
    const durationMinutes = (endTime - startTime) / (1000 * 60);
    console.log(`   Calculated duration: ${durationMinutes} minutes`);
    fieldResults.durationCalculation = true;
  } else {
    console.log(`   Cannot calculate duration (all-day event or missing times)`);
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

async function main() {
  console.log('Google Calendar Field Verification');
  console.log('====================================');

  try {
    const accessToken = await getAccessToken();
    console.log('   Access token obtained');

    const calendarResult = await testCalendarEvents(accessToken);

    console.log('\nGOOGLE CALENDAR FIELD SUMMARY');
    console.log('=================================');

    if (calendarResult.available) {
      const fields = calendarResult.fields || {};
      const criticalFields = ['startDateTime', 'endDateTime', 'status', 'organizerEmail'];
      const missingCritical = criticalFields.filter(field => !fields[field]);

      if (missingCritical.length === 0) {
        console.log('All critical fields present for meeting KPI mapping');
      } else {
        console.log(`Missing critical fields: ${missingCritical.join(', ')}`);
      }
    } else {
      console.log('Google Calendar API not accessible');
    }

  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testCalendarEvents, getAccessToken };
