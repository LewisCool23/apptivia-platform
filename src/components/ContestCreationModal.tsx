import React, { useState, useEffect } from 'react';
import RightFilterPanel from './RightFilterPanel';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ContestCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  contestToEdit?: any;
}

interface KPIOption {
  key: string;
  name: string;
  description: string;
}

const CONTEST_TEMPLATES = [
  {
    id: 'pipeline-sprint',
    name: 'Pipeline Sprint',
    description: 'Drive sourced pipeline and qualified opps in one week.',
    kpi_key: 'pipeline_created',
    calculation_type: 'sum',
    reward_type: 'gift_card',
    reward_value: '$100 Gift Card',
    participant_type: 'individual',
  },
  {
    id: 'meeting-blitz',
    name: 'Meeting Blitz',
    description: 'Reward top performers who book the most meetings.',
    kpi_key: 'meetings',
    calculation_type: 'sum',
    reward_type: 'bonus',
    reward_value: '$250 Bonus',
    participant_type: 'individual',
  },
  {
    id: 'connect-challenge',
    name: 'Connect Challenge',
    description: 'Boost live connects and conversations.',
    kpi_key: 'call_connects',
    calculation_type: 'sum',
    reward_type: 'prize',
    reward_value: 'Top Performer Prize',
    participant_type: 'individual',
  },
  {
    id: 'team-collab',
    name: 'Team Collaboration Cup',
    description: 'Team-based challenge focused on overall activity.',
    kpi_key: 'emails_sent',
    calculation_type: 'sum',
    reward_type: 'team_event',
    reward_value: 'Team Lunch',
    participant_type: 'team',
  },
];

