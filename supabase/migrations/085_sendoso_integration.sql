-- 085: Add Sendoso integration template
-- Sendoso — Direct mail & gifting platform

INSERT INTO integration_mapping_templates (
  integration_type, display_name, icon, description,
  default_field_mappings, required_fields, oauth_config, is_active
) VALUES (
  'sendoso',
  'Sendoso',
  'sendoso',
  'Direct mail & gifting — sends, acceptance, influenced meetings',
  '{"gifts_sent":{"object":"sends","aggregation":"count"},"gifts_accepted":{"object":"sends","filter":"status=accepted","aggregation":"count"},"gift_influenced_meetings":{"object":"sends","filter":"meeting_booked=true","aggregation":"count"}}'::jsonb,
  ARRAY['gifts_sent','gifts_accepted'],
  '{"authorization_url":"https://app.sendoso.com/oauth/authorize","token_url":"https://app.sendoso.com/oauth/token","scopes":[],"response_type":"code"}'::jsonb,
  true
)
ON CONFLICT (integration_type) DO UPDATE SET
  display_name         = EXCLUDED.display_name,
  description          = EXCLUDED.description,
  default_field_mappings = EXCLUDED.default_field_mappings,
  required_fields      = EXCLUDED.required_fields,
  oauth_config         = EXCLUDED.oauth_config,
  is_active            = EXCLUDED.is_active;
