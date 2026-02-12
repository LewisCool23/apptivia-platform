import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

const SHOW_DELAY_MS = 2000;

/**
 * @param {{
 *  text: string,
 *  className?: string,
 *  iconClassName?: string,
 *  onClick?: () => void,
 *  ariaLabel?: string
 * }} props
 */
export default function InfoTooltip({ text, className = '', iconClassName = '', onClick = undefined, ariaLabel = 'More info' }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  if (!text) return null;

  const Wrapper = onClick ? 'button' : 'span';
  const wrapperProps = onClick
    ? { type: 'button', onClick, 'aria-label': ariaLabel }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Info size={14} className={`text-gray-400 hover:text-gray-600 ${iconClassName}`} />
      {open && (
        <span className="absolute z-50 -top-2 left-5 w-56 text-[11px] leading-snug bg-gray-900 text-white rounded-md px-2.5 py-2 shadow-lg">
          {text}
        </span>
      )}
    </Wrapper>
  );
}
