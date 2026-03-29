import React, { useState } from 'react';
import { X, UserPlus, AlertTriangle } from 'lucide-react';

export default function AssignPlanModal({
  plan,
  teamMembers,
  selectedMembers,
  setSelectedMembers,
  onSave,
  onClose,
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Assign Plan</h3>
              <p className="text-sm text-gray-500">Select team members</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Member list */}
        <div className="p-4">
          {plan.visibility === 'team' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This plan was generated from team-wide data and may contain cross-rep performance details.
                Consider creating individual plans for each rep instead.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600 mb-4">
            Select team members to assign <strong>{plan.name}</strong>
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {teamMembers.filter(m => !['admin', 'manager', 'coach'].includes(m.role)).map(member => (
              <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMembers([...selectedMembers, member.id]);
                    } else {
                      setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                    }
                  }}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                  </div>
                  <div className="text-xs text-gray-500">{member.email}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedMembers.length === 0 || saving}
            className={`px-4 py-2 text-sm font-semibold rounded-md ${
              selectedMembers.length > 0 && !saving
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Assigning...' : `Assign to ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
