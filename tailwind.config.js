/**
 * Apptivia — Tailwind Configuration v1.0
 * ============================================================
 *
 * Drop-in replacement for the legacy Tailwind config.
 * Sources every value from `apptivia_design_tokens.md` v1.0.
 *
 * INSTALLATION:
 *   1. Replace the existing tailwind.config.js with this file.
 *   2. Install Geist fonts (see "Font Setup" section below).
 *   3. Run global find/replace per the Migration Cheatsheet
 *      in apptivia_design_tokens.md §9.
 *   4. npm run build (or your equivalent) to verify compile.
 *   5. Visual review per page; fix outliers.
 *
 * FONT SETUP:
 *   Add to your main HTML <head> or import in your global CSS:
 *
 *   <link rel="preconnect" href="https://fonts.googleapis.com">
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 *   <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;900&family=Geist+Mono:wght@400;500;700&display=swap" rel="stylesheet">
 *
 *   Or via npm: npm install @vercel/geist (then import in main entry).
 *
 * WHAT THIS REPLACES:
 *   - All indigo/purple/blue color usage → apptivia-ink + apptivia-coral
 *   - All gray/slate/zinc neutrals → apptivia-carbon scale
 *   - All large border radii → modest scale capped at 8px
 *   - All transition durations >300ms → snappy 100/150/200/300ms
 *
 * COMPANION FILES:
 *   - apptivia_brand_foundation.md (v1.1)
 *   - apptivia_logo_system_v1.html
 *   - apptivia_design_tokens.md (the spec this file implements)
 *   - apptivia_design_tokens_preview.html (Step 3c - visual showcase)
 *
 * ============================================================
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  // ============================================================
  // THEME — Clean replacement, not extension
  // ============================================================
  theme: {
    // -----------------------------------------------------
    // Color tokens — apptivia_design_tokens.md §1
    // -----------------------------------------------------
    colors: {
      // Tailwind primitives (kept for utility, not brand use)
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#FFFFFF',
      black: '#000000',

      // ===== APPTIVIA BRAND CORE =====
      'apptivia-ink':    '#0A0A0B', // Carbon — foundation
      'apptivia-coral':  '#FF4D2E', // The signal color
      'apptivia-paper':  '#F7F5F2', // Off-white neutral

      // ===== CARBON NEUTRAL SCALE =====
      'apptivia-carbon': {
        50:  '#FAFAFA',
        100: '#F4F4F5',
        200: '#E4E4E7',
        300: '#D4D4D8',
        400: '#A1A1AA',
        500: '#71717A',
        600: '#52525B',
        700: '#3F3F46',
        800: '#27272A',
        900: '#18181B',
        950: '#0A0A0B', // alias of apptivia-ink
      },

      // ===== CORAL SCALE (signal variants) =====
      'apptivia-coral-tone': {
        50:  '#FFF5F2',
        100: '#FFE2DA',
        300: '#FF8A6B',
        500: '#FF4D2E', // alias of apptivia-coral
        600: '#E8421F',
        700: '#C8341B', // intentional collapse with apptivia-error
        900: '#7A1F0F',
      },

      // ===== SEMANTIC =====
      'apptivia-success':    '#16A34A',
      'apptivia-success-bg': '#F0FDF4',
      'apptivia-warning':    '#F59E0B',
      'apptivia-warning-bg': '#FFFBEB',
      'apptivia-error':      '#C8341B',
      'apptivia-error-bg':   '#FEF2F2',

      // ===== SEMANTIC TAILWIND SCALES (preserved during migration) =====
      // These exist because they are used semantically (success/warning/
      // error contexts) and the migration spec explicitly says to KEEP
      // them. They are NOT brand colors and should not be referenced
      // for brand purposes — use apptivia-* tokens for that.
      red: {
        50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
        400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
        800: '#991B1B', 900: '#7F1D1D', 950: '#450A0A',
      },
      emerald: {
        50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
        400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
        800: '#065F46', 900: '#064E3B', 950: '#022C22',
      },
      green: {
        50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
        400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D',
        800: '#166534', 900: '#14532D', 950: '#052E16',
      },
      amber: {
        50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
        400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        800: '#92400E', 900: '#78350F', 950: '#451A03',
      },
      yellow: {
        50: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047',
        400: '#FACC15', 500: '#EAB308', 600: '#CA8A04', 700: '#A16207',
        800: '#854D0E', 900: '#713F12', 950: '#422006',
      },
      orange: {
        50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
        400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C',
        800: '#9A3412', 900: '#7C2D12', 950: '#431407',
      },
      cyan: {
        50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
        400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
        800: '#155E75', 900: '#164E63', 950: '#083344',
      },
      rose: {
        50: '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 300: '#FDA4AF',
        400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C',
        800: '#9F1239', 900: '#881337', 950: '#4C0519',
      },

      // ===== TAILWIND DEFAULT NEUTRAL ALIASES =====
      // (Maintained for migration safety only. New code should
      //  use apptivia-carbon scale directly. Will be removed
      //  60-90 days post-Planera-pilot.)
      gray:   { /* DEPRECATED — use apptivia-carbon */ },
      slate:  { /* DEPRECATED — use apptivia-carbon */ },
      zinc:   { /* DEPRECATED — use apptivia-carbon */ },
    },

    // -----------------------------------------------------
    // Typography — apptivia_design_tokens.md §2
    // -----------------------------------------------------
    fontFamily: {
      'display': ['Geist', 'system-ui', 'sans-serif'],
      'body':    ['Geist', 'system-ui', 'sans-serif'],
      'mono':    ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],

      // Aliases so default Tailwind classes still work
      sans:  ['Geist', 'system-ui', 'sans-serif'],
      serif: ['Geist', 'system-ui', 'sans-serif'], // Apptivia has no serif
    },

    fontWeight: {
      // Restricted set — banned: 100 (thin), 300 (light)
      normal:    '400',
      medium:    '500',
      semibold:  '600',
      bold:      '700',
      black:     '900',
    },

    fontSize: {
      // [size, { lineHeight, letterSpacing }]
      'apptivia-xs':   ['11px', { lineHeight: '1.4',  letterSpacing: '0.02em' }],
      'apptivia-sm':   ['13px', { lineHeight: '1.5',  letterSpacing: '0.01em' }],
      'apptivia-base': ['15px', { lineHeight: '1.55', letterSpacing: '0' }],
      'apptivia-lg':   ['17px', { lineHeight: '1.5',  letterSpacing: '-0.005em' }],
      'apptivia-xl':   ['20px', { lineHeight: '1.4',  letterSpacing: '-0.01em' }],
      'apptivia-2xl':  ['24px', { lineHeight: '1.3',  letterSpacing: '-0.02em' }],
      'apptivia-3xl':  ['30px', { lineHeight: '1.2',  letterSpacing: '-0.025em' }],
      'apptivia-4xl':  ['40px', { lineHeight: '1.1',  letterSpacing: '-0.03em' }],
      'apptivia-5xl':  ['56px', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
      'apptivia-6xl':  ['80px', { lineHeight: '1',    letterSpacing: '-0.04em' }],

      // Default Tailwind size aliases mapped to Apptivia scale
      xs:   ['11px', { lineHeight: '1.4',  letterSpacing: '0.02em' }],
      sm:   ['13px', { lineHeight: '1.5',  letterSpacing: '0.01em' }],
      base: ['15px', { lineHeight: '1.55', letterSpacing: '0' }],
      lg:   ['17px', { lineHeight: '1.5',  letterSpacing: '-0.005em' }],
      xl:   ['20px', { lineHeight: '1.4',  letterSpacing: '-0.01em' }],
      '2xl':['24px', { lineHeight: '1.3',  letterSpacing: '-0.02em' }],
      '3xl':['30px', { lineHeight: '1.2',  letterSpacing: '-0.025em' }],
      '4xl':['40px', { lineHeight: '1.1',  letterSpacing: '-0.03em' }],
      '5xl':['56px', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
      '6xl':['80px', { lineHeight: '1',    letterSpacing: '-0.04em' }],
    },

    // -----------------------------------------------------
    // Spacing — apptivia_design_tokens.md §3
    // -----------------------------------------------------
    spacing: {
      0:  '0',
      px: '1px',
      0.5: '2px',
      1:  '4px',
      1.5: '6px',
      2:  '8px',
      2.5: '10px',
      3:  '12px',
      3.5: '14px',
      4:  '16px',
      5:  '20px',
      6:  '24px',
      7:  '28px',
      8:  '32px',
      9:  '36px',
      10: '40px',
      11: '44px',
      12: '48px',
      14: '56px',
      16: '64px',
      20: '80px',
      24: '96px',
      28: '112px',
      32: '128px',
      36: '144px',
      40: '160px',
      44: '176px',
      48: '192px',
      52: '208px',
      56: '224px',
      60: '240px',
      64: '256px',
      72: '288px',
      80: '320px',
      96: '384px',
    },

    // -----------------------------------------------------
    // Border radius — apptivia_design_tokens.md §4
    // -----------------------------------------------------
    borderRadius: {
      none: '0',
      sm:   '2px',
      DEFAULT: '4px',
      md:   '4px',
      lg:   '8px',
      xl:   '12px',
      '2xl': '16px',
      full: '9999px',
    },

    // -----------------------------------------------------
    // Box shadow — apptivia_design_tokens.md §5
    // -----------------------------------------------------
    boxShadow: {
      none: 'none',
      sm:   '0 1px 2px 0 rgb(10 10 11 / 0.04)',
      DEFAULT: '0 4px 6px -1px rgb(10 10 11 / 0.06), 0 2px 4px -2px rgb(10 10 11 / 0.04)',
      md:   '0 4px 6px -1px rgb(10 10 11 / 0.06), 0 2px 4px -2px rgb(10 10 11 / 0.04)',
      lg:   '0 10px 15px -3px rgb(10 10 11 / 0.08), 0 4px 6px -4px rgb(10 10 11 / 0.04)',
      coral: '0 4px 14px 0 rgb(255 77 46 / 0.25)',
    },

    // -----------------------------------------------------
    // Motion — apptivia_design_tokens.md §6
    // -----------------------------------------------------
    transitionDuration: {
      DEFAULT: '150ms',
      0:    '0ms',
      75:   '75ms',
      100:  '100ms',
      150:  '150ms',
      200:  '200ms',
      300:  '300ms',
    },

    transitionTimingFunction: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear:  'linear',
      in:      'cubic-bezier(0.4, 0, 1, 1)',
      out:     'cubic-bezier(0, 0, 0.2, 1)',
      'in-out':'cubic-bezier(0.4, 0, 0.2, 1)',
    },

    // -----------------------------------------------------
    // Z-index — apptivia_design_tokens.md §7
    // -----------------------------------------------------
    zIndex: {
      auto: 'auto',
      0:  '0',
      10: '10',
      20: '20',
      30: '30',
      40: '40',
      50: '50',
      60: '60',
    },

    // -----------------------------------------------------
    // Extensions
    // -----------------------------------------------------
    extend: {},
  },

  // ============================================================
  // PLUGINS
  // ============================================================
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.apptivia-tabular': {
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': '"tnum"',
        },
        '.apptivia-nudge': {
          'background-color': '#FFF5F2',
          'border-left': '3px solid #FF4D2E',
          'padding': '16px',
          'border-radius': '0 2px 2px 0',
        },
        '.apptivia-nudge-dark': {
          'background-color': 'rgb(255 77 46 / 0.08)',
          'border-left': '3px solid #FF4D2E',
          'padding': '16px',
          'border-radius': '0 2px 2px 0',
        },
      })
    },
  ],

  // ============================================================
  // SAFELIST
  // ============================================================
  safelist: [
    'bg-apptivia-coral-tone-50',
    'bg-apptivia-coral-tone-100',
    'text-apptivia-coral-tone-600',
    'text-apptivia-coral-tone-700',
    'bg-apptivia-carbon-100',
    'bg-apptivia-carbon-800',
    'bg-apptivia-carbon-900',
    'text-apptivia-carbon-500',
    'text-apptivia-carbon-600',
    'text-apptivia-carbon-700',
    'border-apptivia-carbon-200',
    'border-apptivia-carbon-700',
  ],
}
