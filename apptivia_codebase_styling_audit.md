# Apptivia Codebase Styling Audit

> Generated: April 28, 2026
> Purpose: Pre-migration audit of all colors, fonts, and visual styling across the Apptivia platform codebase.

---

## 1. Tailwind Config — Current State

**File:** `tailwind.config.js` (53 lines)

```js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        surface: { DEFAULT: '#ffffff', subtle: '#f8fafc', muted: '#f1f5f9' },
        border:  { DEFAULT: '#e2e8f0', muted: '#e5e7eb' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: { xs: '0.8125rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem' },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,0.06)',
        md: '0 4px 12px rgba(15,23,42,0.08)',
        lg: '0 12px 24px rgba(15,23,42,0.12)',
        card: '0 1px 2px rgba(15,23,42,0.05)',
      },
      borderRadius: { lg: '0.75rem', xl: '0.875rem', '2xl': '1rem' },
    },
  },
  plugins: [],
};
```

### Key Observations
- **Custom `brand` palette** defined but maps 1:1 to Tailwind's `blue-*` palette. The codebase overwhelmingly uses `blue-*` directly instead of `brand-*`.
- **`surface` and `border` tokens** defined but rarely referenced in components — most files use `bg-white`, `bg-gray-50`, `border-gray-200` directly.
- **No plugins** — no typography, forms, or aspect-ratio plugins.
- **PostCSS:** Standard `tailwindcss` + `autoprefixer` only.

---

## 2. UI Library Dependencies

| Library | Version | Theming Impact |
|---------|---------|----------------|
| **Tailwind CSS** | ^3.3.0 | Primary styling system — all layout, color, spacing |
| **Recharts** | ^3.7.0 | Chart components with inline hex color props (no theme integration) |
| **Lucide React** | ^0.562.0 | Icon library — inherits `currentColor`, no own theming |
| **React Hot Toast** | ^2.6.0 | Toast notifications — styled via inline hex in `ToastContext.jsx` |
| **React Markdown** | ^10.1.0 | Markdown rendering — styled via Tailwind classes in Aaron chatbot |
| **html2canvas** | ^1.4.1 | Screenshot capture for export — inherits DOM styles |
| **jsPDF** | ^4.2.1 | PDF export — uses `BRAND` color constants in `exportPdf.ts` |

**No component libraries:** No shadcn/ui, Radix, Headless UI, MUI, Chakra, or Ant Design. All UI components are hand-built with Tailwind classes.

---

## 3. Color Usage Map

### 3.1 Top 20 Tailwind Background Classes (by occurrence count)

| Rank | Class | Count | Usage |
|------|-------|-------|-------|
| 1 | `bg-gray-50` | 301 | Subtle section backgrounds |
| 2 | `bg-gray-100` | 201 | Card/row hover states, muted bg |
| 3 | `bg-blue-50` | 148 | Info highlights, selected states |
| 4 | `bg-blue-600` | 143 | Primary buttons, active tabs |
| 5 | `bg-red-50` | 100 | Error/danger backgrounds |
| 6 | `bg-blue-700` | 92 | Button hover states |
| 7 | `bg-blue-100` | 90 | Badge backgrounds, light info bg |
| 8 | `bg-gray-200` | 82 | Borders, dividers, disabled bg |
| 9 | `bg-emerald-50` | 72 | Success backgrounds |
| 10 | `bg-purple-50` | 60 | Premium/coaching highlights |
| 11 | `bg-amber-50` | 54 | Warning highlights |
| 12 | `bg-red-100` | 48 | Error badge backgrounds |
| 13 | `bg-emerald-100` | 46 | Success badge backgrounds |
| 14 | `bg-green-50` | 44 | Positive state backgrounds |
| 15 | `bg-gray-900` | 39 | Dark backgrounds (Wallboard, celebrations) |
| 16 | `bg-blue-500` | 38 | Secondary blue elements, dots |
| 17 | `bg-purple-100` | 35 | Coaching/premium badge bg |
| 18 | `bg-green-100` | 34 | Score highlight rows |
| 19 | `bg-amber-100` | 31 | Warning badge backgrounds |
| 20 | `bg-indigo-50` | 28 | Indigo accent backgrounds |

### Top 10 Tailwind Text Classes

