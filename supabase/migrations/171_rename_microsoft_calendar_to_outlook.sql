-- Rename microsoft_calendar → microsoft_outlook in existing integration rows
-- Follows the provider rename done in code (microsoft_outlook provider file)
UPDATE integrations
  SET integration_type = 'microsoft_outlook'
  WHERE integration_type = 'microsoft_calendar';
