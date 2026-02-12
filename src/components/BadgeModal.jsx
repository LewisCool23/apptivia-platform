import React, { useState } from 'react';
import { X, Award, Calendar, Trophy, Target, Share2, Mail, Twitter, Linkedin, Copy, Check } from 'lucide-react';

export default function BadgeModal({ isOpen, onClose, badge, profileName }) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  
  if (!isOpen || !badge) return null;

  const badgeUrl = typeof window !== 'undefined' ? window.location.origin + '/profile#badges' : '';
  const shareText = `🏆 ${profileName || 'I'} just earned the "${badge.name}" badge on Apptivia!`;

  const handleShare = (platform) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(badgeUrl);
    
    switch(platform) {
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(`Badge Earned: ${badge.name}`)}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(`${shareText}\n${badgeUrl}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
        break;
    }
    setShowShareMenu(false);
  };

  // Badge graphics with gradients based on badge type/name
  const getBadgeGraphic = (badgeName) => {
    const name = badgeName?.toLowerCase() || '';
    
    if (name.includes('gold') || name.includes('platinum') || name.includes('elite')) {
      return (
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 rounded-full animate-pulse shadow-2xl"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-full flex items-center justify-center">
            <Award size={48} className="text-yellow-900" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center shadow-lg">
            <Trophy size={16} className="text-yellow-700" />
          </div>
        </div>
      );
    } else if (name.includes('silver') || name.includes('advanced')) {
      return (
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 rounded-full shadow-2xl"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-gray-200 to-gray-400 rounded-full flex items-center justify-center">
            <Award size={48} className="text-gray-700" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shadow-lg">
            <Trophy size={16} className="text-gray-600" />
          </div>
        </div>
      );
    } else if (name.includes('bronze') || name.includes('starter')) {
      return (
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 rounded-full shadow-2xl"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-orange-200 to-orange-500 rounded-full flex items-center justify-center">
            <Award size={48} className="text-orange-900" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-300 rounded-full flex items-center justify-center shadow-lg">
            <Trophy size={16} className="text-orange-700" />
          </div>
        </div>
      );
    } else if (name.includes('diamond') || name.includes('master')) {
      return (
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-500 rounded-full animate-pulse shadow-2xl"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-cyan-200 to-purple-400 rounded-full flex items-center justify-center">
            <Award size={48} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center shadow-lg">
            <Trophy size={16} className="text-white" />
          </div>
        </div>
      );
    } else {
      // Default blue badge
      return (
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-full shadow-2xl"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-blue-300 to-blue-500 rounded-full flex items-center justify-center">
            <Award size={48} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center shadow-lg">
            <Trophy size={16} className="text-white" />
          </div>
        </div>
      );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-6 relative">
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
              aria-label="Share badge"
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          {showShareMenu && (
            <div className="absolute top-16 right-4 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10 min-w-[160px]">
              <button
                onClick={() => handleShare('email')}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 text-sm"
              >
                <Mail size={16} />
                Email
              </button>
              <button
                onClick={() => handleShare('twitter')}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 text-sm"
              >
                <Twitter size={16} />
                Twitter
              </button>
              <button
                onClick={() => handleShare('linkedin')}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 text-sm"
              >
                <Linkedin size={16} />
                LinkedIn
              </button>
              <button
                onClick={() => handleShare('copy')}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 text-sm"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          )}
          
          {getBadgeGraphic(badge.name)}
          
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {badge.name}
          </h2>
          {profileName && (
            <p className="text-white/90 text-center text-sm">
              Earned by {profileName}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {badge.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-700 leading-relaxed">{badge.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {badge.category && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-blue-600" />
                  <div className="text-xs font-medium text-gray-500">Category</div>
                </div>
                <div className="text-sm font-semibold text-gray-900 capitalize">
                  {badge.category}
                </div>
              </div>
            )}

            {badge.points !== undefined && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={16} className="text-purple-600" />
                  <div className="text-xs font-medium text-gray-500">Points</div>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {badge.points}
                </div>
              </div>
            )}

            {badge.earned_date && (
              <div className="bg-green-50 rounded-lg p-3 col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-green-600" />
                  <div className="text-xs font-medium text-gray-500">Earned Date</div>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatDate(badge.earned_date)}
                </div>
              </div>
            )}
          </div>

          {badge.criteria && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                How to Earn
              </h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">{badge.criteria}</p>
              </div>
            </div>
          )}

          {badge.rarity && (
            <div className="text-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                badge.rarity === 'legendary' ? 'bg-purple-100 text-purple-700' :
                badge.rarity === 'epic' ? 'bg-orange-100 text-orange-700' :
                badge.rarity === 'rare' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)} Badge
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 hover:shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
