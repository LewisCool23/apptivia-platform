import React from 'react';

export default function DisconnectConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-[95%] max-w-sm rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Disconnect Integration?</h3>
        <p className="text-sm text-gray-500 mb-4">
          This will revoke access tokens and stop syncing data. You can reconnect at any time.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border">Cancel</button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
