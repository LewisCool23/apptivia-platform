import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { Home, Trophy, Gamepad2, BarChart3, Settings, User, Menu, LogOut, X, Zap, Building2, ChevronDown, ChevronRight, Search, Radar, Monitor, Sparkles, Clock, FlaskConical } from 'lucide-react';
import NotificationPanel from './components/NotificationPanel';
import AaronChatbot from './AaronChatbot';
import SetupChecklist from './components/onboarding/SetupChecklist';
import { useBilling } from './hooks/useBilling';

const navigation = [
  { id: 'dashboard', name: 'Apptivia Scorecard', icon: Home, route: '/dashboard', description: 'Performance dashboard' },
  { id: 'coach', name: 'Apptivia Coach', icon: Trophy, route: '/coach', description: 'Skill development' },
  { id: 'engage', name: 'Apptivia Engage', icon: Radar, route: '/engage', description: 'AI prospecting' },
  { id: 'wallboard', name: 'Wallboard', icon: Monitor, route: '/wallboard', description: 'TV leaderboard display' },
  { id: 'contests', name: 'Contests', icon: Gamepad2, route: '/contests', description: 'Sales competitions' },
  { id: 'analytics', name: 'Analytics', icon: BarChart3, route: '/analytics', description: 'Advanced insights' },
  { 
    id: 'systems', 
    name: 'Systems', 
    icon: Settings, 
    route: '/systems', 
    description: 'Platform management',
    subItems: [
      { id: 'integrations', name: 'Integrations', icon: Zap, route: '/integrations', description: 'Connect CRM systems' },
      { id: 'organization', name: 'Organization', icon: Building2, route: '/organization-settings', description: 'Manage settings' },
      { id: 'permissions-teams', name: 'Permissions', icon: Settings, route: '/permissions-teams', description: 'Manage access' }
    ]
  },
  { id: 'pilot', name: 'Pilot Dashboard', icon: FlaskConical, route: '/admin/pilot', description: 'Pilot validation', adminOnly: true },
  { id: 'profile', name: 'Profile', icon: User, route: '/profile', description: 'Personal settings' }
];

