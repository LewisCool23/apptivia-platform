import React, { useState, useEffect } from 'react';
import { X, Award, Users, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

export default function BadgeAssignmentModal({ isOpen, onClose, badge }) {
  const toast = useToast();
  const [profiles, setProfiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          department_id,
          departments (name),
          profile_badges!left (badge_id)
        `)
        .eq('is_active', true)
        .order('first_name');

      const { data, error } = await query;

      if (error) throw error;

      // Filter out profiles who already have this badge
      const filtered = (data || []).filter(profile => {
        const hasBadge = profile.profile_badges?.some(pb => pb.badge_id === badge?.id);
        return !hasBadge;
      });

      setProfiles(filtered);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProfile = (profileId) => {
    setSelectedProfiles(prev => {
      if (prev.includes(profileId)) {
        return prev.filter(id => id !== profileId);
      } else {
        return [...prev, profileId];
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredProfiles();
    if (selectedProfiles.length === filtered.length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(filtered.map(p => p.id));
    }
  };

  const handleAssignBadge = async () => {
    if (selectedProfiles.length === 0) {
      toast.error('Please select at least one person');
      return;
    }

    setSubmitting(true);
    try {
      // Create profile_badges records
      const records = selectedProfiles.map(profileId => ({
        profile_id: profileId,
        badge_id: badge.id,
        awarded_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('profile_badges')
        .insert(records);

      if (error) throw error;

      toast.success(`Badge assigned to ${selectedProfiles.length} ${selectedProfiles.length === 1 ? 'person' : 'people'}`);
      setSelectedProfiles([]);
      onClose();
    } catch (error) {
      console.error('Error assigning badge:', error);
      toast.error(error.message || 'Failed to assign badge');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredProfiles = () => {
    return profiles.filter(profile => {
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.toLowerCase();
      const email = (profile.email || '').toLowerCase();
      const matchesSearch = 
        fullName.includes(searchQuery.toLowerCase()) ||
        email.includes(searchQuery.toLowerCase());

      const matchesDepartment = 
        departmentFilter === 'all' || 
        profile.department_id === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  };

  if (!isOpen || !badge) return null;

  const filteredProfiles = getFilteredProfiles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg text-2xl"
              style={{ backgroundColor: badge.color + '20' }}
            >
              {badge.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assign Badge</h2>
              <p className="text-sm text-gray-500">{badge.badge_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 space-y-3">
          <div className="flex gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {selectedProfiles.length === filteredProfiles.length ? 'Deselect All' : 'Select All'}
            </button>
            <p className="text-sm text-gray-500">
              {selectedProfiles.length} selected · {filteredProfiles.length} available
            </p>
          </div>
        </div>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-600"></div>
              <p className="text-sm text-gray-500 mt-2">Loading profiles...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchQuery || departmentFilter !== 'all' 
                  ? 'No profiles match your filters'
                  : 'All eligible profiles already have this badge'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProfiles.map(profile => {
                const isSelected = selectedProfiles.includes(profile.id);
                const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';

                return (
                  <label
                    key={profile.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleProfile(profile.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{displayName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="truncate">{profile.email}</span>
                        {profile.departments?.name && (
                          <>
                            <span>·</span>
                            <span className="truncate">{profile.departments.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-600">
            {selectedProfiles.length > 0 && (
              <span className="font-medium text-indigo-600">
                {selectedProfiles.length} {selectedProfiles.length === 1 ? 'person' : 'people'} will receive this badge
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleAssignBadge}
              disabled={submitting || selectedProfiles.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              {submitting ? 'Assigning...' : `Assign Badge${selectedProfiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
