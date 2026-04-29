import React, { useState } from 'react';
import { Activity, CheckCircle, ArrowRight, Shield, Clock, Zap, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const PILOT_BENEFITS = [
  { icon: Clock, title: '90 Days Free', description: 'Full Pro platform access — Scorecard, Coach, Engage, Aaron AI, Contests — no card required.' },
  { icon: Shield, title: 'Locked Pricing for Life', description: 'Your per-seat rate never increases. Early believers get rewarded permanently.' },
  { icon: Zap, title: 'Direct Founder Access', description: 'Weekly check-ins with the founding team. Your feedback shapes the product roadmap.' },
  { icon: Users, title: 'White-Glove Onboarding', description: 'We configure your KPIs, connect your CRM, and build your first coaching plans with you.' },
];

const WHAT_YOU_GET = [
  'Real-time KPI Scorecard (35 canonical metrics)',
  'AI coaching plans from live data (14 frameworks)',
  'Aaron AI — personal coaching chatbot per rep',
  'Signal-based prospecting (Engage)',
  'Wallboards, contests, 500+ achievements',
  'CRM integration (Salesforce or HubSpot)',
  'Dedicated Slack channel with founding team',
];

const IDEAL_FIT = [
  { label: 'Team size', value: '5-200 sales reps' },
  { label: 'Stack', value: 'Salesforce or HubSpot CRM' },
  { label: 'Pain', value: 'Missing quota, unclear who needs coaching and on what' },
  { label: 'Timeline', value: 'Ready to start within 2 weeks' },
];

export default function PilotApplication() {
  const [form, setForm] = useState({
    name: '', email: '', company: '', teamSize: '', crm: '', biggestPain: '', currentTools: '',
  });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact/pilot-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Activity size={32} className="text-apptivia-coral" />
              <span className="text-2xl font-bold text-apptivia-ink">Apptivia</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/login" className="px-4 py-2 text-apptivia-carbon-700 hover:text-apptivia-ink font-medium text-sm">
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral font-medium text-sm transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 bg-apptivia-ink text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">Limited spots available</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Founding Pilot Program
          </h1>
          <p className="text-xl text-apptivia-carbon-300 mb-2 max-w-2xl mx-auto">
            90 days free. Full platform. Locked pricing for life.
          </p>
          <p className="text-apptivia-carbon-400 max-w-2xl mx-auto">
            We're selecting a small number of B2B sales teams to be Apptivia's founding customers.
            You get the full platform at no cost for 90 days, and if you stay, your price never goes up.
          </p>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 bg-apptivia-paper">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-apptivia-ink text-center mb-10">What founding pilots get</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {PILOT_BENEFITS.map((b) => (
              <div key={b.title} className="bg-white rounded-lg p-6 border border-apptivia-carbon-200 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-apptivia-coral-tone-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <b.icon size={20} className="text-apptivia-coral" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-apptivia-ink mb-1">{b.title}</h3>
                    <p className="text-sm text-apptivia-carbon-600 leading-relaxed">{b.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form + What's Included */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-apptivia-ink mb-2">Apply for the Founding Pilot</h2>
              <p className="text-apptivia-carbon-600 text-sm mb-8">
                We review every application personally. If there's a fit, we'll schedule a 30-minute onboarding call within 48 hours.
              </p>

              {status === 'success' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-apptivia-ink mb-2">Application received</h3>
                  <p className="text-apptivia-carbon-600 text-sm">
                    We'll review your application and reach out within 48 hours. Keep an eye on your inbox.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Company *</label>
                      <input
                        type="text"
                        required
                        value={form.company}
                        onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Sales Team Size *</label>
                      <select
                        required
                        value={form.teamSize}
                        onChange={(e) => setForm(f => ({ ...f, teamSize: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm text-apptivia-carbon-700"
                      >
                        <option value="">Select size</option>
                        <option value="5-10">5-10 reps</option>
                        <option value="11-25">11-25 reps</option>
                        <option value="26-50">26-50 reps</option>
                        <option value="51-100">51-100 reps</option>
                        <option value="100-200">100-200 reps</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Current CRM</label>
                    <select
                      value={form.crm}
                      onChange={(e) => setForm(f => ({ ...f, crm: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm text-apptivia-carbon-700"
                    >
                      <option value="">Select CRM</option>
                      <option value="Salesforce">Salesforce</option>
                      <option value="HubSpot">HubSpot</option>
                      <option value="Other">Other</option>
                      <option value="None">No CRM yet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      What's the biggest challenge your sales team faces right now?
                    </label>
                    <textarea
                      value={form.biggestPain}
                      onChange={(e) => setForm(f => ({ ...f, biggestPain: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm resize-none"
                      placeholder="e.g., We don't know which reps need coaching until it's too late..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      What tools does your team use today? (optional)
                    </label>
                    <input
                      type="text"
                      value={form.currentTools}
                      onChange={(e) => setForm(f => ({ ...f, currentTools: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral text-sm"
                      placeholder="e.g., Outreach, Gong, SalesLoft..."
                    />
                  </div>

                  {status === 'error' && (
                    <p className="text-red-600 text-sm">Something went wrong. Please try again or email sean@apptivia.app directly.</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full py-3.5 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {status === 'sending' ? 'Submitting...' : (
                      <>Apply for Founding Pilot <ArrowRight size={16} /></>
                    )}
                  </button>

                  <p className="text-xs text-apptivia-carbon-400 text-center">
                    No credit card required. We'll reach out within 48 hours.
                  </p>
                </form>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-apptivia-paper rounded-lg p-6 border border-apptivia-carbon-200">
                <h3 className="font-semibold text-apptivia-ink mb-4">Full Pro access includes</h3>
                <ul className="space-y-3">
                  {WHAT_YOU_GET.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-apptivia-carbon-700">
                      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-apptivia-paper rounded-lg p-6 border border-apptivia-carbon-200">
                <h3 className="font-semibold text-apptivia-ink mb-4">Ideal pilot fit</h3>
                <dl className="space-y-3">
                  {IDEAL_FIT.map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs font-medium text-apptivia-carbon-500 uppercase tracking-wide">{item.label}</dt>
                      <dd className="text-sm text-apptivia-ink mt-0.5">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-apptivia-ink text-apptivia-carbon-400 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity size={20} className="text-apptivia-coral" />
            <span className="text-white font-semibold">Apptivia</span>
          </div>
          <p className="mb-4">Sales performance intelligence for teams that want to win.</p>
          <div className="flex justify-center gap-6 text-xs">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="/security" className="hover:text-white transition-colors">Security</a>
          </div>
          <p className="mt-6 text-xs text-apptivia-carbon-600">&copy; 2026 Apptivia. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
