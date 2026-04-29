/**
 * Integration constants — single source of truth for all integration pages.
 */

export interface IntegrationTemplate {
  integration_type: string;
  display_name: string;
  description: string;
  icon: string;
  color: string;
}

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

export interface ApiKeyProviderConfig {
  fields: CredentialField[];
}

export const SUPPORTED_INTEGRATIONS: IntegrationTemplate[] = [
  { integration_type: 'salesforce', display_name: 'Salesforce', description: 'CRM — contacts, deals, activities', icon: 'SF', color: 'bg-apptivia-ink' },
  { integration_type: 'hubspot', display_name: 'HubSpot', description: 'CRM — contacts, deals, meetings', icon: 'HS', color: 'bg-apptivia-coral' },
  { integration_type: 'outreach', display_name: 'Outreach', description: 'Sales engagement — calls, emails, sequences', icon: 'OR', color: 'bg-apptivia-carbon-700' },
  { integration_type: 'salesloft', display_name: 'SalesLoft', description: 'Sales engagement — cadences, calls, emails', icon: 'SL', color: 'bg-apptivia-carbon-700' },
  { integration_type: 'marketo', display_name: 'Marketo', description: 'Marketing automation — leads, activities', icon: 'MK', color: 'bg-apptivia-carbon-700' },
  { integration_type: 'microsoft_calendar', display_name: 'Microsoft Outlook', description: 'Calendar — meetings, scheduling', icon: 'MS', color: 'bg-apptivia-carbon-700' },
  { integration_type: 'google_calendar', display_name: 'Google Calendar', description: 'Calendar — meetings, scheduling', icon: 'GC', color: 'bg-apptivia-carbon-700' },
  { integration_type: 'apollo', display_name: 'Apollo', description: 'Outbound — contacts, emails, sequences', icon: 'AP', color: 'bg-apptivia-coral' },
  { integration_type: 'gong', display_name: 'Gong', description: 'Revenue intelligence — calls, talk time, meetings', icon: 'GG', color: 'bg-apptivia-coral' },
  { integration_type: 'sendoso', display_name: 'Sendoso', description: 'Direct mail & gifting — sends, acceptance, influenced meetings', icon: 'SO', color: 'bg-apptivia-warning' },
];

export const API_KEY_PROVIDERS: Record<string, ApiKeyProviderConfig> = {
  apollo: {
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'Enter your Apollo API key', type: 'password' }],
  },
  marketo: {
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Marketo Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Marketo Client Secret', type: 'password' },
      { key: 'munchkin_id', label: 'Munchkin Account ID', placeholder: 'e.g. 123-ABC-456' },
    ],
  },
};
