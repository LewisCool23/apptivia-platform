/**
 * ApptiviaLogo — locked C-10c wordmark per apptivia_logo_system_v1
 *
 * The Apptivia brand logo. Pure typographic, weight + color split.
 * - "app" rendered in Geist Black (900) — foundation
 * - "tivia" rendered in Geist Medium (500) Coral — signal
 * - Letter-spacing -0.05em (tracking-tight in Tailwind)
 * - All lowercase, never uppercase
 *
 * Props:
 * - className: additional Tailwind classes (e.g., "text-3xl" for size)
 * - dark: render on dark background (paper "app", coral "tivia")
 *         vs light background (ink "app", coral "tivia"). Default: light
 *
 * Usage:
 *   <ApptiviaLogo className="text-3xl" />               // light surface
 *   <ApptiviaLogo className="text-3xl" dark />          // dark surface
 */
export function ApptiviaLogo({ className = '', dark = false }) {
  return (
    <span
      className={`inline-flex items-baseline font-display tracking-tight ${className}`}
    >
      <span
        className={`font-black ${dark ? 'text-apptivia-paper' : 'text-apptivia-ink'}`}
      >
        app
      </span>
      <span className="font-medium text-apptivia-coral">tivia</span>
    </span>
  );
}

export default ApptiviaLogo;
