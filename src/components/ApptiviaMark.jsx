/**
 * ApptiviaMark — icon-only variant of the Apptivia brand
 *
 * The square mark used wherever the full wordmark won't fit:
 * - Collapsed sidebar
 * - Favicons (eventually)
 * - App icons (eventually)
 *
 * Renders a dark square with Geist Black 'a' in paper.
 *
 * Props:
 * - className: additional Tailwind classes (default sets w-8 h-8)
 *
 * Usage:
 *   <ApptiviaMark />                              // default 32px square
 *   <ApptiviaMark className="w-12 h-12" />        // sized override
 *   <ApptiviaMark className="rounded-full" />     // shape override
 */
export function ApptiviaMark({ className = '' }) {
  return (
    <div
      className={`bg-apptivia-ink rounded-md flex items-center justify-center w-8 h-8 ${className}`}
      aria-label="Apptivia"
    >
      <span className="font-display font-black text-apptivia-paper leading-none">
        a
      </span>
    </div>
  );
}

export default ApptiviaMark;
