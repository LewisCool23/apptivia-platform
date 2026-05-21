import { useEffect } from 'react';

/**
 * useModalBehavior — shared hook for all modals.
 * Locks body scroll when open + closes on Escape key.
 */
export function useModalBehavior(isOpen: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
}
