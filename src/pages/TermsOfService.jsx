import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
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

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: April 10, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of the Apptivia platform, including the website at apptivia.app, all associated APIs, integrations, and related services (collectively, the "Service") provided by Apptivia ("we," "our," or "us"). By creating an account, accessing, or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed">
              Apptivia is a sales performance intelligence platform that provides scorecard-based KPI tracking, AI-powered coaching, signal-driven prospecting, team analytics, gamification through contests and achievements, and integration with third-party sales tools. The Service is designed for sales teams and their managers to measure, improve, and optimize sales performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration and Organization</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              To use the Service, you must create an account with a valid email address and set up or join an organization. The person who creates an organization is designated as the administrator and is responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Configuring organizational settings, KPIs, team structures, and sales methodology</li>
              <li>Inviting and managing team members and their roles</li>
              <li>Managing third-party integration connections and data access</li>
              <li>Ensuring that all users within the organization comply with these Terms</li>
              <li>Managing the organization's subscription and billing</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized access to your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Subscription and Billing</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              The Service is offered under tiered subscription plans. Current pricing is available at apptivia.app. Key billing terms:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Free Trial:</strong> New organizations receive a 14-day free trial of the Pro plan. No credit card is required to start the trial.</li>
              <li><strong>Billing Cycle:</strong> Subscriptions are billed monthly or annually, depending on the plan selected. Billing begins at the end of the free trial period.</li>
              <li><strong>Seat-Based Pricing:</strong> Pricing is per active user per month. Adding team members may increase your monthly charge.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time from Organization Settings. Cancellation takes effect at the end of the current billing period. No partial refunds are provided for unused time within a billing cycle.</li>
              <li><strong>Payment Processing:</strong> All payments are processed securely through Stripe. We do not store credit card numbers on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p className="text-gray-700 leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations</li>
              <li>Attempt to gain unauthorized access to other organizations' data or any part of the Service not intended for your use</li>
              <li>Reverse engineer, decompile, or disassemble any portion of the Service</li>
              <li>Use automated means (bots, scrapers, crawlers) to access the Service except through our documented APIs</li>
              <li>Transmit viruses, malware, or any code designed to interfere with the Service</li>
              <li>Misrepresent your identity or impersonate another user</li>
              <li>Use the AI coaching features to generate content that is harassing, discriminatory, or otherwise harmful</li>
              <li>Resell, sublicense, or redistribute the Service without our written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Ownership and Intellectual Property</h2>

            <h3 className="text-lg font-medium text-gray-800 mb-2">6.1 Your Data</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              You retain all rights to the data you and your organization input into the Service, including sales performance metrics, team configurations, coaching plans, and any content created within the platform. We claim no ownership over your data.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">6.2 Our Service</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              The Service, including its design, code, algorithms, AI models, scoring methodologies, and documentation, is owned by Apptivia and protected by intellectual property laws. Your subscription grants you a limited, non-exclusive, non-transferable license to use the Service for your internal business purposes during the subscription term.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">6.3 AI-Generated Content</h3>
            <p className="text-gray-700 leading-relaxed">
              Content generated by Aaron AI Coach, including coaching recommendations, outreach drafts, performance insights, and coaching plans, is generated for your use within the Service. You may use AI-generated content for your business purposes. We do not claim ownership of AI-generated content specific to your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Integrations</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service allows you to connect third-party tools (e.g., Salesforce, HubSpot, Gong, Outreach, Apollo). When you connect an integration, you authorize us to access data from that service within the scopes you grant. We are not responsible for the availability, accuracy, or security practices of third-party services. Your use of third-party services is governed by their respective terms of service and privacy policies. You may disconnect any integration at any time from your organization settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Service Availability and Support</h2>
            <p className="text-gray-700 leading-relaxed">
              We strive to maintain high availability of the Service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We will make reasonable efforts to provide advance notice of scheduled maintenance. Support is available via email at <a href="mailto:support@apptivia.app" className="text-blue-600 hover:underline">support@apptivia.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, Apptivia shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, revenue, data, or business opportunities, arising out of or related to your use of the Service. Our total liability for any claims arising under these Terms shall not exceed the amount you paid us in the twelve (12) months preceding the claim. The Service provides performance data and AI-generated recommendations for informational purposes. Business decisions should not be based solely on Service outputs without independent judgment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify and hold harmless Apptivia, its officers, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorney fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may suspend or terminate your access to the Service if you violate these Terms, fail to pay subscription fees, or engage in conduct that we determine is harmful to other users or the Service. Upon termination, your right to use the Service ceases immediately. You may request export of your data within 30 days of termination. After 90 days, your data will be permanently deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Modifications to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may modify these Terms at any time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. Your continued use of the Service after changes become effective constitutes acceptance. If you do not agree with modified Terms, you must stop using the Service and cancel your subscription.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions. Any disputes arising under these Terms shall be resolved through binding arbitration administered by the American Arbitration Association, except that either party may seek injunctive relief in any court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              Questions about these Terms should be directed to:<br />
              <a href="mailto:legal@apptivia.app" className="text-blue-600 hover:underline">legal@apptivia.app</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-apptivia-ink text-gray-400 py-8">
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
