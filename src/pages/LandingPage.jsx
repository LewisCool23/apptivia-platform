import React, { useState } from 'react';
import { Activity, Trophy, Users, Zap, CheckCircle, ArrowRight, Star, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [email, setEmail] = useState('');

  const handleGetStarted = (e) => {
    e.preventDefault();
    // In production, this would trigger a signup/demo request flow
    console.log('Get started with:', email);
    alert(`Thanks for your interest! We'll contact you at ${email} to set up your organization.`);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Activity size={32} className="text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">Apptivia</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900">About</a>
              <Link to="/login" className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </Link>
              <a
                href="#get-started"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Transform Your Sales Team with
              <span className="text-blue-600"> Gamification</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Drive performance, boost engagement, and celebrate wins with the #1 sales gamification platform.
              Connect your CRM, track KPIs, and watch your team thrive.
            </p>
            <form onSubmit={handleGetStarted} className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                Start Free Trial <ArrowRight size={18} />
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-3">No credit card required • 14-day free trial</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { value: '2,500+', label: 'Active Users' },
              { value: '47%', label: 'Performance Increase' },
              { value: '92%', label: 'Team Engagement' },
              { value: '4.9/5', label: 'Customer Rating' },
            ].map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need to Win</h2>
            <p className="text-xl text-gray-600">
              Powerful features designed to motivate your sales team and drive results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Trophy,
                title: 'Achievements & Badges',
                description: '100+ pre-built achievements across 10 sales skillsets. Automatic badge awards keep your team motivated.',
                color: 'text-yellow-600',
                bg: 'bg-yellow-50',
              },
              {
                icon: BarChart3,
                title: 'Real-Time Leaderboards',
                description: 'Dynamic scoreboards that update in real-time. Track individual and team performance at a glance.',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                icon: Zap,
                title: 'Instant Notifications',
                description: 'Celebrate wins immediately with real-time notifications for achievements, badges, and contest results.',
                color: 'text-purple-600',
                bg: 'bg-purple-50',
              },
              {
                icon: Users,
                title: 'Team Contests',
                description: 'Create custom sales contests with flexible KPIs. Run friendly competitions that drive results.',
                color: 'text-green-600',
                bg: 'bg-green-50',
              },
              {
                icon: Activity,
                title: 'CRM Integration',
                description: 'Seamlessly connect Salesforce, HubSpot, or upload CSV data. Automatic KPI tracking without manual entry.',
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
              },
              {
                icon: Star,
                title: 'Coaching Plans',
                description: 'AI-powered coaching recommendations and progress tracking to help your team level up their skills.',
                color: 'text-pink-600',
                bg: 'bg-pink-50',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className={`${feature.bg} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon size={24} className={feature.color} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Get Started in Minutes</h2>
            <p className="text-xl text-gray-600">Simple setup, powerful results</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Sign Up', description: 'Create your organization account in under 60 seconds' },
              { step: 2, title: 'Connect Data', description: 'Link your CRM or upload CSV files with your sales data' },
              { step: 3, title: 'Invite Team', description: 'Add your team members and assign them to teams' },
              { step: 4, title: 'Watch Magic', description: 'Achievements auto-unlock, leaderboards update, engagement soars' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Loved by Sales Teams</h2>
            <p className="text-xl text-gray-600">See what our customers are saying</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "Apptivia transformed our team's energy. Sales are up 40% and everyone is actually excited about hitting their numbers.",
                author: 'Sarah Chen',
                title: 'VP of Sales, TechCorp',
                rating: 5,
              },
              {
                quote: "The gamification features are brilliant. Our reps are competing for badges and it's driving real business results.",
                author: 'Mike Johnson',
                title: 'Sales Manager, CloudSoft',
                rating: 5,
              },
              {
                quote: "Setup took 10 minutes. The Salesforce integration works flawlessly. Best investment we've made this year.",
                author: 'Emily Rodriguez',
                title: 'Director of Sales Ops, DataFlow',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-600">{testimonial.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that fits your team</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '$49',
                description: 'Perfect for small teams',
                features: ['Up to 10 users', 'All core features', 'CSV upload', 'Email support', 'Basic analytics'],
              },
              {
                name: 'Pro',
                price: '$99',
                description: 'Most popular for growing teams',
                features: ['Up to 50 users', 'All Starter features', 'CRM integrations', 'Priority support', 'Advanced analytics', 'Custom contests'],
                highlighted: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                description: 'For large organizations',
                features: ['Unlimited users', 'All Pro features', 'Dedicated support', 'Custom integrations', 'Advanced security', 'SLA guarantee'],
              },
            ].map((plan, index) => (
             <div
                key={index}
                className={`bg-white rounded-xl p-8 ${
                  plan.highlighted
                    ? 'border-2 border-blue-600 shadow-lg scale-105'
                    : 'border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-gray-600">/month</span>}
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                <button
                  className={`w-full py-3 rounded-lg font-medium mb-6 ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                </button>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="get-started" className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Elevate Your Sales Team?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join 2,500+ sales professionals who use Apptivia to drive results and boost engagement.
          </p>
          <form onSubmit={handleGetStarted} className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="flex-1 px-4 py-3 rounded-lg focus:ring-2 focus:ring-white"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold"
            >
              Get Started Free
            </button>
          </form>
          <p className="text-sm text-blue-100 mt-3">14-day free trial • No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={24} className="text-blue-500" />
                <span className="text-xl font-bold text-white">Apptivia</span>
              </div>
              <p className="text-sm">Transforming sales teams through gamification and engagement.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Integrations</a></li>
                <li><a href="#" className="hover:text-white">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Apptivia Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