| Rank | Class | Count |
|------|-------|-------|
| 1 | `text-gray-500` | 681 |
| 2 | `text-gray-400` | 603 |
| 3 | `text-gray-700` | 517 |
| 4 | `text-gray-600` | 443 |
| 5 | `text-gray-900` | 399 |
| 6 | `text-blue-600` | 202 |
| 7 | `text-blue-700` | 155 |
| 8 | `text-red-600` | 104 |
| 9 | `text-red-500` | 95 |
| 10 | `text-gray-800` | 95 |

### Top 10 Tailwind Border Classes

| Rank | Class | Count |
|------|-------|-------|
| 1 | `border-gray-300` | 290 |
| 2 | `border-gray-200` | 274 |
| 3 | `border-gray-100` | 186 |
| 4 | `border-blue-500` | 68 |
| 5 | `border-red-200` | 47 |
| 6 | `border-blue-200` | 42 |
| 7 | `border-purple-200` | 23 |
| 8 | `border-green-200` | 23 |
| 9 | `border-amber-200` | 18 |
| 10 | `border-gray-50` | 17 |

### 3.2 CSS Custom Properties (Variables)

**Zero custom CSS properties defined.** The codebase does not use `var(--primary)` or any CSS custom property pattern.

Only 2 references to `var()` exist — both are Tailwind's internal `var(--tw-gradient-stops)` used in arbitrary radial gradient classes on `LandingPage.jsx`:
- Line 192: `bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))]`
- Line 516: `bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))]`

### 3.3 Inline Styles with Hex Codes

**144 total occurrences** across **18 files**. Full inventory:

| File | Hex Count | Key Colors | Context |
|------|-----------|------------|---------|
| `pages/PilotDashboard.jsx` | 55+ | `#0d0f15`, `#13161e`, `#00ff88`, `#f5c842` | Standalone dark theme (DM Sans font, neon green accents) |
| `components/Charts.jsx` | 24 | `#f0f0f0`, `#6b7280`, `#3b82f6`, `#8884d8` | Recharts axis/grid/tooltip/fill colors |
| `contexts/ToastContext.jsx` | 20 | `#10b981`, `#ef4444`, `#3b82f6`, `#fff` | react-hot-toast style overrides |
| `components/DealCelebration.jsx` | 10 | `#0f172a`, `#1e1b4b`, `#d97706`, `#fcd34d` | Gold/amber celebration gradients |
| `Login.jsx` / `SignUp.jsx` | 4 each | `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335` | Google logo brand colors (SVG paths) |
| `components/SalesFunnel.jsx` | 10 | `#6366f1`→`#f43f5e` | Purple-to-red funnel stage progression |
| `components/PipelineOperator.jsx` | 6 | `#3b82f6`, `#6366f1`, `#8b5cf6`, `#f59e0b` | Pipeline stage fallback colors |
| `pages/Wallboard.jsx` | 4 | `#0f172a`, `#1e1b4b`, `#fcd34d`, `#f8fafc` | Dark theme celebration cards |
| `pages/Profile.jsx` | 4 | `#3B82F6`, `#fbbf24`, `#e5e7eb` | Badge color fallbacks |
| `pages/Coach.jsx` | 2 | `#3B82F6`, `#ffffff` | Skillset badge fallback |
| `components/BadgeCreationModal.jsx` | 3 | `#4F46E5` | Default badge color (indigo) |
| `components/ActivityFeed.jsx` | 1 | `#6366f1` | Event dot default color |
| `components/CepConfigSection.jsx` | 1 | `#6366f1` | Default CEP stage color |
| `components/UpgradePrompt.jsx` | 4 | `#7c3aed` | Purple upgrade CTA text |
| `components/ViewAllBadgesModal.jsx` | 2 | `#3B82F6`, `#d1d5db` | Badge fallback colors |
| `components/SignalOutreachModal.jsx` | 1 | `#8b5cf6` | Signal accent color |
| `Share*SnapshotModal` (3 files) | 1 each | `#ffffff` | Snapshot white background |
| `ApptiviaScorecard.tsx` | 1 | `#e5e7eb` | SVG circle stroke |

### 3.4 Gradients — Complete Inventory

**156+ total gradient usages** across the codebase.

#### CSS `linear-gradient()` (5 inline styles)

