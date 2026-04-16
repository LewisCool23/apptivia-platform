import React from 'react';
import { X, FileSpreadsheet, FileText } from 'lucide-react';

/**
 * ExportReportModal — Prompts user to choose between CSV and PDF export formats.
 *
 * @param {object}   props
 * @param {boolean}  props.isOpen        - Whether the modal is visible
 * @param {Function} props.onClose       - Close handler
 * @param {Function} props.onSelectFormat - Called with 'csv' or 'pdf'
 * @param {string}   [props.title]       - Optional title override
 */
export default function ExportReportModal({ isOpen, onClose, onSelectFormat, title = 'Export Report' }) {
  if (!isOpen) return null;

  const options = [
    {
      key: 'csv',
      icon: FileSpreadsheet,
      label: 'CSV Spreadsheet',
      description: 'Raw data export for Excel or Google Sheets. Ideal for custom analysis.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200 hover:border-emerald-400',
    },
    {
      key: 'pdf',
      icon: FileText,
      label: 'PDF Report',
      description: 'Branded report with data tables and visuals. Ready to share with leadership.',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200 hover:border-blue-400',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-500 mb-4">Choose your export format:</p>
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onSelectFormat(opt.key);
                onClose();
              }}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${opt.border} hover:shadow-md`}
            >
              <div className={`p-2.5 rounded-lg ${opt.bg} shrink-0`}>
                <opt.icon size={22} className={opt.color} />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
