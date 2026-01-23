import React from 'react';

// AaronChatbot — floating chat panel with header, welcome bubble, and input
const AaronChatbot = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="w-80 bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold">A</div>
            <div>
              <div className="font-semibold">Aaron AI Coach</div>
              <div className="text-xs text-blue-100">How can I help you today?</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white opacity-90 hover:opacity-100">✕</button>
        </div>
        <div className="p-4 bg-white">
          <div className="bg-gray-100 rounded-md p-3 text-gray-700 text-sm mb-4">
            Hi! I'm Aaron, your AI productivity coach. How can I help you improve your performance today?
          </div>
          <div className="h-36 overflow-auto rounded-md border border-gray-100 bg-white p-2 text-gray-500 text-sm">
            {/* Chat messages would go here. For now keep empty placeholder. */}
          </div>
        </div>
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input aria-label="Ask Aaron for help" placeholder="Ask Aaron for help..." className="flex-1 px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none" />
            <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AaronChatbot;