export default function ContestCreationModal({ isOpen, onClose, currentUserId, contestToEdit }: ContestCreationModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [kpiOptions, setKpiOptions] = useState<KPIOption[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    kpi_key: '',
    calculation_type: 'sum',
    start_date: '',
    end_date: '',
    reward_type: 'gift_card',
    reward_value: '',
    reward_description: '',
    participant_type: 'individual',
  });

  useEffect(() => {
    if (isOpen) {
      fetchKPIs();
      
      if (contestToEdit) {
        // Editing existing contest
        setFormData({
          name: contestToEdit.name || '',
          description: contestToEdit.description || '',
          kpi_key: contestToEdit.kpi_key || '',
          calculation_type: contestToEdit.calculation_type || 'sum',
          start_date: contestToEdit.start_date?.split('T')[0] || '',
          end_date: contestToEdit.end_date?.split('T')[0] || '',
          reward_type: contestToEdit.reward_type || 'gift_card',
          reward_value: contestToEdit.reward_value || '',
          reward_description: contestToEdit.reward_description || '',
          participant_type: contestToEdit.participant_type || 'individual',
        });
      } else {
        // Creating new contest - Set default dates
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        setFormData({
          name: '',
          description: '',
          kpi_key: '',
          calculation_type: 'sum',
          start_date: today.toISOString().split('T')[0],
          end_date: nextWeek.toISOString().split('T')[0],
          reward_type: 'gift_card',
          reward_value: '',
          reward_description: '',
          participant_type: 'individual',
        });
      }
    }
  }, [isOpen, contestToEdit]);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('key, name, description')
        .order('name');

      if (error) throw error;
      setKpiOptions(data || []);
    } catch (err) {
      console.error('Error fetching KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.kpi_key || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      const loadingToast = toast.loading(contestToEdit ? 'Updating contest...' : 'Creating contest...');

      if (contestToEdit) {
        // Update existing contest
        const { error: updateError } = await supabase
          .from('active_contests')
          .update({
            name: formData.name,
            description: formData.description,
            kpi_key: formData.kpi_key,
            calculation_type: formData.calculation_type,
            status: new Date(formData.start_date) > new Date() ? 'upcoming' : 'active',
            start_date: formData.start_date,
            end_date: formData.end_date,
            reward_type: formData.reward_type,
            reward_value: formData.reward_value,
            reward_description: formData.reward_description,
            participant_type: formData.participant_type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contestToEdit.id);

        if (updateError) throw updateError;
        toast.dismiss(loadingToast);
        toast.success('Contest updated successfully!');
      } else {
        // Create new contest
        const { data: contest, error: contestError } = await supabase
          .from('active_contests')
          .insert({
            name: formData.name,
            description: formData.description,
            kpi_key: formData.kpi_key,
            calculation_type: formData.calculation_type,
            status: new Date(formData.start_date) > new Date() ? 'upcoming' : 'active',
            start_date: formData.start_date,
            end_date: formData.end_date,
            reward_type: formData.reward_type,
            reward_value: formData.reward_value,
            reward_description: formData.reward_description,
            participant_type: formData.participant_type,
            created_by: currentUserId,
          })
          .select()
          .single();

        if (contestError) throw contestError;

        // Auto-enroll all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, team_id');

        if (profilesError) throw profilesError;

        if (profiles && profiles.length > 0) {
          const participants = profiles.map((profile: any) => ({
            contest_id: contest.id,
            profile_id: profile.id,
            team_id: profile.team_id,
            is_active: true,
          }));

          const { error: participantsError } = await supabase
            .from('contest_participants')
            .insert(participants);

          if (participantsError) throw participantsError;
        }
        toast.dismiss(loadingToast);
        toast.success('Contest created successfully!');
      }

      setTimeout(() => {
        onClose();
        setMessage('');
      }, 1000);
    } catch (err) {
      console.error('Error saving contest:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save contest');
      setMessage(err instanceof Error ? err.message : 'Failed to save contest');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyTemplate = (templateId: string) => {
    const template = CONTEST_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      description: template.description,
      kpi_key: template.kpi_key,
      calculation_type: template.calculation_type,
      reward_type: template.reward_type,
      reward_value: template.reward_value,
      participant_type: template.participant_type,
    }));
  };

  if (!isOpen) return null;

  return (
    <RightFilterPanel
      isOpen={isOpen}
      onClose={onClose}
      title={contestToEdit ? 'Edit Contest' : 'Create Contest'}
      subtitle={contestToEdit ? 'Update contest details' : 'Launch a new competition'}
      panelClassName="w-[420px] max-w-[95vw]"
      contentClassName="pb-8"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900">{contestToEdit ? '✏️ Edit Contest' : '🏆 Create New Contest'}</div>
          <div className="text-xs text-blue-700 mt-1">
            {contestToEdit ? 'Update contest details' : 'Launch a new competition to motivate your team'}
          </div>
        </div>

        {!contestToEdit && (
          <div className="bg-white border rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">Templates</div>
            <div className="flex flex-wrap gap-2">
              {CONTEST_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  className="px-3 py-1.5 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        )}

          <div className="space-y-4">
            {/* Contest Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Contest Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Q1 Pipeline Challenge"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the contest"
                rows={2}
              />
            </div>

            {/* KPI Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                KPI to Track *
              </label>
              <select
                value={formData.kpi_key}
                onChange={(e) => updateField('kpi_key', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a KPI...</option>
                {kpiOptions.map(kpi => (
                  <option key={kpi.key} value={kpi.key}>
                    {kpi.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Calculation Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Calculation Method
              </label>
              <select
                value={formData.calculation_type}
                onChange={(e) => updateField('calculation_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sum">Total Sum</option>
                <option value="average">Average</option>
                <option value="max">Maximum Value</option>
                <option value="count">Count of Activities</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => updateField('start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => updateField('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Participant Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Participant Type
              </label>
              <select
                value={formData.participant_type}
                onChange={(e) => updateField('participant_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="individual">Individual Competition</option>
                <option value="team">Team Competition</option>
                <option value="department">Department Competition</option>
              </select>
            </div>

            {/* Reward Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Reward Type
              </label>
              <select
                value={formData.reward_type}
                onChange={(e) => updateField('reward_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gift_card">Gift Card</option>
                <option value="bonus">Cash Bonus</option>
                <option value="trophy">Trophy/Recognition</option>
                <option value="team_lunch">Team Lunch</option>
                <option value="pto">PTO Day</option>
                <option value="custom">Custom Reward</option>
              </select>
            </div>

            {/* Reward Value */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Reward Value
              </label>
              <input
                type="text"
                value={formData.reward_value}
                onChange={(e) => updateField('reward_value', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., $100, 1 Day PTO"
              />
            </div>

            {/* Reward Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Reward Description
              </label>
              <input
                type="text"
                value={formData.reward_description}
                onChange={(e) => updateField('reward_description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., $100 Amazon Gift Card"
              />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded ${
              message.includes('success') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm text-blue-800">
              <strong>Note:</strong> All active team members will be automatically enrolled in this contest. 
              Leaderboards will update in real-time based on KPI performance.
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 font-semibold"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded hover:from-blue-700 hover:to-purple-700 font-semibold disabled:opacity-50"
              disabled={saving || loading}
            >
              {saving ? (contestToEdit ? 'Updating...' : 'Creating...') : (contestToEdit ? 'Update Contest' : 'Create Contest')}
            </button>
          </div>
      </form>
    </RightFilterPanel>
  );
}
