import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Clock, Star } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'apptivia_search_history_';
const MAX_HISTORY_ITEMS = 20;

/**
 * SearchWithHistory - A search input with autocomplete based on search history
 * 
 * @param {Object} props
 * @param {string} props.value - Current search value (controlled)
 * @param {function} props.onChange - Called when value changes
 * @param {function} props.onSearch - Called when user submits search (optional)
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.context - Unique context key for this search (e.g., 'contests', 'accounts')
 * @param {string} props.className - Additional container classes
 * @param {string} props.inputClassName - Additional input classes
 * @param {boolean} props.showIcon - Show search icon (default: true)
 * @param {boolean} props.showClear - Show clear button (default: true)
 * @param {string[]} props.suggestions - Additional static suggestions to show
 */
export default function SearchWithHistory({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  context = 'global',
  className = '',
  inputClassName = '',
  showIcon = true,
  showClear = true,
  suggestions: staticSuggestions = [],
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Get stored history
  const getHistory = () => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${context}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Save to history
  const saveToHistory = (query) => {
    if (!query || query.trim().length < 2) return;
    
    try {
      const history = getHistory();
      const trimmed = query.trim();
      
      // Remove if already exists (will add to top)
      const filtered = history.filter(h => h.query.toLowerCase() !== trimmed.toLowerCase());
      
      // Add to front
      const updated = [
        { query: trimmed, timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_HISTORY_ITEMS);
      
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${context}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save search history:', e);
    }
  };

  // Remove from history
  const removeFromHistory = (query) => {
    try {
      const history = getHistory();
      const filtered = history.filter(h => h.query !== query);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${context}`, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to remove from history:', e);
    }
  };

  // Clear all history for this context
  const clearHistory = () => {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${context}`);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  };

  // Combine history + static suggestions, filtered by current input
  const filteredSuggestions = useMemo(() => {
    const history = getHistory();
    const currentValue = (value || '').toLowerCase().trim();
    
    // History items that match
    const historyMatches = history
      .filter(h => currentValue === '' || h.query.toLowerCase().includes(currentValue))
      .map(h => ({ type: 'history', query: h.query, timestamp: h.timestamp }));
    
    // Static suggestions that match and aren't in history
    const staticMatches = staticSuggestions
      .filter(s => {
        const sLower = s.toLowerCase();
        return (currentValue === '' || sLower.includes(currentValue)) &&
               !historyMatches.some(h => h.query.toLowerCase() === sLower);
      })
      .map(s => ({ type: 'suggestion', query: s }));
    
    return [...historyMatches.slice(0, 8), ...staticMatches.slice(0, 4)];
  }, [value, context, staticSuggestions]);

  const showDropdown = isFocused && filteredSuggestions.length > 0;

  const handleSelect = (query) => {
    onChange(query);
    saveToHistory(query);
    setIsFocused(false);
    setSelectedIndex(-1);
    onSearch?.(query);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === 'Enter' && value) {
        saveToHistory(value);
        onSearch?.(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          handleSelect(filteredSuggestions[selectedIndex].query);
        } else if (value) {
          saveToHistory(value);
          onSearch?.(value);
          setIsFocused(false);
        }
        break;
      case 'Escape':
        setIsFocused(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setIsFocused(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format relative time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return '';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {showIcon && (
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full ${showIcon ? 'pl-9' : 'pl-3'} ${showClear && value ? 'pr-8' : 'pr-3'} py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputClassName}`}
          autoComplete="off"
        />
        {showClear && value && (
          <button
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 p-0.5"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto z-50"
        >
          {filteredSuggestions.map((item, idx) => (
            <button
              key={`${item.type}-${item.query}`}
              onClick={() => handleSelect(item.query)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                selectedIndex === idx ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' : 'text-apptivia-carbon-700 hover:bg-apptivia-paper'
              }`}
            >
              {item.type === 'history' ? (
                <Clock size={14} className="text-apptivia-carbon-400 flex-shrink-0" />
              ) : (
                <Star size={14} className="text-amber-400 flex-shrink-0" />
              )}
              <span className="flex-1 truncate">{item.query}</span>
              {item.type === 'history' && item.timestamp && (
                <span className="text-[10px] text-apptivia-carbon-400">{formatTime(item.timestamp)}</span>
              )}
              {item.type === 'history' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(item.query);
                  }}
                  className="p-0.5 text-apptivia-carbon-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  title="Remove from history"
                >
                  <X size={12} />
                </button>
              )}
            </button>
          ))}
          
          {getHistory().length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={() => {
                  clearHistory();
                  setIsFocused(false);
                }}
                className="text-[11px] text-apptivia-carbon-400 hover:text-red-500"
              >
                Clear search history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
