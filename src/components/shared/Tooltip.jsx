import React from 'react';

/**
 * Modern dark-pill tooltip that wraps any child element.
 * Pure CSS — no JS state, no timers.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Element that triggers the tooltip
 * @param {string} props.text - Tooltip text
 * @param {'top'|'bottom'|'left'|'right'} [props.position='top']
 * @param {string} [props.className] - Extra classes on the wrapper
 * @param {boolean} [props.wide] - Allow wider tooltip (max-w-[280px])
 */
export default function Tooltip({ children, text, position = 'top', className = '', wide = false }) {
  if (!text) return children;

  const pos = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  const arrow = {
    top:    'left-1/2 -translate-x-1/2 -bottom-1 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900',
    bottom: 'left-1/2 -translate-x-1/2 -top-1 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900',
    left:   'top-1/2 -translate-y-1/2 -right-1 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-gray-900',
    right:  'top-1/2 -translate-y-1/2 -left-1 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-gray-900',
  };

  return (
    <span className={`relative group/tip inline-flex ${className}`}>
      {children}
      <span
        className={`absolute z-50 ${pos[position] || pos.top} pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-300 ${wide ? 'max-w-[280px]' : 'max-w-[220px]'} w-max`}
        role="tooltip"
      >
        <span className="block text-[11px] leading-snug bg-gray-900 text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-normal">
          {text}
        </span>
        <span className={`absolute w-0 h-0 ${arrow[position] || arrow.top}`} />
      </span>
    </span>
  );
}