| File | Line | Gradient | Element |
|------|------|----------|---------|
| `DealCelebration.jsx` | 164 | `linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)` | Celebration card bg |
| `DealCelebration.jsx` | 199 | `linear-gradient(90deg, #d97706, #f59e0b, #fcd34d, #f59e0b, #d97706)` | Gold badge border |
| `DealCelebration.jsx` | 231 | `linear-gradient(90deg, #f59e0b 0%, #fde68a 50%, #f59e0b 100%)` | Gold text fill (bg-clip) |
| `SalesFunnel.jsx` | 143 | `linear-gradient(90deg, ${color}33, ${color}55)` | Dynamic funnel bar fill |
| `Wallboard.jsx` | 846 | `linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)` | Toast card bg |

#### CSS `radial-gradient()` (3 occurrences)

| File | Line | Gradient | Element |
|------|------|----------|---------|
| `PilotDashboard.jsx` | 192 | `radial-gradient(circle at top right, #00ff8811 0%, transparent 70%)` | Green glow accent |
| `LandingPage.jsx` | 192 | `bg-[radial-gradient(ellipse_at_top_right,...)]` | Hero section glow |
| `LandingPage.jsx` | 516 | `bg-[radial-gradient(ellipse_at_bottom_left,...)]` | CTA section glow |

#### SVG `<linearGradient>` (1 definition)

| File | Colors | Element |
|------|--------|---------|
| `assets/apptivia-logo.svg` | `#3b82f6` → `#8b5cf6` → `#ec4899` | Logo text (blue→purple→pink) |

#### Tailwind Gradient Classes — Top Combinations

| Direction | Count | Most Common Stops |
|-----------|-------|-------------------|
| `bg-gradient-to-r` | 68 | `from-blue-500 to-purple-500` (primary CTA) |
| `bg-gradient-to-br` | 54 | `from-blue-500 via-purple-500 to-indigo-500` (auth pages) |
| `bg-gradient-to-b` | 1 | `from-slate-900 via-blue-950 to-indigo-950` (LandingPage hero) |

**Top gradient stop classes by frequency:**
- `from-blue-500` (49), `to-purple-600` (27), `from-blue-600` (18), `to-purple-500` (15), `to-indigo-500` (15), `to-pink-500` (14), `to-cyan-500` (14), `via-purple-500` (13)

#### Gradient Use Cases

| Use Case | Pattern | Files |
|----------|---------|-------|
| Auth page full-screen bg | `bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500` | Login, SignUp, ForgotPassword, UpdatePassword, AccountSetup |
| Primary CTA buttons | `bg-gradient-to-r from-blue-500 to-purple-500` | Login, SignUp, OnboardingWizard, ConfigureModal, many modals |
| Icon/avatar backgrounds | `bg-gradient-to-br from-{color}-500 to-{color}-500` | DashboardLayout, AccountIntelligence, SignalProspecting |
| Modal/section headers | `bg-gradient-to-r from-{color}-500 to-{color}-500` | EngageDiscover, ConfigureModal, ConfirmModal |
| Light info containers | `bg-gradient-to-r from-blue-50 to-indigo-50` | ConfigureModal, ContestCreationModal, Analytics |
| Dark celebration cards | `linear-gradient(145deg, #0f172a, #1e1b4b)` | DealCelebration, Wallboard |
| Badge rarity rings | `bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600` | BadgeModal (gold/silver/bronze/platinum/diamond) |
| Integration icons | Dynamic `${template.color}` class | Integrations, Profile, Systems |

### 3.5 Chart & Data Visualization Colors

#### Recharts Color Constants (Charts.jsx)

| Constant | Colors | Usage |
|----------|--------|-------|
| `COLORS` | `['#22c55e', '#eab308', '#ef4444', '#6b7280']` | Score distribution pie chart |
| `REP_OVERLAY_COLORS` | `['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']` | Historical scores line overlay (7 reps) |
| Chart grid/axes | `stroke="#f0f0f0"` (grid), `stroke="#6b7280"` (axes) | All 5 chart types |
| Primary bar/line | `fill/stroke="#3b82f6"` | KPIBarChart, TeamPerformance, HistoricalScores |
| Tooltip bg | `backgroundColor: '#fff'`, `border: '1px solid #e5e7eb'` | All chart tooltips |

