import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { Home, Trophy, Gamepad2, BarChart3, Settings, User, Menu, LogOut, X, Zap, Building2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import NotificationPanel from './components/NotificationPanel';

const navigation = [
  { id: 'dashboard', name: 'Apptivia Scorecard', icon: Home, route: '/dashboard', description: 'Performance dashboard' },
  { id: 'coach', name: 'Apptivia Coach', icon: Trophy, route: '/coach', description: 'Skill development' },
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
      { id: 'permissions-teams', name: 'Permissions & Teams', icon: Settings, route: '/permissions-teams', description: 'Manage access' }
    ]
  },
  { id: 'profile', name: 'Profile', icon: User, route: '/profile', description: 'Personal settings' }
];

function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
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

  // Search functionality
  const handleSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);
    const results = [];

    try {
      const searchTerm = query.trim().toLowerCase();

      // Search profiles/users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);

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

      // Search achievements
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

      // Search badges
      const { data: badges } = await supabase
        .from('badges')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (badges) {
        badges.forEach(badge => {
          results.push({
            type: 'Badge',
            title: badge.name,
            subtitle: badge.description,
            link: '/profile',
            icon: '🎖️'
          });
        });
      }

      // Search contests
      const { data: contests } = await supabase
        .from('contests')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

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
    'coaching-plans': 'view_coach',
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
    const hasMainPermission = hasPermission(navPermissions[item.id]);
    if (!hasMainPermission) return false;
    
    // If item has subItems, filter them too
    if (item.subItems) {
      item.subItems = item.subItems.filter(subItem => 
        hasPermission(navPermissions[subItem.id])
      );
    }
    return true;
  });

  return (
    <div className="flex min-h-screen bg-gray-50 relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-40 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <h1 className="font-bold text-lg text-gray-900">Apptivia</h1>
        </div>
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
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
        <div className="p-4 border-b">
          <div className="relative flex items-center mb-3">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h1 className="font-bold text-base text-gray-900">Apptivia</h1>
                  <p className="text-[11px] text-gray-500">Sales Productivity Platform</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-3"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
              </button>
            )}
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:bg-gray-100 rounded transition-all duration-200"
                title="Collapse sidebar"
              >
                <Menu size={16} />
              </button>
            )}
          </div>
          {/* User Info Section */}
          <div className="flex items-center gap-3 mt-2 mb-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{getProfileInitials()}</span>
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-medium text-gray-900 leading-tight text-xs">Welcome, {getProfileFirstName()}</div>
                <div className="text-[9px] text-gray-500">{profile?.title || 'N/A'}</div>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavigation.map(item => (
              <div key={item.id}>
                {item.subItems ? (
                  // Parent item with submenu
                  <div>
                    <button
                      onClick={() => sidebarOpen ? toggleSubmenu(item.id) : navigate(item.route)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                        activeRoute === item.route
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon size={20} />
                      {sidebarOpen && (
                        <>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-[11px] opacity-75">{item.description}</div>
                          </div>
                          {expandedMenus[item.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </>
                      )}
                    </button>
                    {/* Submenu items */}
                    {sidebarOpen && expandedMenus[item.id] && (
                      <div className="ml-9 mt-1 space-y-1">
                        {item.subItems.map(subItem => (
                          <button
                            key={subItem.id}
                            onClick={() => navigate(subItem.route)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                              activeRoute === subItem.route
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 hover:scale-[1.02] ${
                      activeRoute === item.route
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon size={20} />
                    {sidebarOpen && (
                      <div>
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-[11px] opacity-75">{item.description}</div>
                      </div>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>
        <div className="mt-auto p-4 border-t">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
          >
            <LogOut size={20} />
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
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="font-bold text-base text-gray-900">Apptivia</h1>
                <p className="text-[11px] text-gray-500">Sales Productivity</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          {/* User Info Section */}
          <div className="flex items-center gap-2 mt-2 mb-2">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">{getProfileInitials()}</span>
            </div>
            <div>
              <div className="font-medium text-gray-900 leading-tight text-xs">Welcome, {getProfileFirstName()}</div>
              <div className="text-[9px] text-gray-500">{profile?.title || 'N/A'}</div>
            </div>
          </div>
        </div>
        {/* Search Bar for Mobile */}
        <div className="px-4 pb-3 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search app..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {/* Mobile Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
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
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{result.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{result.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{result.type}</span>
                      </div>
                      {result.subtitle && (
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">{result.subtitle}</div>
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
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon size={20} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
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
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
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
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon size={20} />
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
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
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 justify-center p-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 lg:pt-0 pt-16 text-sm min-w-0 overflow-x-hidden layout-root ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
      } transition-all duration-300`}>
        {children}
      </div>
      {/* AaronChatbot Floating Button and Modal */}
      <button
        onClick={() => setChatbotOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center z-40 transition-all duration-300 hover:scale-110 hover:shadow-xl"
        aria-label="Open Aaron AI Coach"
      >
        <span className="text-2xl sm:text-3xl">🤖</span>
      </button>
      <AaronChatbot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
      <NotificationPanel />
    </div>
  );
}

import AaronChatbot from './AaronChatbot';
export default DashboardLayout;
