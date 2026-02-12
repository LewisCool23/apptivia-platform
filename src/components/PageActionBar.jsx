import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, 
  Download, 
  Settings, 
  Bell, 
  MoreVertical
} from 'lucide-react';

/**
 * Unified action bar component with consistent 5-icon layout and Actions dropdown
 * @param {object} props
 * @param {Function} props.onFilterClick - Filter button click handler
 * @param {Function} props.onConfigureClick - Configure button click handler
 * @param {Function} props.onExportClick - Export button click handler
 * @param {Function} props.onNotificationsClick - Notifications button click handler
 * @param {boolean} [props.exportDisabled] - Whether export is disabled
 * @param {boolean} [props.configureDisabled] - Whether configure is disabled
 * @param {number} [props.notificationBadge] - Notification badge count
 * @param {Array<{label: string, onClick: () => void, disabled?: boolean}>} props.actions - Actions dropdown items
 */
export default function PageActionBar({ 
  onFilterClick,
  onConfigureClick,
  onExportClick,
  onNotificationsClick,
  exportDisabled = false,
  configureDisabled = false,
  notificationBadge = 0,
  actions = []
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActionsOpen(false);
      }
    }
    
    if (actionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [actionsOpen]);

  const iconButton = (Icon, label, onClick, badge = 0, disabled = false) => (
    <div key={label} className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
        }`}
        aria-label={label}
      >
        <Icon size={18} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold">
            {badge}
          </span>
        )}
      </button>
      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex gap-2 items-center">
      {iconButton(Filter, 'Filters', onFilterClick)}
      {iconButton(Settings, 'Configure', onConfigureClick, 0, configureDisabled)}
      {iconButton(Download, 'Export', onExportClick, 0, exportDisabled)}
      {iconButton(Bell, 'Notifications', onNotificationsClick, notificationBadge)}
      
      {/* Actions Dropdown */}
      <div ref={dropdownRef} className="relative">
        <div className="relative group">
          <button
            onClick={() => setActionsOpen(!actionsOpen)}
            className={`relative p-2 rounded-lg font-semibold text-sm bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 hover:scale-105 hover:shadow-md ${
              actions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Actions"
            disabled={actions.length === 0}
          >
            <MoreVertical size={18} />
          </button>
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
            Actions
          </span>
        </div>

        {/* Dropdown Menu */}
        {actionsOpen && actions.length > 0 && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-fadeIn">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                    setActionsOpen(false);
                  }
                }}
                disabled={action.disabled}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  action.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
