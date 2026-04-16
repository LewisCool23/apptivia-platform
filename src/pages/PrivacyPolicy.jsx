import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: April 10, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Apptivia ("we," "our," or "us") operates the Apptivia sales performance platform at apptivia.app. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, website, and related services (collectively, the "Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.1 Account Information</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              When you create an account, we collect your name, email address, organization name, job title, and role within your organization. Administrators who set up organizations may also provide team structure, department names, and member email addresses for invitation purposes.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.2 Sales Performance Data</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              The Service processes sales performance metrics including but not limited to: call counts, talk time, meetings booked, pipeline values, deal stages, email activity, and other key performance indicators (KPIs). This data is sourced from third-party integrations you connect (e.g., Salesforce, HubSpot, Gong, Outreach) and is used solely to provide scorecard calculations, coaching insights, and performance analytics within your organization.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.3 AI Interaction Data</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              When you interact with Aaron AI Coach, we process your chat messages to generate coaching responses. Chat history is stored locally in your browser and is not shared with other users. The AI system may reference your KPI data, scorecard scores, and organizational context to provide personalized coaching.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.4 Usage and Technical Data</h3>
            <p className="text-gray-700 leading-relaxed">
              We automatically collect technical information including browser type, device type, IP address, pages visited, features used, and timestamps. This data helps us maintain, improve, and secure the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>To provide, operate, and maintain the Service, including scorecard calculations, coaching insights, signal prospecting, and team analytics</li>
              <li>To process and sync data from your connected third-party integrations</li>
              <li>To generate AI-powered coaching recommendations and outreach drafts</li>
              <li>To send notifications about performance milestones, anomalies, and achievements</li>
              <li>To administer your account, including billing, subscription management, and support</li>
              <li>To improve the Service through aggregated, anonymized usage analytics</li>
              <li>To detect and prevent fraud, abuse, and security incidents</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We do not sell your personal information or sales performance data. We share information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Within Your Organization:</strong> Performance data, scorecard scores, and team analytics are visible to authorized users within your organization based on role-based access controls (administrators, managers, coaches, and individual contributors see different views).</li>
              <li><strong>Service Providers:</strong> We use Supabase for database and authentication services, Anthropic's Claude AI for coaching and content generation, Stripe for payment processing, and Twilio for telephony features. These providers process data solely on our behalf under contractual obligations.</li>
              <li><strong>Third-Party Integrations:</strong> When you connect an integration (e.g., Salesforce, HubSpot), data flows between that service and Apptivia as authorized by your administrator. We access only the scopes you grant.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law, regulation, legal process, or governmental request.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, user data may be transferred as part of the transaction. We will notify affected users before their data becomes subject to a different privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your account data and performance metrics for the duration of your active subscription. Historical scorecard data, coaching plans, and achievement records are preserved to enable trend analysis and longitudinal performance tracking. Upon account deletion or subscription cancellation, we retain data for up to 90 days to allow for reactivation, after which it is permanently deleted from our systems. Anonymized, aggregated data used for benchmarking may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement industry-standard security measures to protect your data. See our <Link to="/security" className="text-blue-600 hover:underline">Security page</Link> for detailed information about our security practices, including encryption, access controls, and infrastructure security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements</li>
              <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
              <li><strong>Restriction:</strong> Request that we restrict processing of your data in certain circumstances</li>
              <li><strong>Objection:</strong> Object to processing of your data for specific purposes</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              To exercise any of these rights, contact us at <a href="mailto:privacy@apptivia.app" className="text-blue-600 hover:underline">privacy@apptivia.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Multi-Tenant Data Isolation</h2>
            <p className="text-gray-700 leading-relaxed">
              Apptivia is a multi-tenant platform. Each organization's data is logically isolated using organization-scoped database policies (Row Level Security). Users in one organization cannot access, view, or modify data belonging to another organization. Administrative actions, KPI configurations, team structures, and all performance data are scoped exclusively to the organization that owns them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service uses essential cookies for authentication and session management. We use localStorage for user preferences and UI state. We do not use third-party advertising cookies or cross-site tracking technologies. Analytics data is collected server-side and does not involve third-party tracking scripts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service is designed for business use and is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes by posting a notice within the Service or by email. Your continued use of the Service after changes become effective constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, contact us at:<br />
              <a href="mailto:privacy@apptivia.app" className="text-blue-600 hover:underline">privacy@apptivia.app</a>
            </p>
          </section>
        </div>
      </main>

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
