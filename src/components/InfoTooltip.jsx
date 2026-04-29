import React from 'react';
import { Info } from 'lucide-react';
import Tooltip from './shared/Tooltip';

/**
 * Info icon with a modern dark-pill tooltip on hover.
 *
 * @param {{
 *  text: string,
 *  className?: string,
 *  iconClassName?: string,
 *  onClick?: () => void,
 *  ariaLabel?: string,
 *  position?: 'top'|'bottom'|'left'|'right',
 *  wide?: boolean,
 * }} props
 */
export default function InfoTooltip({ text, className = '', iconClassName = '', onClick = undefined, ariaLabel = 'More info', position = 'right', wide = false }) {
  if (!text) return null;

  const Wrapper = onClick ? 'button' : 'span';
  const wrapperProps = onClick
    ? { type: 'button', onClick, 'aria-label': ariaLabel }
    : {};

  return (
    <Tooltip text={text} position={position} wide={wide}>
      <Wrapper
        {...wrapperProps}
        className={`inline-flex items-center ${className}`}
      >
        <Info size={14} className={`text-apptivia-carbon-400 hover:text-apptivia-carbon-600 cursor-help ${iconClassName}`} />
      </Wrapper>
    </Tooltip>
  );
}
