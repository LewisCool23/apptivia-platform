import React from 'react';
import Tooltip from './Tooltip';

/**
 * Shared icon button with enforced aria-label for accessibility.
 *
 * @param {Object} props
 * @param {React.ElementType} props.icon - Lucide icon component
 * @param {string} props['aria-label'] - Required accessibility label
 * @param {string} [props.size='md'] - 'sm' | 'md' | 'lg'
 * @param {string} [props.variant='ghost'] - 'ghost' | 'outline' | 'solid'
 * @param {string} [props.className] - Additional classes
 */
export default function IconButton({
  icon: Icon,
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...rest
}) {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const variantClasses = {
    ghost: 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-600 hover:text-gray-800',
    solid: 'bg-blue-500 text-white hover:bg-blue-600',
  };

  return (
    <Tooltip text={ariaLabel}>
      <button
        type="button"
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...rest}
      >
        <Icon className={iconSizes[size]} />
      </button>
    </Tooltip>
  );
}
