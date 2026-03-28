import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function SelfAssessmentForm({ review, onSubmit, saving }) {
  const [selfAssessment, setSelfAssessment] = useState(review.rep_self_assessment || '');
  const [accomplishments, setAccomplishments] = useState(review.rep_accomplishments?.length > 0 ? review.rep_accomplishments : [{ text: '' }]);
  const [challenges, setChallenges] = useState(review.rep_challenges?.length > 0 ? review.rep_challenges : [{ text: '' }]);
  const [goals, setGoals] = useState(review.rep_goals_next_period?.length > 0 ? review.rep_goals_next_period : [{ text: '' }]);
  const [comments, setComments] = useState(review.rep_comments || '');

  const addItem = (setter) => setter(prev => [...prev, { text: '' }]);
  const updateItem = (setter, idx, value) => setter(prev => prev.map((item, i) => i === idx ? { text: value } : item));
  const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    onSubmit({
      rep_self_assessment: selfAssessment,
      rep_accomplishments: accomplishments.filter(a => a.text.trim()),
      rep_challenges: challenges.filter(c => c.text.trim()),
      rep_goals_next_period: goals.filter(g => g.text.trim()),
      rep_comments: comments,
    });
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">Self-Assessment</h3>
        <p className="text-xs text-blue-700">Share your perspective on your performance during this review period. Be honest and specific.</p>
      </div>

      {/* Overall self-assessment */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Overall Self-Assessment</label>
        <textarea value={selfAssessment} onChange={e => setSelfAssessment(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" rows={4}
          placeholder="Describe your overall performance, growth, and contributions during this period..." />
      </div>

      {/* Accomplishments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700">Key Accomplishments</label>
          <button type="button" onClick={() => addItem(setAccomplishments)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
        </div>
        {accomplishments.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input value={item.text || ''} onChange={e => updateItem(setAccomplishments, idx, e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Describe an accomplishment..." />
            {accomplishments.length > 1 && (
              <button type="button" onClick={() => removeItem(setAccomplishments, idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>

      {/* Challenges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700">Challenges & Areas for Growth</label>
          <button type="button" onClick={() => addItem(setChallenges)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
        </div>
        {challenges.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input value={item.text || ''} onChange={e => updateItem(setChallenges, idx, e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Describe a challenge or growth area..." />
            {challenges.length > 1 && (
              <button type="button" onClick={() => removeItem(setChallenges, idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>

      {/* Goals for next period */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700">Goals for Next Period</label>
          <button type="button" onClick={() => addItem(setGoals)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
        </div>
        {goals.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input value={item.text || ''} onChange={e => updateItem(setGoals, idx, e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Set a goal for the next review period..." />
            {goals.length > 1 && (
              <button type="button" onClick={() => removeItem(setGoals, idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>

      {/* Additional comments */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Additional Comments</label>
        <textarea value={comments} onChange={e => setComments(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" rows={3}
          placeholder="Any additional thoughts, feedback, or requests..." />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={saving || !selfAssessment.trim()}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Submitting...' : 'Submit Self-Assessment'}
        </button>
      </div>
    </div>
  );
}
