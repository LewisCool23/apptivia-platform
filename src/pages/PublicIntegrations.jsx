import React from 'react';
import { Link } from 'react-router-dom';

const INTEGRATIONS = [
  {
    name: 'Salesforce',
    category: 'CRM',
    description: 'Sync contacts, deals, and activities. Automatically pull pipeline data and rep activity into your Apptivia Scorecard.',
    icon: 'SF',
    color: 'from-blue-400 to-blue-600',
  },
  {
    name: 'HubSpot',
    category: 'CRM',
    description: 'Connect contacts, deals, and meetings. Track rep engagement and deal progression directly from HubSpot.',
    icon: 'HS',
    color: 'from-orange-400 to-orange-600',
  },
  {
    name: 'Outreach',
    category: 'Sales Engagement',
    description: 'Import call activity, email sequences, and engagement metrics to measure outbound performance.',
    icon: 'OR',
    color: 'from-violet-400 to-violet-600',
  },
  {
    name: 'SalesLoft',
    category: 'Sales Engagement',
    description: 'Sync cadence data, call logs, and email activity. Track rep productivity across all outbound channels.',
    icon: 'SL',
    color: 'from-teal-400 to-teal-600',
  },
  {
    name: 'Apollo',
    category: 'Outbound & Enrichment',
    description: 'Power Apptivia Engage with contact enrichment, company data, and outbound sequence tracking.',
    icon: 'AP',
    color: 'from-indigo-400 to-indigo-600',
  },
  {
    name: 'Gong',
    category: 'Revenue Intelligence',
    description: 'Pull call recordings, talk time analytics, and meeting data. Coach reps with conversation intelligence.',
    icon: 'GG',
    color: 'from-pink-400 to-rose-600',
  },
  {
    name: 'Marketo',
    category: 'Marketing Automation',
    description: 'Connect marketing lead data and campaign activity to track marketing-sourced pipeline contribution.',
    icon: 'MK',
    color: 'from-purple-400 to-purple-600',
  },
  {
    name: 'Microsoft Outlook',
    category: 'Calendar',
    description: 'Sync calendar events and meeting counts. Track meetings booked and attended across your team.',
    icon: 'MS',
    color: 'from-sky-400 to-sky-600',
  },
  {
    name: 'Google Calendar',
    category: 'Calendar',
    description: 'Connect Google Calendar to automatically count meetings booked and track scheduling activity.',
    icon: 'GC',
    color: 'from-green-400 to-emerald-600',
  },
  {
    name: 'Sendoso',
    category: 'Direct Mail & Gifting',
    description: 'Track direct mail sends, gift acceptance rates, and influenced meetings from gifting campaigns.',
    icon: 'SO',
    color: 'from-amber-400 to-amber-600',
  },
];

const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))];

export default function PublicIntegrations() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">Apptivia</Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Log In</Link>
            <Link to="/signup" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Connect Your Sales Stack
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Apptivia integrates with the tools your team already uses. Connect your CRM, sales engagement platform, and calendar to automatically populate your scorecard with real activity data.
          </p>
        </div>
      </section>

      {/* Integration Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        {CATEGORIES.map(category => (
          <div key={category} className="mb-12">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {INTEGRATIONS.filter(i => i.category === category).map(integration => (
                <div key={integration.name} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${integration.color} flex items-center justify-center text-white font-bold text-xs`}>
                      {integration.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{integration.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to connect your tools?</h2>
          <p className="text-blue-100 mb-8">Start your free trial and connect your first integration in under 5 minutes.</p>
          <Link to="/signup" className="inline-block bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors">
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <p>&copy; 2026 Apptivia. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/security" className="hover:text-white transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
