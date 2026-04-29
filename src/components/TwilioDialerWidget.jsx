import React from 'react';
import { PhoneOff, Mic, MicOff } from 'lucide-react';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TwilioDialerWidget({
  callStatus,
  activeContact,
  callDurationSeconds,
  isMuted,
  onHangUp,
  onToggleMute,
}) {
  if (callStatus === 'idle') return null;

  const statusLabel = {
    connecting:    'Connecting...',
    ringing:       'Ringing...',
    'in-call':     formatDuration(callDurationSeconds),
    disconnecting: 'Ending call...',
    error:         'Call failed',
  }[callStatus] ?? callStatus;

  const isLive = callStatus === 'in-call';
  const initial = (activeContact?.name?.[0] ?? '?').toUpperCase();

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-apptivia-ink text-white rounded-2xl shadow-2xl p-4 w-60 flex flex-col gap-3">
      {/* Contact info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {activeContact?.name ?? 'Unknown'}
          </p>
          {activeContact?.company_name && (
            <p className="text-xs text-apptivia-carbon-400 truncate">
              {activeContact.company_name}
            </p>
          )}
        </div>
      </div>

      {/* Status / timer */}
      <div
        className={`text-center text-sm font-mono font-medium ${
          isLive ? 'text-green-400' : 'text-apptivia-carbon-300'
        }`}
      >
        {statusLabel}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Mute */}
        <button
          onClick={onToggleMute}
          disabled={!isLive}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors
            ${isMuted
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-apptivia-carbon-700 hover:bg-apptivia-carbon-600'}
            disabled:opacity-40 disabled:cursor-not-allowed`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* Hang up */}
        <button
          onClick={onHangUp}
          className="w-13 h-13 w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg"
          title="End call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