#### KPI Score Colors (scoreColors.ts)

| Threshold | Tailwind Text | Tailwind Bg | Hex |
|-----------|--------------|-------------|-----|
| ≥90% | `text-green-600` | `bg-green-500` | `#16a34a` |
| 80–89% | `text-yellow-500` | `bg-yellow-400` | `#eab308` |
| 60–79% | `text-orange-500` | `bg-orange-400` | `#f97316` |
| <60% | `text-red-500` | `bg-red-500` | `#ef4444` |

#### Pipeline/CEP Stage Colors (cepDefaults.ts)

| Stage | Hex | Tailwind Equivalent |
|-------|-----|-------------------|
| Discovery | `#3b82f6` | blue-500 |
| Qualification | `#6366f1` | indigo-500 |
| Proposal | `#8b5cf6` | violet-500 |
| Negotiation | `#f59e0b` | amber-500 |
| Closed Won | `#10b981` | emerald-500 |
| Closed Lost | `#ef4444` | red-500 |

**Stage color palette (for user-created stages):**
`['#94a3b8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#f59e0b', '#34d399', '#2dd4bf', '#38bdf8']`

#### Sales Funnel Colors (SalesFunnel.jsx)

Purple-to-red progression: `#6366f1` → `#8b5cf6` → `#a855f7` → `#d946ef` → `#ec4899` → `#f43f5e`

#### Skillset Colors (skillsets.ts)

| Skillset | Tailwind Class | Hex Fallback |
|----------|---------------|-------------|
| Conversationalist | `bg-blue-500` | `#3B82F6` |
| Call Conqueror | `bg-green-500` | `#10B981` |
| Email Warrior | `bg-purple-500` | `#8B5CF6` |
| Pipeline Guru | `bg-orange-500` | `#F59E0B` |
| Task Master | `bg-red-500` | `#EF4444` |
| Scorecard Master | `bg-yellow-500` | `#D97706` |
| Engage Pro | `bg-cyan-500` | `#06b6d4` |

#### Integration Gradients (integrations.ts)

| Provider | Gradient |
|----------|----------|
| Salesforce | `from-blue-400 to-blue-600` |
| HubSpot | `from-orange-400 to-orange-600` |
| Outreach | `from-violet-400 to-violet-600` |
| SalesLoft | `from-teal-400 to-teal-600` |
| Marketo | `from-purple-400 to-purple-600` |
| Microsoft Cal | `from-sky-400 to-sky-600` |
| Google Cal | `from-green-400 to-emerald-600` |
| Apollo | `from-indigo-400 to-indigo-600` |
| Gong | `from-pink-400 to-rose-600` |
| Sendoso | `from-amber-400 to-amber-600` |

#### Email/PDF Export Colors

Both `emailTemplates.ts` and `exportPdf.ts` define parallel `BRAND`/`EMAIL_COLORS` objects:
```
blue: '#3b82f6', purple: '#8b5cf6', pink: '#ec4899',
green: '#10b981', amber: '#f59e0b', red: '#ef4444',
gray: '#6b7280', lightGray: '#f3f4f6',
gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)'
```

#### Wallboard Celebration Colors

Confetti palette: `['#f59e0b', '#fcd34d', '#10b981', '#34d399', '#3b82f6', '#93c5fd', '#8b5cf6', '#c4b5fd', '#ef4444', '#fca5a5', '#ec4899', '#f9a8d4']`

#### Pilot Dashboard (Standalone Dark Theme)

| Element | Color | Usage |
|---------|-------|-------|
| Page bg | `#0d0f15` | Main container |
| Card bg | `#13161e` | Cards, selectors |
| Borders | `#1e222c` | Dividers, hover states |
| Primary text | `#e8eaf0` | Headers, values |
| Secondary text | `#c8ccd8` | Descriptions |
| Muted text | `#4a5060` — `#6a7080` | Labels, sublabels |
| Accent | `#00ff88` | Neon green — confirmed/active states |
| Warning | `#f5c842` | Golden yellow — in-progress states |
| Error | `#ff4444` / `#ff6666` | Bright red — error/expired |
| Chart bars | `#00ff88`, `#4a9eff`, `#b06aff` | Green, blue, purple |

---

## 4. Font Configuration

