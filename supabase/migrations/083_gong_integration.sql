-- 083: Add Gong integration template
-- Gong.io — Revenue intelligence platform (calls, talk time, meetings)

INSERT INTO integration_mapping_templates (
  integration_type, display_name, icon, description,
  default_field_mappings, required_fields, oauth_config, is_active
) VALUES (
  'gong',
  'Gong',
  'gong',
  'Revenue intelligence — calls, talk time, meetings',
  '{"call_connects":{"object":"calls","aggregation":"count"},"talk_time_minutes":{"object":"calls","field":"duration","aggregation":"sum"},"meetings":{"object":"calls","filter":"mediaType=video","aggregation":"count"}}'::jsonb,
  ARRAY['call_connects','talk_time_minutes','meetings'],
  '{"authorization_url":"https://app.gong.io/oauth2/authorize","token_url":"https://app.gong.io/oauth2/generate-customer-token","scopes":["api:calls:read:basic","api:calls:read:extensive","api:users:read","api:stats:scorecards","api:stats:interaction"],"response_type":"code"}'::jsonb,
  true
)
ON CONFLICT (integration_type) DO UPDATE SET
  display_name         = EXCLUDED.display_name,
  description          = EXCLUDED.description,
  default_field_mappings = EXCLUDED.default_field_mappings,
  required_fields      = EXCLUDED.required_fields,
  oauth_config         = EXCLUDED.oauth_config,
  is_active            = EXCLUDED.is_active;