function TrialBanner({ billing }) {
  const navigate = useNavigate();
  const { status, trialEndsAt, plan, startCheckout, loading } = billing;
  if (loading) return null;

  // Active trial
  if (status === 'trialing' && trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000));
    return (
      <div className="bg-apptivia-ink text-white px-4 py-2 text-sm flex items-center justify-center gap-3">
        <Clock size={14} />
        <span><strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> left in your Pro trial</span>
        <button
          onClick={() => navigate('/organization-settings')}
          className="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded text-xs font-semibold transition-colors"
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  // Expired trial
  if (status === 'expired' || (plan === 'Basic' && status !== 'active')) {
    const handleContinueStarter = async () => {
      try {
        await supabase.from('organizations').update({ subscription_status: 'active' })
          .eq('id', (await supabase.from('profiles').select('organization_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()).data?.organization_id);
        window.location.reload();
      } catch (e) { console.error(e); }
    };
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-sm flex items-center justify-center gap-3">
        <span>Your Pro trial has ended. Upgrade to unlock Engage, Contests, Coaching Plans, and more.</span>
        <button
          onClick={() => navigate('/organization-settings')}
          className="bg-apptivia-coral hover:bg-apptivia-coral text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
        >
          Upgrade to Pro
        </button>
        <button
          onClick={handleContinueStarter}
          className="text-amber-700 hover:text-amber-900 underline text-xs"
        >
          Continue with Starter
        </button>
      </div>
    );
  }

  return null;
}

function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const billing = useBilling();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('apptivia.sidebarOpen');
        if (stored !== null) return stored === 'true';
      }
    } catch (e) {}
    return true;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  
  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) { setProfile(null); return; }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!error) setProfile(data);
    }
    fetchProfile();
  }, [user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('apptivia.sidebarOpen', String(sidebarOpen));
      }
    } catch (e) {}
  }, [sidebarOpen]);

  // Search functionality (org-scoped)
  const handleSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);
    const results = [];
    const searchOrgId = profile?.organization_id;

    try {
      const searchTerm = query.trim().toLowerCase();

      // Search profiles/users (org-scoped)
      let profilesSearch = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (searchOrgId) profilesSearch = profilesSearch.eq('organization_id', searchOrgId);
      const { data: profiles } = await profilesSearch;

      if (profiles) {
        profiles.forEach(profile => {
          results.push({
            type: 'User',
            title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            subtitle: profile.role,
            link: `/profile?user=${profile.id}`,
            icon: '👤'
          });
        });
      }

      // Search achievements (global structural definitions)
      const { data: achievements } = await supabase
        .from('achievements')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (achievements) {
        achievements.forEach(achievement => {
          results.push({
            type: 'Achievement',
            title: achievement.name,
            subtitle: achievement.description,
            link: '/coach',
            icon: '🏆'
          });
        });
      }

      // Search badges (global structural definitions)
      const { data: badges } = await supabase
        .from('badge_definitions')
        .select('id, badge_name, badge_description')
        .ilike('badge_name', `%${searchTerm}%`)
        .limit(5);

      if (badges) {
        badges.forEach(badge => {
          results.push({
            type: 'Badge',
            title: badge.badge_name,
            subtitle: badge.badge_description,
            link: '/profile',
            icon: '🎖️'
          });
        });
      }

      // Search contests (org-scoped)
      let contestsQ = supabase
        .from('active_contests')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);
      if (searchOrgId) contestsQ = contestsQ.eq('organization_id', searchOrgId);
      const { data: contests } = await contestsQ;

      if (contests) {
        contests.forEach(contest => {
          results.push({
            type: 'Contest',
            title: contest.name,
            subtitle: contest.description,
            link: '/contests',
            icon: '🎯'
          });
        });
      }

      // Add navigation pages that match
      const navMatches = filteredNavigation.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
      );
      navMatches.forEach(item => {
        results.push({
          type: 'Page',
          title: item.name,
          subtitle: item.description,
          link: item.route,
          icon: '📄'
        });
      });

      // Engage tab deep links
      const engageTabs = [
        { name: 'Pipeline Operator', desc: 'Monitor deals, flag risks, AI forecasts', tab: 'pipeline', keywords: ['pipeline', 'deal', 'forecast', 'risk'] },
        { name: 'Signal Prospecting', desc: 'Detect high-intent buying signals', tab: 'signals', keywords: ['signal', 'intent', 'buying'] },
        { name: 'Discover', desc: 'AI-powered prospect & company research', tab: 'discover', keywords: ['discover', 'research', 'prospect', 'company'] },
        { name: 'Sequences', desc: 'Multi-step outreach cadences', tab: 'sequences', keywords: ['sequence', 'cadence', 'outreach'] },
        { name: 'Account Intelligence', desc: 'Account-based scoring & mapping', tab: 'accounts', keywords: ['account', 'scoring', 'buying committee', 'tier'] },
        { name: 'AI Playbooks', desc: 'AI-generated sales playbooks', tab: 'playbooks', keywords: ['playbook', 'play', 'sales play'] },
        { name: 'Prompt Library', desc: 'Outbound AI prompt templates', tab: 'prompts', keywords: ['prompt', 'template', 'library', 'outbound prompt', 'ai prompt'] },
      ];
      engageTabs.forEach(et => {
        if (et.name.toLowerCase().includes(searchTerm) || et.keywords.some(k => searchTerm.includes(k))) {
          results.push({
            type: 'Engage',
            title: `Engage → ${et.name}`,
            subtitle: et.desc,
            link: `/engage?tab=${et.tab}`,
            icon: '📡'
          });
        }
      });

      // Analytics deep links
      const analyticsTabs = [
        { name: 'KPI Watchdog', desc: 'Anomaly detection & coaching triggers', tab: 'watchdog', keywords: ['watchdog', 'anomaly', 'trigger', 'coaching'] },
      ];
      analyticsTabs.forEach(at => {
        if (at.name.toLowerCase().includes(searchTerm) || at.keywords.some(k => searchTerm.includes(k))) {
          results.push({
            type: 'Analytics',
            title: `Analytics → ${at.name}`,
            subtitle: at.desc,
            link: `/analytics`,
            icon: '📊'
          });
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Helpers for sidebar
  // Get first name from profile or fallback to user name/email
  const getProfileFirstName = () => {
    if (profile && typeof profile === 'object' && profile !== null && typeof profile.first_name === 'string' && profile.first_name.trim() !== '') {
      return profile.first_name;
    } else if (profile && typeof profile.name === 'string' && profile.name.trim() !== '') {
      // Fallback: split full name
      return profile.name.split(' ')[0];
    } else if (user?.name && user.name.trim() !== '') {
      return user.name.split(' ')[0];
    } else if (user?.email) {
      return user.email.split('@')[0];
    } else {
      return 'User';
    }
  };
  const getProfileInitials = () => {
    const name = getProfileFirstName();
    if (typeof name === 'string' && name.trim() !== '') {
      return name[0].toUpperCase();
    } else {
      return '?';
    }
  };

  // Determine active nav item
  const activeRoute = location.pathname;

  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  
  const navPermissions = {
    dashboard: 'view_dashboard',
    coach: 'view_coach',
    engage: 'view_engage',
    'coaching-plans': 'view_coach',
    wallboard: 'view_coach',
    contests: 'view_contests',
    analytics: 'view_analytics',
    integrations: 'view_systems',
    organization: 'view_systems',
    'permissions-teams': 'view_systems',
    systems: 'view_systems',
    profile: 'view_profile'
  };

  const toggleSubmenu = (itemId) => {
    setExpandedMenus(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && profile?.role !== 'admin') return false;
    const perm = navPermissions[item.id];
    if (perm && !hasPermission(perm)) return false;
    return true;
  }).map(item => {
    // Create a shallow copy to avoid mutating the module-level navigation constant
    if (item.subItems) {
      return { ...item, subItems: item.subItems.filter(subItem => hasPermission(navPermissions[subItem.id])) };
    }
    return item;
  });

  return (
    <div className="flex min-h-screen bg-apptivia-paper relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-40 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg transition-all duration-200 hover:scale-105"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <h1 className="font-bold text-lg text-apptivia-ink">Apptivia</h1>
        </div>
        <div className="w-8 h-8 bg-apptivia-coral rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xs">{getProfileInitials()}</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop and Mobile */}
      <div className={`
        ${sidebarOpen ? 'w-64' : 'w-16'}
        hidden lg:flex
        bg-white shadow-lg transition-all duration-300 flex-col fixed left-0 top-0 bottom-0 h-screen
      `}>
        <div className="px-3 py-2 border-b">
          <div className="relative flex items-center mb-2">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-apptivia-ink rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <div>
                  <h1 className="font-semibold text-xs text-apptivia-ink">Apptivia</h1>
                  <p className="text-[10px] text-apptivia-carbon-500">Sales Productivity Platform</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <div className="w-7 h-7 bg-apptivia-ink rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
              </button>
            )}
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded transition-all duration-200"
                title="Collapse sidebar"
              >
                <Menu size={16} />
              </button>
            )}
          </div>
          {/* User Info Section */}
          <div className="flex items-center gap-2 mt-1 mb-1">
            <div className="w-7 h-7 bg-apptivia-coral rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">{getProfileInitials()}</span>
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-semibold text-apptivia-ink leading-tight text-xs">Welcome, {getProfileFirstName()}</div>
                <div className="text-[10px] text-apptivia-carbon-500">{profile?.title || 'N/A'}</div>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavigation.map(item => (
              <div key={item.id}>
                {item.subItems ? (
                  // Parent item with submenu
                  <div>
                    <button
                      onClick={() => sidebarOpen ? toggleSubmenu(item.id) : navigate(item.route)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all duration-200 hover:scale-[1.02] ${
                        activeRoute === item.route
                          ? 'bg-apptivia-coral text-white shadow-md'
                          : 'text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'
                      }`}
                    >
                      <item.icon size={18} />
                      {sidebarOpen && (
                        <>
                          <div className="flex-1">
                            <div className="font-semibold text-xs">{item.name}</div>
                            <div className="text-[10px] opacity-75">{item.description}</div>
                          </div>
                          {expandedMenus[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </>
                      )}
                    </button>
                    {/* Submenu items */}
                    {sidebarOpen && expandedMenus[item.id] && (
                      <div className="ml-7 mt-0.5 space-y-0.5">
                        {item.subItems.map(subItem => (
                          <button
                            key={subItem.id}
                            onClick={() => navigate(subItem.route)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-left text-xs transition-all duration-200 hover:scale-[1.02] ${
                              activeRoute === subItem.route
                                ? 'bg-apptivia-coral-tone-50 text-apptivia-coral font-medium'
                                : 'text-apptivia-carbon-600 hover:bg-apptivia-paper'
                            }`}
                          >
                            <subItem.icon size={14} />
                            <span className="text-[11px]">{subItem.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Regular item without submenu
                  <button
                    onClick={() => navigate(item.route)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all duration-200 hover:scale-[1.02] ${
                      activeRoute === item.route
                        ? 'bg-apptivia-coral text-white shadow-md'
                        : 'text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'
                    }`}
                  >
                    <item.icon size={18} />
                    {sidebarOpen && (
                      <div>
                        <div className="font-semibold text-xs">{item.name}</div>
                        <div className="text-[10px] opacity-75">{item.description}</div>
                      </div>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>
        <div className="mt-auto px-3 py-2 border-t">
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 justify-center p-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium text-xs transition-all duration-200 hover:scale-[1.02]"
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={`
        lg:hidden fixed inset-y-0 left-0 w-64
        bg-white shadow-lg transition-transform duration-300 z-50
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col overflow-auto
      `}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="font-semibold text-sm text-apptivia-ink">Apptivia</h1>
                <p className="text-[11px] text-apptivia-carbon-500">Sales Productivity</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg transition-all duration-200 hover:scale-105"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          {/* User Info Section */}
          <div className="flex items-center gap-2 mt-2 mb-2">
            <div className="w-8 h-8 bg-apptivia-coral rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{getProfileInitials()}</span>
            </div>
            <div>
              <div className="font-semibold text-apptivia-ink leading-tight text-sm">Welcome, {getProfileFirstName()}</div>
              <div className="text-[11px] text-apptivia-carbon-500">{profile?.title || 'N/A'}</div>
            </div>
          </div>
        </div>
        {/* Search Bar for Mobile */}
        <div className="px-4 pb-3 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              type="text"
              placeholder="Search app..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {/* Mobile Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    navigate(result.link);
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-apptivia-paper border-b last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{result.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-apptivia-ink">{result.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-carbon-600">{result.type}</span>
                      </div>
                      {result.subtitle && (
                        <div className="text-[11px] text-apptivia-carbon-500 mt-0.5 truncate">{result.subtitle}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavigation.map(item => (
              <div key={item.id}>
                {item.subItems ? (
                  // Parent item with submenu
                  <div>
                    <button
                      onClick={() => toggleSubmenu(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                        activeRoute === item.route
                          ? 'bg-apptivia-coral text-white shadow-md'
                          : 'text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'
                      }`}
                    >
                      <item.icon size={22} />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{item.name}</div>
                        <div className="text-[11px] opacity-75">{item.description}</div>
                      </div>
                      {expandedMenus[item.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {/* Submenu items */}
                    {expandedMenus[item.id] && (
                      <div className="ml-9 mt-1 space-y-1">
                        {item.subItems.map(subItem => (
                          <button
                            key={subItem.id}
                            onClick={() => navigate(subItem.route)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                              activeRoute === subItem.route
                                ? 'bg-apptivia-coral-tone-50 text-apptivia-coral font-medium'
                                : 'text-apptivia-carbon-600 hover:bg-apptivia-paper'
                            }`}
                          >
                            <subItem.icon size={16} />
                            <span className="text-xs">{subItem.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Regular item without submenu
                  <button
                    onClick={() => navigate(item.route)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                      activeRoute === item.route
                        ? 'bg-apptivia-coral text-white shadow-md'
                        : 'text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'
                    }`}
                  >
                    <item.icon size={22} />
                    <div>
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className="text-[11px] opacity-75">{item.description}</div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>
        <div className="mt-auto p-4 border-t">
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 justify-center p-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
          >
            <LogOut size={22} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 lg:pt-0 pt-16 pb-24 text-sm min-w-0 overflow-x-hidden layout-root ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
      } transition-all duration-300`}>
        <TrialBanner billing={billing} />
        {children}
      </div>
      {/* Floating Setup Checklist — next to Aaron */}
      {profile && (
        <SetupChecklist
          organizationId={profile.organization_id}
          userRole={profile.role}
        />
      )}
      {/* AaronChatbot Floating Button and Modal */}
      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 sm:w-14 sm:h-14 bg-apptivia-coral text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-40 transition-all duration-300 hover:scale-110 group"
          aria-label="Open Aaron AI Coach"
        >
          <div className="relative">
            <span className="text-lg sm:text-xl font-bold">A</span>
            <Sparkles size={10} className="absolute -top-1 -right-2.5 text-yellow-300 opacity-90 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      )}
      <AaronChatbot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
      <NotificationPanel />
    </div>
  );
}

export default DashboardLayout;