### Current Font Stack
```css
font-family: Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
```

### Where It's Set
1. **`tailwind.config.js`** line 29: `fontFamily.sans` — applies to all Tailwind `font-sans` usage
2. **`src/index.css`** line 12: `body { font-family: ... }` — explicit body declaration (redundant with Tailwind's `font-sans` but ensures coverage)

### Font Loading
- **No custom font files** — no `@font-face` declarations, no `.woff`/`.woff2` files in the project
- **No Google Fonts import** — no `@import url('fonts.googleapis.com/...')` in CSS or `<link>` in `index.html`
- **Inter is a system fallback** — the browser uses Inter only if the user has it installed locally. Otherwise falls through to `ui-sans-serif` → `system-ui` → `Segoe UI` (Windows) → `Roboto` (Android)
- **Exception:** PilotDashboard.jsx uses `fontFamily: "'DM Sans', 'Inter', sans-serif"` inline (line 388) — DM Sans is also not loaded via any font service, so falls back to Inter/system

### Base Font Size
- `html { font-size: 15px; }` — set in `index.css` line 6
- `body { font-size: 0.95rem; }` — set in `index.css` line 10
- **Effective body font size:** 15px × 0.95 = 14.25px

### Meta Theme Color
- `index.html` line 6: `<meta name="theme-color" content="#3B82F6">` — blue-500 for mobile browser chrome

---

## 5. Global Stylesheets

### `src/index.css` (72 lines — full content)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html { font-size: 15px; }
body {
  font-size: 0.95rem;
  overflow-x: hidden;
  font-family: Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background-color: #f8fafc;
  color: #0f172a;
}

img, svg, video, canvas { max-width: 100%; height: auto; }

@layer components {
  .layout-root, .layout-root > * { min-width: 0; max-width: 100%; }
  .layout-root .flex, .layout-root .grid { min-width: 0; }
}

@layer components {
  .bg-white.rounded-lg.shadow-sm,
  .bg-white.rounded-xl.shadow-sm,
  .bg-white.rounded-2xl.shadow-sm {
    box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 0 0 1px rgba(226,232,240,0.9), 0 8px 16px rgba(15,23,42,0.06);
  }
}

@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.animate-fadeIn { animation: fadeIn 0.2s ease-out; }
.animate-shimmer { animation: shimmer 2s infinite linear; }
```

**This is the only CSS file.** No `globals.css`, `App.css`, or other stylesheets exist.

---

## 6. Component-Level Visual Decisions

### Conditional Color Logic Patterns

The codebase uses **ternary-in-className** extensively for state-based styling. Key patterns:

#### Score/Attainment Thresholds (most common)
```jsx
// AccountIntelligence.jsx — ICP score coloring
className={`${icpScore >= 75 ? 'text-emerald-600' : icpScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}

// OrgHealthScorecard.jsx — health dimension bars
score >= 75 ? { text: 'text-green-700', bg: 'bg-green-100', bar: 'bg-green-500' }
score >= 50 ? { text: 'text-yellow-700', bg: 'bg-yellow-100', bar: 'bg-yellow-500' }
// etc.
```

#### Active/Selected State Toggle
```jsx
// AaronChatbot.jsx — thread selection
className={`${activeThreadId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}

// ApptiviaScorecard.tsx — configure button permission
className={`${canConfigureScorecard ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
```

#### Trend Direction
```jsx
// ApptiviaScorecard.tsx — delta indicator
className={`${direction === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}
```

#### Signal/Tier Classification
```jsx
// signalThresholds.ts
T1: { color: 'text-green-700', bg: 'bg-green-100' }
T2: { color: 'text-yellow-700', bg: 'bg-yellow-100' }
T3: { color: 'text-gray-600', bg: 'bg-gray-100' }
```

#### Dynamic Color from Data
```jsx
// Integration icons — color comes from constants
className={`bg-gradient-to-br ${template.color}`}  // e.g., "from-blue-400 to-blue-600"

// CEP stages — color from org config
style={{ backgroundColor: stage.color || '#6366f1' }}

// Badge colors — color from DB
style={{ color: badge.color || '#3B82F6' }}
```

### Files with Heaviest Conditional Styling
1. `AccountIntelligence.jsx` — 15+ conditional color rules (scores, stages, tiers, influence levels)
2. `ApptiviaScorecard.tsx` — 10+ (score rows, trend arrows, permission gates)
3. `SignalProspecting.jsx` — 8+ (signal tiers, action statuses, filter states)
4. `EngageDiscover.jsx` — 8+ (research status, signal actions, send buttons)
5. `PipelineOperator.jsx` — 6+ (deal stages, forecast categories, risk flags)
6. `Wallboard.jsx` — 5+ (Apptivia levels, badge rarity, difficulty)

---

## 7. Login Page Gradient — Specific Implementation

**File:** `src/Login.jsx`, line 38

### Full-screen background
```jsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500">
```
- **Direction:** `to-br` (top-left → bottom-right diagonal)
- **3-stop gradient:** `blue-500` (#3b82f6) → `purple-500` (#a855f7) → `indigo-500` (#6366f1)
- **Implementation:** Pure Tailwind classes, no inline CSS

### Logo icon
```jsx
<div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 ...">
```
- **Direction:** `to-r` (left → right)
- **2-stop gradient:** `blue-500` → `purple-500`

### CTA button
```jsx
<button className="bg-gradient-to-r from-blue-500 to-purple-500 ... hover:from-blue-600 hover:to-purple-600">
```
- Same blue→purple gradient with darker hover state

### Shared with other auth pages
The exact same `bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500` pattern is used on:
- `SignUp.jsx` (line 84)
- `ForgotPassword.jsx`
- `UpdatePassword.jsx`
- `AccountSetup.jsx`

---

## 8. File Count Summary

| Category | Count |
|----------|-------|
| **React/JSX/TSX/TS source files** | 183 |
| **CSS files** | 1 (`src/index.css`) |
| **Files using `className`** (touch styling) | 122 |
| **Files with inline `style=` props** | 30 |
| **Files containing hex color codes** | 41 |
| **Files using gradients** | 50+ |
| **Total files that touch styling** (className OR style OR hex) | **~130** |

---

## 9. Summary of Findings

### Architecture
- **Pure Tailwind** — no component library, no CSS modules, no styled-components, no CSS-in-JS
- **Single CSS file** (`index.css`, 72 lines) — only Tailwind directives, base body styles, 2 keyframe animations
- **Zero CSS custom properties** — no design token system via `var(--x)`
- **Custom `brand` palette defined but unused** — the codebase uses Tailwind's `blue-*` palette directly

### Color System
- **De facto primary:** `blue-500` / `blue-600` / `blue-700` (buttons, links, highlights)
- **De facto accent:** `purple-500` / `purple-600` (gradient partner, coaching, premium)
- **Semantic colors:** `emerald-*` (success), `amber-*` / `yellow-*` (warning), `red-*` (error/danger), `gray-*` (neutral)
- **Brand gradient:** `blue-500 → purple-500 → indigo-500` (auth pages), `blue-500 → purple-500 → pink-500` (logo SVG)
- **80+ unique hex values** scattered across 41 files — no centralized color constants except `scoreColors.ts`, `cepDefaults.ts`, and `EMAIL_COLORS`/`BRAND` in export utils

### Pain Points for Migration
1. **No design token layer** — colors are spread across Tailwind classes, inline hex, and JS constants with no single source of truth
2. **Gradient inconsistency** — auth pages use `blue→purple→indigo`, logo uses `blue→purple→pink`, CTAs use `blue→purple`
3. **Parallel color systems** — `scoreColors.ts` (Tailwind + hex), `emailTemplates.ts` (hex), `exportPdf.ts` (hex), `cepDefaults.ts` (hex), `skillsets.ts` (Tailwind + hex) — all define the same semantic colors independently
4. **PilotDashboard is an island** — completely standalone dark theme with 30+ custom hex colors, DM Sans font, no Tailwind classes for colors
5. **Recharts colors are hardcoded** — chart axes, grids, fills all use inline hex props with no connection to the design system
6. **Toast colors are hardcoded** — `ToastContext.jsx` styles react-hot-toast via inline hex, bypassing Tailwind
7. **`brand-*` Tailwind tokens exist but are unused** — the config defines `brand-50` through `brand-900` but grep finds near-zero usage in components
8. **Font is declared but not loaded** — Inter is in the font stack but no web font is imported, so rendering depends on local installation
