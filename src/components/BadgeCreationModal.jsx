import React, { useState } from 'react';
import { X, Award } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

export default function BadgeCreationModal({ isOpen, onClose, onBadgeCreated }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    badge_name: '',
    badge_description: '',
    badge_type: 'special',
    icon: '🏅',
    color: '#4F46E5',
    points: 50,
    is_rare: false,
    criteria_type: 'manual',
  });
  const [submitting, setSubmitting] = useState(false);

  const commonEmojis = ['🏅', '⭐', '🏆', '🎯', '💎', '👑', '🔥', '💪', '🎖️', '🌟', '✨', '🚀', '💯', '🎉', '🥇', '🥈', '🥉'];
  const badgeTypes = [
    { value: 'special', label: 'Special Recognition' },
    { value: 'achievement_milestone', label: 'Achievement Milestone' },
    { value: 'kpi_streak', label: 'KPI Streak' },
    { value: 'scorecard', label: 'Scorecard Excellence' },
    { value: 'custom', label: 'Custom' }
  ];

  const colorOptions = [
    { value: '#4F46E5', label: 'Indigo', preview: 'bg-indigo-600' },
    { value: '#FFD700', label: 'Gold', preview: 'bg-yellow-400' },
    { value: '#10B981', label: 'Green', preview: 'bg-green-500' },
    { value: '#EF4444', label: 'Red', preview: 'bg-red-500' },
    { value: '#8B5CF6', label: 'Purple', preview: 'bg-purple-600' },
    { value: '#EC4899', label: 'Pink', preview: 'bg-pink-500' },
    { value: '#F59E0B', label: 'Orange', preview: 'bg-orange-500' },
    { value: '#06B6D4', label: 'Cyan', preview: 'bg-cyan-500' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.badge_name.trim()) {
      toast.error('Badge name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        badge_name: formData.badge_name.trim(),
        badge_description: formData.badge_description.trim() || null,
        badge_type: formData.badge_type,
        icon: formData.icon,
        color: formData.color,
        points: parseInt(formData.points) || 0,
        is_rare: formData.is_rare,
        criteria_type: formData.criteria_type,
        criteria_value: null,
        category: formData.badge_type || 'custom',
        rarity: formData.is_rare ? 'rare' : 'common'
      };

      const { data, error } = await supabase
        .from('badge_definitions')
        .insert([payload])
        .select()
        .single();

      if (error) {
        const message = error.message || '';
        const missingTable = message.toLowerCase().includes('badge_definitions') && message.toLowerCase().includes('does not exist');
        if (!missingTable) throw error;

        const { data: legacyData, error: legacyError } = await supabase
          .from('badges')
          .insert([{
            name: payload.badge_name,
            description: payload.badge_description,
            icon: payload.icon,
            color: payload.color,
            points: payload.points
          }])
          .select()
          .single();

        if (legacyError) throw legacyError;
        if (onBadgeCreated) onBadgeCreated(legacyData);
        toast.success(`Badge "${formData.badge_name}" created successfully`);
        setFormData({
          badge_name: '',
          badge_description: '',
          badge_type: 'special',
          icon: '🏅',
          color: '#4F46E5',
          points: 50,
          is_rare: false,
          criteria_type: 'manual',
        });
        onClose();
        return;
      }

      toast.success(`Badge "${formData.badge_name}" created successfully`);
      
      // Reset form
      setFormData({
        badge_name: '',
        badge_description: '',
        badge_type: 'special',
        icon: '🏅',
        color: '#4F46E5',
        points: 50,
        is_rare: false,
        criteria_type: 'manual',
      });

      if (onBadgeCreated) onBadgeCreated(data);
      onClose();
    } catch (error) {
      console.error('Error creating badge:', error);
      toast.error(error.message || 'Failed to create badge');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Award className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Custom Badge</h2>
              <p className="text-sm text-gray-500">Design a unique badge for special recognition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Badge Preview */}
          <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-full text-4xl mb-3"
                style={{ backgroundColor: formData.color + '20' }}
              >
                {formData.icon}
              </div>
              <p className="font-semibold text-gray-900">{formData.badge_name || 'Badge Name'}</p>
              <p className="text-sm text-gray-500">{formData.badge_description || 'Badge description'}</p>
              <p className="text-xs text-indigo-600 font-medium mt-1">{formData.points} points</p>
            </div>
          </div>

          {/* Badge Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Badge Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.badge_name}
              onChange={(e) => setFormData({ ...formData, badge_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Sales Superstar"
              maxLength={100}
            />
          </div>

          {/* Badge Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.badge_description}
              onChange={(e) => setFormData({ ...formData, badge_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What makes this badge special?"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon
            </label>
            <div className="grid grid-cols-9 gap-2">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: emoji })}
                  className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                    formData.icon === emoji
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="p-3 text-2xl text-center rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                maxLength={2}
              />
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Badge Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    formData.color === color.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full ${color.preview}`}></div>
                  <span className="text-sm font-medium">{color.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Badge Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Badge Type
            </label>
            <select
              value={formData.badge_type}
              onChange={(e) => setFormData({ ...formData, badge_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {badgeTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points Value
            </label>
            <input
              type="number"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              min="0"
              step="10"
            />
            <p className="text-xs text-gray-500 mt-1">Points awarded when this badge is earned</p>
          </div>

          {/* Is Rare */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_rare"
              checked={formData.is_rare}
              onChange={(e) => setFormData({ ...formData, is_rare: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="is_rare" className="ml-2 text-sm text-gray-700">
              Mark as rare badge (highlights special accomplishments)
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
