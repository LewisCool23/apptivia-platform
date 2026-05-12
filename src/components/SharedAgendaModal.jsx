import React from 'react';
import { X, FileText } from 'lucide-react';
import ApptiviaLogo from './ApptiviaLogo';

export default function SharedAgendaModal({ isOpen, onClose, agendaText, managerName }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-apptivia-ink px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-apptivia-coral/20 flex items-center justify-center">
              <FileText size={16} className="text-apptivia-coral" />
            </div>
            <div>
              <h2 className="text-sm font-bold">1:1 Prep</h2>
              <p className="text-[11px] text-apptivia-coral-tone-300">
                {managerName ? `From ${managerName}` : 'Shared by your manager'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-apptivia-coral-tone-50/50 border border-apptivia-coral-tone-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-apptivia-coral mb-2 uppercase tracking-wide">Agenda</p>
            <div className="text-sm text-apptivia-carbon-700 leading-relaxed whitespace-pre-wrap">
              {agendaText}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-apptivia-carbon-100 flex items-center justify-between">
          <ApptiviaLogo className="text-xs" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-apptivia-coral text-white hover:bg-apptivia-coral/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
