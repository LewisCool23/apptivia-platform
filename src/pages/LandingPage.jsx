import React, { useState } from 'react';
import { Activity, Trophy, CheckCircle, ArrowRight, Star, BarChart3, Brain, Target, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AskAIFooter from '../components/AskAIFooter';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

function DemoRequestModal({ isOpen, onClose, planHint }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', teamSize: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          message: planHint ? `[Interested in ${planHint}] ${form.message}`.trim() : form.message,
        }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95">
        <button onClick={onClose} className="absolute top-4 right-4 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-apptivia-ink mb-2">We'll be in touch!</h3>
            <p className="text-apptivia-carbon-600 mb-6">
              Thanks for your interest in Apptivia. We'll reach out within 24 hours to schedule your personalized demo.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral font-medium text-sm transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-apptivia-ink mb-1">Request a Demo</h3>
            <p className="text-apptivia-carbon-600 text-sm mb-6">
              See how Apptivia can transform your sales team's performance.
              {planHint && <span className="text-apptivia-coral font-medium"> ({planHint})</span>}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Sales Team Size</label>
                <select
                  value={form.teamSize}
                  onChange={(e) => setForm(f => ({ ...f, teamSize: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm text-apptivia-carbon-700"
                >
                  <option value="">Select team size</option>
                  <option value="1-10">1-10 reps</option>
                  <option value="11-25">11-25 reps</option>
                  <option value="26-50">26-50 reps</option>
                  <option value="51-100">51-100 reps</option>
                  <option value="100+">100+ reps</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Anything we should know?</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm resize-none"
                  placeholder="Current tools, pain points, goals..."
                />
              </div>

              {status === 'error' && (
                <p className="text-red-600 text-sm">Something went wrong. Please try again or email sean@apptivia.app directly.</p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-3 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoPlan, setDemoPlan] = useState('');

  const openDemo = (planHint = '') => {
    setDemoPlan(planHint);
    setDemoOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Demo Request Modal */}
      <DemoRequestModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} planHint={demoPlan} />

      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Activity size={32} className="text-apptivia-coral" />
              <span className="text-2xl font-bold text-apptivia-ink">Apptivia</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium">Platform</a>
              <a href="#features" className="text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium">Features</a>
              <a href="#pricing" className="text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium">Pricing</a>
              <a href="#how-it-works" className="text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium">How It Works</a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="px-4 py-2 text-apptivia-carbon-700 hover:text-apptivia-ink font-medium text-sm">
                Sign In
              </Link>
              <button onClick={() => openDemo()} className="text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium">
                Request a Demo
              </button>
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

      {/* Hero Section */}
      <section className="bg-apptivia-ink py-24 relative overflow-hidden">
        <div className="absolute inset-0 " />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-apptivia-coral/10 border border-apptivia-coral/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-apptivia-coral-tone-300 text-sm font-medium">Sales Performance Intelligence Platform</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your reps spend 70% of their day
              <span className="text-apptivia-coral"> not selling.</span>
              <br />We fix that.
            </h1>
            <p className="text-xl text-apptivia-coral-tone-300/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Apptivia turns fragmented sales data into scorecards, AI coaching, and signal-driven action — in one platform.
              We don't replace your CRM. We make the humans using it better.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/signup"
                className="px-8 py-3.5 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral font-semibold flex items-center gap-2 transition-colors"
              >
                Start Free Trial <ArrowRight size={18} />
              </Link>
              <button
                onClick={() => openDemo()}
                className="px-8 py-3.5 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 font-semibold transition-colors"
              >
                Request a Demo
              </button>
            </div>
          </div>

          {/* Problem Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-3xl mx-auto">
            {[
              { value: '70%', label: 'of rep time spent on non-selling activities' },
              { value: '57%', label: 'of sales reps miss quota annually' },
              { value: '$15B', label: 'spent on sales training with limited ROI' },
            ].map((stat, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-6 text-center backdrop-blur-sm">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-apptivia-coral-tone-300/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-apptivia-ink mb-4">Everything Your Sales Team Needs</h2>
            <p className="text-xl text-apptivia-carbon-600">
              One platform that replaces the spreadsheets, dashboards, and manual coaching
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: BarChart3,
                title: 'Real-Time Scorecard',
                description: 'Every rep gets a performance score updated weekly. Configurable KPI weighting, goal pacing, and anomaly detection built in.',
                color: 'text-apptivia-coral',
                bg: 'bg-apptivia-coral-tone-50',
              },
              {
                icon: Brain,
                title: 'Aaron AI Coach',
                description: '14 coaching frameworks, live KPI injection, Sales DNA methodology awareness. Not a generic chatbot — a domain-specific coaching engine.',
                color: 'text-apptivia-ink',
                bg: 'bg-apptivia-carbon-100',
              },
              {
                icon: Target,
                title: 'Signal Prospecting',
                description: '45 buying signals across 3 tiers identify high-intent accounts. AI drafts personalized outreach with human-in-the-loop approval.',
                color: 'text-apptivia-ink',
                bg: 'bg-apptivia-carbon-100',
              },
              {
                icon: Trophy,
                title: 'Contests & Gamification',
                description: 'Custom sales contests, real-time leaderboards, 2,200+ achievements, and 34 badge types. Gamification built into the core, not bolted on.',
                color: 'text-yellow-600',
                bg: 'bg-yellow-50',
              },
              {
                icon: Activity,
                title: 'CRM Integrations',
                description: 'Connect Salesforce, HubSpot, Apollo, Outreach, Gong and more. Automatic KPI tracking — no manual data entry.',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                icon: TrendingUp,
                title: 'Coaching Plans & IDPs',
                description: 'AI-generated coaching plans from live KPI data. Individual development plans with milestone tracking and performance reviews.',
                color: 'text-pink-600',
                bg: 'bg-pink-50',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white border border-apptivia-carbon-200 rounded-lg p-6 hover:shadow-lg hover:border-apptivia-carbon-300 transition-all">
                <div className={`${feature.bg} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon size={24} className={feature.color} />
                </div>
                <h3 className="text-lg font-semibold text-apptivia-ink mb-2">{feature.title}</h3>
                <p className="text-apptivia-carbon-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitive Framing */}
      <section className="py-20 bg-apptivia-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Above Your Stack, Not Beside It</h2>
            <p className="text-xl text-apptivia-coral-tone-300/70 max-w-2xl mx-auto">
              Apptivia doesn't compete with your tools. It makes the people using them measurably better.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { theirs: 'Gong records your calls', ours: 'Apptivia scores the rep who made the call' },
              { theirs: 'Apollo enriches your contacts', ours: 'Apptivia triggers outreach when signals align' },
              { theirs: 'Outreach sends your sequences', ours: 'Apptivia tells you which signal warranted the sequence' },
              { theirs: 'Salesforce stores your data', ours: 'Apptivia turns it into scores, coaching, and action' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-5 backdrop-blur-sm">
                <div className="text-sm text-apptivia-carbon-400 mb-2">{item.theirs}</div>
                <div className="text-white font-semibold flex items-start gap-2">
                  <ArrowRight size={16} className="text-apptivia-coral-tone-300 mt-0.5 flex-shrink-0" />
                  {item.ours}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-apptivia-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-apptivia-ink mb-4">Up and Running in 10 Minutes</h2>
            <p className="text-xl text-apptivia-carbon-600">No implementation consultants. No 6-month rollouts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { step: 1, title: 'Connect', description: 'Link your CRM. 10 integrations built — Salesforce, HubSpot, Apollo, and more.' },
              { step: 2, title: 'Score', description: 'Configure 5 KPIs in guided onboarding. Every rep gets a real-time performance score.' },
              { step: 3, title: 'Coach', description: 'Aaron AI identifies at-risk reps and delivers framework-specific coaching automatically.' },
              { step: 4, title: 'Compete', description: 'Contests, wallboards, and 2,200+ achievements create healthy competition.' },
              { step: 5, title: 'Prospect', description: 'Engage surfaces buying signals and drafts personalized outreach for your team.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-apptivia-coral text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-apptivia-ink mb-2">{item.title}</h3>
                <p className="text-apptivia-carbon-600 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-apptivia-ink mb-4">Built for Sales Teams That Want to Win</h2>
            <p className="text-xl text-apptivia-carbon-600">What sales leaders are saying about Apptivia</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "We went from spreadsheet chaos to real-time visibility in one afternoon. My reps actually check their scores now — they're competing with themselves.",
                author: 'Sarah Chen',
                title: 'VP of Sales, B2B SaaS (22 reps)',
                rating: 5,
              },
              {
                quote: "Aaron caught a performance dip in one of my top reps before I did. The coaching nudge fired, I had the 1-on-1, and we course-corrected in a week. That's the value.",
                author: 'Marcus Williams',
                title: 'Sales Director, Tech Services (35 reps)',
                rating: 5,
              },
              {
                quote: "The signal prospecting alone paid for the platform. My SDRs went from cold-blasting to reaching out when companies actually show buying intent.",
                author: 'Emily Rodriguez',
                title: 'Head of Sales Ops, Growth-Stage SaaS',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <div key={index} className="bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-apptivia-carbon-700 mb-4 text-sm leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-apptivia-ink text-sm">{testimonial.author}</div>
                  <div className="text-xs text-apptivia-carbon-500">{testimonial.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-apptivia-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-apptivia-ink mb-4">Simple Per-Seat Pricing</h2>
            <p className="text-xl text-apptivia-carbon-600">Pay for what you use. Scale as your team grows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '$19',
                unit: '/seat/mo',
                description: 'Visibility and engagement for your sales team',
                features: [
                  'Real-time Scorecard & KPI tracking',
                  'Wallboard with live leaderboards',
                  'Aaron AI coaching assistant',
                  'CRM integrations (Salesforce, HubSpot, etc.)',
                  'CSV data upload',
                  'Basic analytics & reporting',
                  'Email support',
                ],
              },
              {
                name: 'Pro',
                price: '$49',
                unit: '/seat/mo',
                description: 'Full platform with AI coaching and prospecting',
                features: [
                  'Everything in Starter',
                  'AI Coaching Plans & IDPs',
                  'Performance Reviews',
                  'Sales Contests & Achievements',
                  'Signal Prospecting (Engage)',
                  'Advanced analytics & export',
                  'Priority support',
                ],
                highlighted: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                unit: '',
                description: 'For organizations with advanced requirements',
                features: [
                  'Everything in Pro',
                  'SSO & audit logs',
                  'API access',
                  'Custom integrations',
                  'Org Health Scorecard',
                  'Dedicated success manager',
                  'SLA guarantee',
                ],
              },
            ].map((plan, index) => (
             <div
                key={index}
                className={`bg-white rounded-lg p-8 ${
                  plan.highlighted
                    ? 'border-2 border-apptivia-coral shadow-xl ring-1 ring-apptivia-coral-tone-100 scale-[1.02]'
                    : 'border border-apptivia-carbon-200 shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <div className="bg-apptivia-coral text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-apptivia-ink mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-apptivia-ink">{plan.price}</span>
                  {plan.unit && <span className="text-apptivia-carbon-500">{plan.unit}</span>}
                </div>
                <p className="text-apptivia-carbon-600 mb-6 text-sm">{plan.description}</p>
                <button
                  onClick={() => openDemo(plan.price === 'Custom' ? 'Enterprise Plan' : `${plan.name} Plan`)}
                  className={`block w-full py-3 rounded-lg font-medium mb-6 text-center text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-apptivia-coral text-white hover:bg-apptivia-coral'
                      : 'bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-200'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Request a Demo'}
                </button>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-apptivia-carbon-700">
                      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-apptivia-carbon-500">Per-seat pricing. No long-term contracts. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="get-started" className="py-20 bg-apptivia-ink relative overflow-hidden">
        <div className="absolute inset-0 " />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-4xl font-bold text-white mb-4">Your sales manager costs $10K/month.</h2>
          <p className="text-xl text-apptivia-coral-tone-300 mb-4">
            Apptivia gives every rep a personal AI coach, real-time scorecard, and prospecting intelligence.
          </p>
          <p className="text-lg text-apptivia-coral-tone-300/80 mb-8">Starting at $19/seat/month.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-3.5 bg-white text-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50 font-semibold transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              to="/pilot"
              className="px-8 py-3.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-semibold transition-colors"
            >
              Join Founding Pilot
            </Link>
            <button
              onClick={() => openDemo()}
              className="px-8 py-3.5 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 font-semibold transition-colors"
            >
              Request a Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-apptivia-ink text-apptivia-carbon-400 py-12">
        <AskAIFooter />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={24} className="text-apptivia-coral" />
                <span className="text-xl font-bold text-white">Apptivia</span>
              </div>
              <p className="text-sm leading-relaxed">Sales performance intelligence for teams that want to win.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Scorecard</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Aaron AI Coach</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Engage</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Contests</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="/public-integrations" className="hover:text-white transition-colors">Integrations</a></li>
                <li><Link to="/pilot" className="hover:text-white transition-colors">Founding Pilot</Link></li>
                <li><button onClick={() => openDemo()} className="hover:text-white transition-colors text-left">Contact</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/security" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-apptivia-carbon-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Apptivia. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
