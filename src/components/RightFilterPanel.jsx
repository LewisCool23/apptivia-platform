import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

/**
 * @param {{
 *  isOpen: boolean;
 *  onClose: () => void;
 *  title?: string;
 *  subtitle?: string;
 *  children: React.ReactNode;
 *  panelClassName?: string;
 *  contentClassName?: string;
 *  showReset?: boolean;
 *  onReset?: (() => void) | null;
 *  resetLabel?: string;
 * }} props
 */
export default function RightFilterPanel({
  isOpen,
  onClose,
  title = 'Filters',
  subtitle = 'Refine results',
  children,
  panelClassName = '',
  contentClassName = '',
  showReset = false,
  onReset = null,
  resetLabel = 'Reset Filters',
}) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-[420px] max-w-[95vw] bg-white shadow-lg border-l z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${panelClassName}`}
        role="dialog"
        aria-label={title}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <SlidersHorizontal size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base text-gray-900">{title}</h2>
                <p className="text-[11px] text-gray-500">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showReset && (
                <button
                  type="button"
                  onClick={onReset}
                  disabled={!onReset}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                    onReset
                      ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {resetLabel}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className={`p-4 text-sm text-gray-700 overflow-y-auto h-[calc(100%-72px)] ${contentClassName}`}>
          {children}
        </div>
      </aside>
    </>
  );
}
