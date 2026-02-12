import React, { useState, useEffect } from 'react';
import { X, Search, Filter } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ViewAllBadgesModal({ isOpen, onClose, userId, refreshKey = 0 }) {
  const [allBadges, setAllBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'earned', 'locked'

  useEffect(() => {
    if (isOpen) {
      loadBadges();
    }
  }, [isOpen, userId, refreshKey]);

  const normalizeBadge = (badge) => ({
    id: badge.id || badge.badge_id || `badge-${badge.badge_name || badge.name}`,
    badge_name: badge.badge_name || badge.name || 'Unnamed Badge',
    badge_description: badge.badge_description || badge.description || '',
    icon: badge.icon || '🏆',
    color: badge.color || '#3B82F6',
    category: badge.category || badge.badge_type || badge.type || 'custom',
    rarity: badge.rarity || (badge.is_rare ? 'rare' : 'common'),
    badge_type: badge.badge_type || badge.type || 'custom',
    requirements: badge.requirements || null,
    points: badge.points
  });

  const loadBadges = async () => {
    setLoading(true);
    try {
      let badges = [];
      let definitionsError;
      let definitions = [];

      ({ data: definitions, error: definitionsError } = await supabase
        .from('badge_definitions')
        .select('*')
        .order('category', { ascending: true })
        .order('rarity', { ascending: true }));

      if (definitionsError) {
        ({ data: definitions, error: definitionsError } = await supabase
          .from('badge_definitions')
          .select('*'));
      }

      if (!definitionsError && definitions?.length) {
        badges = definitions;
      }

      if (definitionsError || !badges.length) {
        const { data: legacyBadges, error: legacyError } = await supabase
          .from('badges')
          .select('id, name, description, icon, color, category, rarity, points, type, is_rare')
          .order('name', { ascending: true });

        if (legacyError && definitionsError) {
          throw definitionsError;
        }

        if (legacyBadges?.length) {
          badges = legacyBadges.map(normalizeBadge);
        }
      }

      // Load user's earned badges
      let earned = [];
      if (userId) {
        const { data: earnedData, error: earnedError } = await supabase
          .from('profile_badges')
          .select('badge_name, earned_at, badge_description, icon, color, badge_type')
          .eq('profile_id', userId);

        if (earnedError) throw earnedError;
        earned = earnedData || [];
      }

      setAllBadges((badges || []).map(normalizeBadge));
      setUserBadges(earned || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEarned = (badgeName) => {
    return userBadges.some(ub => ub.badge_name === badgeName);
  };

  const getEarnedDate = (badgeName) => {
    const earned = userBadges.find(ub => ub.badge_name === badgeName);
    return earned ? new Date(earned.earned_at).toLocaleDateString() : null;
  };

  // Filter badges based on search and filters
  const fallbackBadges = allBadges.length > 0
    ? []
    : userBadges.map((badge) => ({
        id: badge.id || `earned-${badge.badge_name}`,
        badge_name: badge.badge_name,
        badge_description: badge.badge_description,
        icon: badge.icon,
        color: badge.color,
        category: badge.category || badge.badge_type,
        rarity: badge.rarity,
        badge_type: badge.badge_type || 'custom',
        requirements: badge.requirements
      }));

  const badgesToShow = allBadges.length > 0 ? allBadges : fallbackBadges;
  const filteredBadges = badgesToShow.filter(badge => {
    const matchesSearch = badge.badge_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         badge.badge_description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || badge.category === typeFilter;
    const matchesRarity = rarityFilter === 'all' || badge.rarity === rarityFilter;
    const earned = isEarned(badge.badge_name);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'earned' && earned) ||
                         (statusFilter === 'locked' && !earned);
    
    return matchesSearch && matchesType && matchesRarity && matchesStatus;
  });

  // Get unique categories and rarities
  const categories = [...new Set(badgesToShow.map(b => b.category))].filter(Boolean);
  const rarities = [...new Set(badgesToShow.map(b => b.rarity))].filter(Boolean);

  const earnedCount = userBadges.length;
  const totalBadges = badgesToShow.length;
  const progressPercent = totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0;

  const getRarityColor = (rarity) => {
    switch (rarity?.toLowerCase()) {
      case 'legendary': return '#FFD700';  // Gold
      case 'epic': return '#9333ea';       // Purple
      case 'rare': return '#3b82f6';       // Blue
      case 'common': return '#6b7280';     // Gray
      default: return '#e5e7eb';
    }
  };

  const getRarityGlow = (rarity) => {
    switch (rarity?.toLowerCase()) {
      case 'legendary': return 'shadow-lg shadow-yellow-200';
      case 'epic': return 'shadow-lg shadow-purple-200';
      case 'rare': return 'shadow-md shadow-blue-200';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>🎖️</span>
              All Badges
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {earnedCount} of {totalBadges} badges earned ({progressPercent}%)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search badges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-600">STATUS:</span>
            </div>
            {['all', 'earned', 'locked'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs font-semibold text-gray-600">TYPE:</span>
            </div>
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                typeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setTypeFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  typeFilter === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs font-semibold text-gray-600">RARITY:</span>
            </div>
            <button
              onClick={() => setRarityFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                rarityFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {rarities.map(rarity => (
              <button
                key={rarity}
                onClick={() => setRarityFilter(rarity)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  rarityFilter === rarity
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* Badges Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading badges...</div>
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">No badges found</div>
              <p className="text-gray-500 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredBadges.map((badge) => {
                const earned = isEarned(badge.badge_name);
                const earnedDate = getEarnedDate(badge.badge_name);
                const rarityColor = getRarityColor(badge.rarity);
                const rarityGlow = getRarityGlow(badge.rarity);
                const isCustom = badge.badge_type === 'custom' || badge.badge_type === 'special';

                return (
                  <div
                    key={badge.id}
                    className={`rounded-lg p-4 text-center border-2 transition-all hover:scale-105 cursor-pointer ${
                      earned ? `bg-white ${rarityGlow}` : 'bg-gray-50 opacity-60'
                    }`}
                    style={{ borderColor: earned ? rarityColor : '#d1d5db' }}
                    title={badge.badge_description}
                  >
                    {isCustom && (
                      <div className="text-[10px] font-semibold text-indigo-600 mb-1">CUSTOM</div>
                    )}
                    {/* Rarity Badge */}
                    {badge.rarity && earned && (
                      <div className="text-xs font-bold mb-2" style={{ color: rarityColor }}>
                        {badge.rarity.toUpperCase()}
                      </div>
                    )}

                    {/* Badge Icon */}
                    <div className={`text-4xl mb-2 ${!earned ? 'grayscale' : ''}`}>
                      {badge.icon || '🏆'}
                    </div>

                    {/* Badge Name */}
                    <div className={`font-semibold text-sm ${earned ? 'text-gray-900' : 'text-gray-400'}`}>
                      {badge.badge_name}
                    </div>

                    {/* Badge Description */}
                    {badge.badge_description && (
                      <div className={`text-xs mt-1 line-clamp-2 ${earned ? 'text-gray-600' : 'text-gray-400'}`}>
                        {badge.badge_description}
                      </div>
                    )}

                    {/* Progress Bar for Multi-Tier Badges */}
                    {badge.requirements?.tiers && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: earned ? '100%' : '30%',
                              backgroundColor: rarityColor
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="text-xs mt-2">
                      {earned ? (
                        <span className="text-green-600 font-medium">✓ Earned {earnedDate}</span>
                      ) : (
                        <span className="text-gray-400 font-medium">🔒 Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Showing:</span>
              <span className="font-semibold text-gray-900">{filteredBadges.length} badges</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Progress:</span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-semibold text-blue-600">{progressPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
