import React from 'react';
import { AlertTriangle, Loader2, Inbox } from 'lucide-react';

/**
 * Consistent empty state display used across pages.
 */
export function EmptyState({ icon: Icon = Inbox, title = 'No data', message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <Icon className="w-12 h-12 text-apptivia-carbon-300 mb-4" />
      <h3 className="text-lg font-semibold text-apptivia-carbon-600 mb-1">{title}</h3>
      {message && <p className="text-sm text-apptivia-carbon-400 max-w-md">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Consistent error state display.
 */
export function ErrorState({ message = 'Something went wrong', onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <AlertTriangle className="w-12 h-12 text-red-300 mb-4" />
      <h3 className="text-lg font-semibold text-red-600 mb-1">Error</h3>
      <p className="text-sm text-apptivia-carbon-500 max-w-md mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral/90 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Consistent loading spinner display.
 */
export function LoadingState({ message = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
      <Loader2 className="w-8 h-8 text-apptivia-coral animate-spin mb-3" />
      <p className="text-sm text-apptivia-carbon-500">{message}</p>
    </div>
  );
}
