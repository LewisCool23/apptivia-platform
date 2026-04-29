import React from 'react';
import { getRankChangeIcon, getRankDisplay } from '../utils/contestUtils';

interface LeaderboardEntry {
  rank: number;
  previous_rank: number | null;
  score: number;
  profile_id: string;
  profile_name: string;
  team_name: string | null;
  rank_change: 'up' | 'down' | 'same' | 'new';
}

interface ParticipantEntry {
  profile_id: string;
  profile_name: string;
  team_name: string | null;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestName: string;
  leaderboard: LeaderboardEntry[];
  participants?: ParticipantEntry[];
  currentUserId?: string;
  status?: 'active' | 'upcoming' | 'completed' | 'cancelled';
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  contestName,
  leaderboard,
  participants = [],
  currentUserId,
  status = 'active'
}: LeaderboardModalProps) {
  if (!isOpen) return null;

  // If leaderboard is empty but we have participants, show them with score 0
  const displayEntries: LeaderboardEntry[] = leaderboard.length > 0
    ? leaderboard
    : participants.map((p, idx) => ({
        rank: idx + 1,
        previous_rank: null,
        score: 0,
        profile_id: p.profile_id,
        profile_name: p.profile_name,
        team_name: p.team_name,
        rank_change: 'new' as const,
      }));

  const hasNoLeaderboardData = leaderboard.length === 0 && participants.length > 0;

  const getRankTextClass = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-500 text-lg';
      case 2: return 'text-apptivia-carbon-400 text-lg';
      case 3: return 'text-orange-500 text-lg';
      default: return 'text-apptivia-carbon-600 text-sm';
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
              <h2 className="text-2xl font-bold text-apptivia-ink flex items-center gap-2">
                🏆 Leaderboard
              </h2>
              <p className="text-sm text-apptivia-carbon-600 mt-1">{contestName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Leaderboard Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {hasNoLeaderboardData && (
            <div className="mb-4 p-3 bg-apptivia-coral-tone-50 border border-blue-200 rounded-lg text-sm text-apptivia-coral">
              Scores haven't been calculated yet. Showing enrolled participants — rankings will update as KPI data comes in.
            </div>
          )}
          {displayEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-apptivia-carbon-500">No participants yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayEntries.map((entry) => (
                <div
                  key={entry.profile_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    entry.profile_id === currentUserId
                      ? 'bg-apptivia-coral-tone-50 border-2 border-blue-300 shadow-md'
                      : 'bg-apptivia-paper hover:bg-apptivia-carbon-100'
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
                          <span className="text-xs bg-apptivia-coral text-white px-2 py-1 rounded">You</span>
                        )}
                      </div>
                      {entry.team_name && (
                        <div className="text-sm text-apptivia-carbon-500">{entry.team_name}</div>
                      )}
                      {entry.previous_rank && entry.previous_rank !== entry.rank && (
                        <div className="text-xs text-apptivia-carbon-400">
                          Previous: #{entry.previous_rank}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-end">
                    <div className="font-bold text-xl text-apptivia-coral">{typeof entry.score === 'number' ? entry.score.toLocaleString(undefined, { maximumFractionDigits: 1 }) : entry.score}</div>
                    {entry.rank <= 3 && (
                      <div className="text-xs text-apptivia-carbon-500">
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
        <div className="px-6 py-4 border-t border-gray-200 bg-apptivia-paper">
          <div className="flex items-center justify-between text-sm text-apptivia-carbon-600">
            <span>Total Participants: {displayEntries.length}</span>
            <button
              onClick={onClose}
              className="bg-apptivia-coral text-white px-6 py-2 rounded-lg font-semibold hover:bg-apptivia-coral transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
