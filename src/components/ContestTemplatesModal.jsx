import React, { useState } from 'react';
import { X, Trophy, Target, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';

const CONTEST_TEMPLATES = [
  {
    id: 'revenue-race',
    name: 'Revenue Race',
    description: 'Competition based on total revenue generated',
    icon: '💰',
    kpi: 'revenue',
    duration: 7,
    reward_type: 'badge'
  },
  {
    id: 'call-champion',
    name: 'Call Champion',
    description: 'Who can make the most call connections',
    icon: '📞',
    kpi: 'call_connects',
    duration: 7,
    reward_type: 'badge'
  },
  {
    id: 'meeting-master',
    name: 'Meeting Master',
    description: 'Competition for most meetings scheduled',
    icon: '🤝',
    kpi: 'meetings',
    duration: 7,
    reward_type: 'badge'
  },
  {
    id: 'pipeline-builder',
    name: 'Pipeline Builder',
    description: 'Create the most pipeline value',
    icon: '🚀',
    kpi: 'pipeline_created',
    duration: 14,
    reward_type: 'badge'
  },
  {
    id: 'email-warrior',
    name: 'Email Warrior',
    description: 'Send the most emails in a week',
    icon: '✉️',
    kpi: 'emails_sent',
    duration: 7,
    reward_type: 'points'
  },
  {
    id: 'perfect-scorecard',
    name: 'Perfect Scorecard',
    description: 'Maintain 100% scorecard completion',
    icon: '⭐',
    kpi: 'scorecard_100_percent',
    duration: 7,
    reward_type: 'badge'
  }
];

export default function ContestTemplatesModal({ isOpen, onClose, onTemplateSelect }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [customData, setCustomData] = useState({
    name: '',
    duration: 7,
    start_date: '',
    reward_value: 100
  });

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
    setCustomData({
      name: template.name,
      duration: template.duration,
      start_date: new Date().toISOString().split('T')[0],
      reward_value: 100
    });
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate) return;

    const contestData = {
      name: customData.name,
      kpi: selectedTemplate.kpi,
      start_date: customData.start_date,
      end_date: new Date(new Date(customData.start_date).getTime() + customData.duration * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      reward_type: selectedTemplate.reward_type,
      reward_value: customData.reward_value,
      status: 'upcoming'
    };

    onTemplateSelect?.(contestData);
    onClose();
    setSelectedTemplate(null);
    setCustomizing(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contest Templates</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a template to quickly create a contest</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {CONTEST_TEMPLATES.map((template) => (
            <div
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate?.id === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-3xl">{template.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <CalendarIcon size={14} />
                <span>{template.duration} days</span>
                <span className="mx-1">•</span>
                <Trophy size={14} />
                <span className="capitalize">{template.reward_type}</span>
              </div>
            </div>
          ))}
        </div>

        {selectedTemplate && (
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Customize Contest</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contest Name
                </label>
                <input
                  type="text"
                  value={customData.name}
                  onChange={(e) => setCustomData({ ...customData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customData.start_date}
                  onChange={(e) => setCustomData({ ...customData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={customData.duration}
                  onChange={(e) => setCustomData({ ...customData, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reward Value (points)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customData.reward_value}
                  onChange={(e) => setCustomData({ ...customData, reward_value: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setCustomizing(false);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Back to Templates
              </button>
              <button
                onClick={handleUseTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
