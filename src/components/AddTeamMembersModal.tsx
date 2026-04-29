import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, UserPlus, Users, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../AuthContext';
import { ROLES } from '../constants/roles';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  team_id: string | null;
  team_name: string | null;
  role: string | null;
}

interface AddTeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
  contestName: string;
  existingParticipantIds: string[];
  onMembersAdded: () => void;
}

export default function AddTeamMembersModal({
  isOpen,
  onClose,
  contestId,
  contestName,
  existingParticipantIds,
  onMembersAdded,
}: AddTeamMembersModalProps) {
  const toast = useToast();
  const { user, role } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMyTeamOnly, setShowMyTeamOnly] = useState(role === ROLES.MANAGER);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, team_id, role, team:teams(name)')
        .order('first_name');

      if (error) throw error;

      const mapped: Profile[] = (data || []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        team_id: p.team_id,
        team_name: p.team?.name || null,
        role: p.role,
      }));

      setProfiles(mapped);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    let list = profiles.filter((p) => !existingParticipantIds.includes(p.id));

    // For managers, default to showing their direct reports (same team)
    if (showMyTeamOnly && user) {
      const userId = (user as any).id;
      const userProfile = profiles.find((p) => p.id === userId);
      if (userProfile?.team_id) {
        list = list.filter((p) => p.team_id === userProfile.team_id);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.team_name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [profiles, existingParticipantIds, searchQuery, showMyTeamOnly, user]);

  const alreadyEnrolledCount = existingParticipantIds.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = filteredProfiles.map((p) => p.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const participants = Array.from(selectedIds).map((profileId) => {
        const profile = profiles.find((p) => p.id === profileId);
        return {
          contest_id: contestId,
          profile_id: profileId,
          team_id: profile?.team_id || null,
          is_active: true,
        };
      });

      const { error } = await supabase.from('contest_participants').upsert(participants, {
        onConflict: 'contest_id,profile_id',
      });

      if (error) throw error;

      toast.success(`Added ${selectedIds.size} member${selectedIds.size > 1 ? 's' : ''} to "${contestName}"`);
      onMembersAdded();
      onClose();
    } catch (err) {
      console.error('Error adding team members:', err);
      toast.error('Failed to add team members');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-apptivia-carbon-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-apptivia-ink flex items-center gap-2">
                <Users size={20} className="text-apptivia-coral" />
                Add Team Members
              </h2>
              <p className="text-xs text-apptivia-carbon-500 mt-0.5">{contestName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-5 py-3 border-b border-apptivia-carbon-100 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or team..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-apptivia-carbon-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showMyTeamOnly}
                onChange={(e) => setShowMyTeamOnly(e.target.checked)}
                className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral"
              />
              My direct reports only
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium"
              >
                Select all
              </button>
              <span className="text-apptivia-carbon-300">|</span>
              <button
                onClick={clearSelection}
                className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="text-xs text-apptivia-carbon-400">
            {alreadyEnrolledCount} already enrolled · {filteredProfiles.length} available · {selectedIds.size} selected
          </div>
        </div>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
          {loading ? (
            <div className="text-center py-8 text-apptivia-carbon-400 text-sm">Loading team members...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8 text-apptivia-carbon-400 text-sm">
              {searchQuery ? 'No matching members found' : 'All team members are already enrolled'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProfiles.map((profile) => {
                const isSelected = selectedIds.has(profile.id);
                const displayName =
                  `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
                return (
                  <button
                    key={profile.id}
                    onClick={() => toggleSelect(profile.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100'
                        : 'hover:bg-apptivia-paper border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-apptivia-coral text-white'
                          : 'border-2 border-apptivia-carbon-300'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-apptivia-ink truncate">{displayName}</div>
                      <div className="text-xs text-apptivia-carbon-500 truncate">
                        {profile.email}
                        {profile.team_name && ` · ${profile.team_name}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-apptivia-carbon-200 flex-shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-apptivia-carbon-700 bg-apptivia-carbon-100 rounded-lg hover:bg-apptivia-carbon-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || saving}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedIds.size > 0 && !saving
                ? 'bg-apptivia-coral text-white hover:bg-apptivia-coral'
                : 'bg-apptivia-carbon-200 text-apptivia-carbon-400 cursor-not-allowed'
            }`}
          >
            <UserPlus size={14} />
            {saving ? 'Adding...' : `Add ${selectedIds.size || ''} Member${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
