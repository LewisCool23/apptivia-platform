import React from 'react';
import { Link } from 'react-router-dom';

const SECURITY_SECTIONS = [
  {
    icon: '🔒',
    title: 'Encryption',
    items: [
      'All data transmitted between your browser and Apptivia is encrypted using TLS 1.2+ (HTTPS)',
      'Database connections use encrypted channels with certificate verification',
      'API keys and integration credentials are encrypted at rest using AES-256',
      'User passwords are hashed using bcrypt with per-user salt (never stored in plaintext)',
    ],
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Isolation',
    items: [
      'Each organization\'s data is logically isolated using Row Level Security (RLS) policies at the database level',
      'All database queries are automatically scoped to the authenticated user\'s organization',
      'API endpoints enforce organization-scoped access — users cannot query or modify data from other organizations',
      'Integration credentials and configurations are organization-scoped and inaccessible across tenants',
    ],
  },
  {
    icon: '🔑',
    title: 'Authentication & Access Control',
    items: [
      'Authentication powered by Supabase Auth with secure JWT token management',
      'Role-based access control (RBAC) with four roles: Administrator, Manager, Coach, and Power User',
      'Granular permission overrides allow administrators to customize access per user',
      'Session tokens expire automatically and are refreshed securely',
      'Password reset flows use time-limited, single-use tokens delivered via email',
    ],
  },
  {
    icon: '🔌',
    title: 'Integration Security',
    items: [
      'Third-party integrations (Salesforce, HubSpot, etc.) connect via industry-standard OAuth 2.0 authorization flows',
      'Apptivia only requests the minimum scopes necessary for each integration',
      'OAuth tokens are stored encrypted and refreshed automatically — we never store your CRM password',
      'API key integrations (Apollo, Marketo) use encrypted credential storage',
      'Any integration can be disconnected instantly from Organization Settings',
    ],
  },
  {
    icon: '🤖',
    title: 'AI & Data Processing',
    items: [
      'Aaron AI Coach is powered by Anthropic\'s Claude — a model built with safety and privacy as core principles',
      'AI-generated outreach and coaching recommendations are processed in real-time and not used to train models',
      'Chat conversations with Aaron are stored locally in your browser, not in our database',
      'AI context is scoped to your organization\'s data — no cross-organization data is ever included in AI prompts',
    ],
  },
  {
    icon: '🏗️',
    title: 'Infrastructure',
    items: [
      'Application hosted on secure, managed infrastructure with automated SSL certificate management',
      'Database hosted on Supabase (built on AWS) with automated backups and point-in-time recovery',
      'All server access requires authenticated SSH with key-based or password authentication',
      'Process management via PM2 with automatic restart on failure and environment isolation',
    ],
  },
  {
    icon: '📋',
    title: 'Operational Security',
    items: [
      'Regular dependency audits and updates to address known vulnerabilities',
      'Input validation on all API endpoints to prevent injection attacks (SQL injection, XSS, CSRF)',
      'Rate limiting on authentication endpoints to prevent brute-force attacks',
      'Cron job overlap guards prevent duplicate processing and data corruption',
      'Comprehensive error logging without exposing sensitive data in error messages',
    ],
  },
  {
    icon: '📊',
    title: 'Data Handling',
    items: [
      'Sales performance data is retained for the duration of your active subscription',
      'Data export is available in CSV and PDF formats for portability',
      'Upon subscription cancellation, data is retained for 90 days (for reactivation) then permanently deleted',
      'Anonymized aggregate data may be used for cross-organization benchmarking — individual records are never shared',
      'Stripe handles all payment processing — we never store credit card numbers',
    ],
  },
];

export default function Security() {
  return (
    <div className="min-h-screen bg-apptivia-paper">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">Apptivia</Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Log In</Link>
            <Link to="/signup" className="bg-apptivia-coral text-white text-sm px-4 py-2 rounded-lg hover:bg-apptivia-coral transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Security at Apptivia</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your sales data is among your most sensitive business information. We take its protection seriously. Here is how we safeguard your data at every layer.
          </p>
        </div>

        <div className="space-y-10">
          {SECURITY_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">{section.icon}</span>
                {section.title}
              </h2>
              <ul className="space-y-3">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-apptivia-coral-tone-50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Have a security question?</h2>
          <p className="text-gray-600 mb-4">
            If you have questions about our security practices or want to report a vulnerability, please contact our security team.
          </p>
          <a
            href="mailto:security@apptivia.app"
            className="inline-block bg-apptivia-coral text-white font-medium px-6 py-2.5 rounded-lg hover:bg-apptivia-coral transition-colors"
          >
            Contact Security Team
          </a>
        </div>
      </main>

      <footer className="bg-apptivia-ink text-gray-400 py-8 mt-16">
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
