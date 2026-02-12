import React from 'react';

interface LeaderboardEntry {
  rank: number;
  previous_rank: number | null;
  score: number;
  profile_id: string;
  profile_name: string;
  team_name: string | null;
  rank_change: 'up' | 'down' | 'same' | 'new';
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestName: string;
  leaderboard: LeaderboardEntry[];
  currentUserId?: string;
  status?: 'active' | 'upcoming' | 'completed' | 'cancelled';
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  contestName,
  leaderboard,
  currentUserId,
  status = 'active'
}: LeaderboardModalProps) {
  if (!isOpen) return null;

  const getRankChangeIcon = (change: string) => {
    switch (change) {
      case 'up': return '⬆️';
      case 'down': return '⬇️';
      case 'new': return '🆕';
      default: return '';
    }
  };

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankTextClass = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-500 text-lg';
      case 2: return 'text-gray-400 text-lg';
      case 3: return 'text-orange-500 text-lg';
      default: return 'text-gray-600 text-sm';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🏆 Leaderboard
              </h2>
              <p className="text-sm text-gray-600 mt-1">{contestName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Leaderboard Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No participants yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.profile_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    entry.profile_id === currentUserId
                      ? 'bg-blue-50 border-2 border-blue-300 shadow-md'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`font-bold w-12 text-center ${getRankTextClass(entry.rank)}`}>
                      {getRankDisplay(entry.rank)}
                    </div>

                    {/* Profile Info */}
                    <div>
                      <div className="font-semibold text-base flex items-center gap-2">
                        {entry.profile_name}
                        {entry.rank_change !== 'same' && (
                          <span className="text-xs">{getRankChangeIcon(entry.rank_change)}</span>
                        )}
                        {entry.profile_id === currentUserId && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">You</span>
                        )}
                      </div>
                      {entry.team_name && (
                        <div className="text-sm text-gray-500">{entry.team_name}</div>
                      )}
                      {entry.previous_rank && entry.previous_rank !== entry.rank && (
                        <div className="text-xs text-gray-400">
                          Previous: #{entry.previous_rank}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-end">
                    <div className="font-bold text-xl text-blue-600">{entry.score}</div>
                    {entry.rank <= 3 && (
                      <div className="text-xs text-gray-500">
                        {entry.rank === 1 ? '1st Place' : entry.rank === 2 ? '2nd Place' : '3rd Place'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total Participants: {leaderboard.length}</span>
            <button
              onClick={onClose}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
