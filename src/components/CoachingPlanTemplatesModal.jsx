import React, { useState, useEffect } from 'react';
import { X, Target, Calendar as CalendarIcon, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function CoachingPlanTemplatesModal({ isOpen, onClose, onTemplateSelect }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customData, setCustomData] = useState({
    name: '',
    duration_days: 7,
    date_range_start: '',
    date_range_end: ''
  });

  const fallbackTemplates = [
    {
      id: 'pipeline-acceleration',
      name: 'Pipeline Acceleration',
      description: 'Boost pipeline creation and velocity',
      icon: '🚀',
      category: 'pipeline',
      focus_kpis: ['pipeline_created', 'sourced_opps', 'stage2_opps', 'qualified_leads'],
      suggested_goals: ['Increase pipeline by 25% this period', 'Source 10+ new opportunities', 'Advance 5+ deals to stage 2'],
      suggested_actions: ['Block 2 hours daily for prospecting', 'Target 20 high-intent accounts', 'Qualify deals within 48 hours'],
      duration_days: 14
    },
    {
      id: 'activity-boost',
      name: 'Activity Boost',
      description: 'Increase daily outreach and engagement',
      icon: '⚡',
      category: 'activity',
      focus_kpis: ['call_connects', 'emails_sent', 'meetings', 'social_touches'],
      suggested_goals: ['Make 50+ calls this week', 'Send 100+ emails', 'Book 10+ meetings'],
      suggested_actions: ['Use peak call windows (8-10am, 4-6pm)', 'Personalize first line of all emails', 'Follow a 3-touch cadence'],
      duration_days: 7
    },
    {
      id: 'conversion-master',
      name: 'Conversion Excellence',
      description: 'Improve connect-to-meeting conversion',
      icon: '📈',
      category: 'quality',
      focus_kpis: ['meetings', 'call_connects', 'demos_completed', 'win_rate'],
      suggested_goals: ['Achieve 20%+ connect-to-meeting rate', 'Complete 5+ product demos', 'Close 3+ deals'],
      suggested_actions: ['End every call with a calendar ask', 'Use a structured discovery framework', 'Review win/loss weekly'],
      duration_days: 14
    }
  ];

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coaching_plan_templates')
        .select('*')
        .order('name');

      if (!error && data) {
        setTemplates(data);
      }
    } catch (e) {
      console.error('Error loading templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + template.duration_days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    setCustomData({
      name: template.name,
      duration_days: template.duration_days,
      date_range_start: startDate,
      date_range_end: endDate
    });
  };

  const handleDurationChange = (days) => {
    const startDate = customData.date_range_start || new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date(startDate).getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    setCustomData({
      ...customData,
      duration_days: days,
      date_range_start: startDate,
      date_range_end: endDate
    });
  };

  const handleStartDateChange = (date) => {
    const endDate = new Date(new Date(date).getTime() + customData.duration_days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    setCustomData({
      ...customData,
      date_range_start: date,
      date_range_end: endDate
    });
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) return;

    const planData = {
      template_id: selectedTemplate.id,
      name: customData.name,
      goals: selectedTemplate.suggested_goals || [],
      focus_kpis: selectedTemplate.focus_kpis || [],
      action_items: selectedTemplate.suggested_actions || [],
      success_metrics: [],
      notes: '',
      date_range_start: customData.date_range_start,
      date_range_end: customData.date_range_end,
      plan_type: 'auto',
      category: selectedTemplate.category
    };

    onTemplateSelect?.(planData);
    onClose();
    setSelectedTemplate(null);
  };

  const getCategoryColor = (category) => {
    const colors = {
      pipeline: 'bg-blue-50 border-blue-200 text-blue-700',
      activity: 'bg-green-50 border-green-200 text-green-700',
      quality: 'bg-purple-50 border-purple-200 text-purple-700',
      efficiency: 'bg-orange-50 border-orange-200 text-orange-700'
    };
    return colors[category] || 'bg-gray-50 border-gray-200 text-gray-700';
  };

  if (!isOpen) return null;

  const preferredTemplateIds = ['pipeline-acceleration', 'activity-boost', 'conversion-master'];
  const normalizedTemplates = templates.length > 0 ? templates : fallbackTemplates;
  const preferredTemplates = normalizedTemplates.filter((template) => preferredTemplateIds.includes(template.id));
  const visibleTemplates = preferredTemplates.length >= 3
    ? preferredTemplates
    : [
        ...preferredTemplates,
        ...normalizedTemplates.filter((template) => !preferredTemplateIds.includes(template.id)).slice(0, 3 - preferredTemplates.length)
      ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Coaching Plan Templates</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a template to create a focused coaching plan</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                      <p className="text-xs text-gray-500">{template.description}</p>
                    </div>
                  </div>

                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border mb-3 ${getCategoryColor(template.category)}`}>
                    {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarIcon size={14} />
                      <span>{template.duration_days} days</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Target size={14} />
                      <span>{template.focus_kpis?.length || 0} KPIs</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CheckCircle size={14} />
                      <span>{template.suggested_actions?.length || 0} Actions</span>
                    </div>
                  </div>

                  {selectedTemplate?.id === template.id && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="text-xs font-medium text-blue-700 mb-2">Focus KPIs:</div>
                      <div className="flex flex-wrap gap-1">
                        {template.focus_kpis?.slice(0, 3).map((kpi, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {kpi.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {template.focus_kpis?.length > 3 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            +{template.focus_kpis.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">Customize Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={customData.name}
                  onChange={(e) => setCustomData({ ...customData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter plan name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (days)
                </label>
                <select
                  value={customData.duration_days}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={7}>1 week (7 days)</option>
                  <option value={14}>2 weeks (14 days)</option>
                  <option value={21}>3 weeks (21 days)</option>
                  <option value={30}>1 month (30 days)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customData.date_range_start}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customData.date_range_end}
                  readOnly
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUseTemplate}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Use This Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
