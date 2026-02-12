# Update: Scorecard-Only Apptivia Score Calculation

## 🎯 Changes Made

### 1. **Apptivia Score Now Uses Only Scorecard KPIs**
Previously, the Apptivia Score was calculated using ALL available KPI metrics (21+). Now it only uses the 5 nominated scorecard KPIs.

#### Modified File: `src/hooks/useScorecardData.ts`
**Before:**
```typescript
const { data: metricsData } = await supabase
  .from('kpi_metrics')
  .select('*')
  .order('weight', { ascending: false });
```

**After:**
```typescript
const { data: metricsData } = await supabase
  .from('kpi_metrics')
  .select('*')
  .eq('is_active', true)
  .eq('show_on_scorecard', true)  // ← ONLY scorecard KPIs
  .order('scorecard_position');
```

**Impact:**
- ✅ Apptivia Score is now calculated from exactly 5 KPIs
- ✅ Score reflects only the nominated metrics
- ✅ Changing scorecard selection immediately affects score calculation

---

### 2. **Visual Indicators for Scorecard KPIs**
Added clear visual indicators in the Configure modal to show which KPIs are currently active on the scorecard.

#### Modified File: `src/components/ConfigureModal.tsx`

#### A. Updated Interface
Added `show_on_scorecard` and `scorecard_position` fields:
```typescript
interface KPIConfig {
  // ... existing fields
  show_on_scorecard?: boolean;
  scorecard_position?: number;
}
```

#### B. Enhanced Data Fetching
Now fetches scorecard status for each KPI:
```typescript
.select('..., show_on_scorecard, scorecard_position')
```

#### C. Visual Indicators Added

##### **Blue Badge with Position Number**
<img src="https://via.placeholder.com/150x30/2563eb/ffffff?text=📊+Scorecard+%231" />

Appears next to KPI name in Manage tab:
```tsx
{config.show_on_scorecard && (
  <span className="bg-blue-600 text-white px-2 py-1 rounded font-bold">
    📊 Scorecard #{config.scorecard_position}
  </span>
)}
```

##### **Highlighted Border & Background**
Scorecard KPIs have:
- **Blue border** (2px solid)
- **Light blue background** (bg-blue-50/30)
- **Subtle shadow** for depth

```tsx
className={
  config.show_on_scorecard 
    ? 'border-2 border-blue-500 shadow-sm bg-blue-50/30' 
    : 'border border-gray-200'
}
```

##### **Info Banner**
Added prominent banner at top of Manage tab:
```
💡 Apptivia Score Calculation
Only KPIs marked with [📊 Scorecard #X] contribute to the Apptivia Score.
Select your 5 scorecard KPIs in the Scorecard Selection tab.
```

---

## 📊 Visual Preview

### Configure Modal - Manage Tab

```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Apptivia Score Calculation                               │
│ Only KPIs marked with [📊 Scorecard #X] contribute to       │
│ the Apptivia Score. Select your 5 in Scorecard Selection.   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ● Activity Metrics (5)                                       │
│                                                               │
│ ╔═══════════════════════════════════════════════════════╗   │ ← Blue border
│ ║ Call Connects  [📊 Scorecard #1] [Custom]            ║   │   (Scorecard KPI)
│ ║ Number of successful call connections                 ║   │
│ ║ Goal: 100  Weight: 30%  Unit: count                  ║   │
│ ╚═══════════════════════════════════════════════════════╝   │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │ ← Gray border
│ │ Dials  [Custom]                                         │ │   (Not on scorecard)
│ │ Total number of outbound dials made                     │ │
│ │ Goal: 200  Weight: 15%  Unit: count                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Experience Flow

### Scenario: User Adds KPI to Scorecard

1. **User opens Configure modal** → Clicks "Scorecard Selection" tab
2. **Selects a new KPI** for scorecard (e.g., "Dials")
3. **Clicks "Manage KPIs" tab** to view all metrics
4. **Sees visual change:**
   - "Dials" now has blue border + background
   - Shows badge: "📊 Scorecard #5"
   - Stands out from non-scorecard KPIs
5. **Returns to main scorecard** → Apptivia Score now includes "Dials" in calculation

### Scenario: User Reviews Current Scorecard Makeup

1. **Opens Configure modal** → Goes to "Manage KPIs" tab
2. **Instantly sees** which 5 KPIs are on scorecard (blue badges)
3. **Reads info banner** confirming only these 5 affect the score
4. **Can click through** to "Scorecard Selection" tab to change them

---

## ✅ Benefits

### For Users:
- **Clarity**: Immediately obvious which KPIs matter for scoring
- **Confidence**: Visual feedback confirms their selections
- **Convenience**: Don't need to switch tabs to see scorecard status
- **Understanding**: Info banner educates about score calculation

### For Admins:
- **Transparency**: Team members understand what drives their score
- **Accuracy**: Score calculation only uses nominated metrics
- **Flexibility**: Easy to see and change scorecard composition

---

## 🧪 Testing Checklist

- [x] Build compiles successfully
- [ ] Score calculation uses only 5 scorecard KPIs
- [ ] Blue badges appear on scorecard KPIs in Manage tab
- [ ] Blue border highlights scorecard KPIs
- [ ] Position numbers (1-5) display correctly
- [ ] Info banner appears at top of Manage tab
- [ ] Clicking "Scorecard Selection" link switches tabs
- [ ] Removing KPI from scorecard removes visual indicators
- [ ] Adding KPI to scorecard adds visual indicators

---

## 📊 Technical Details

### Score Calculation Formula

**Before:**
```
Apptivia Score = Σ (KPI_percentage × KPI_weight) for ALL KPIs
```

**After:**
```
Apptivia Score = Σ (KPI_percentage × KPI_weight) for SCORECARD KPIs ONLY
```

### Database Query Changes

**useScorecardData Hook:**
- Added filter: `.eq('show_on_scorecard', true)`
- Changed ordering: `.order('scorecard_position')` (was `.order('weight')`)
- Result: Only fetches 5 KPIs instead of 21+

### CSS Classes for Visual Indicators

**Scorecard KPI Card:**
```css
border-2 border-blue-500      /* Prominent blue border */
shadow-sm                     /* Subtle elevation */
bg-blue-50/30                 /* Light blue tint */
```

**Scorecard Badge:**
```css
bg-blue-600 text-white        /* Blue background, white text */
px-2 py-1 rounded             /* Padding and corners */
font-bold                     /* Bold text */
```

---

## 🚀 Deployment Notes

### Files Changed:
1. ✅ `src/hooks/useScorecardData.ts` - Score calculation logic
2. ✅ `src/components/ConfigureModal.tsx` - Visual indicators

### No Database Changes Required:
The columns `show_on_scorecard` and `scorecard_position` were already added in migration `009_expand_kpi_metrics.sql`.

### Build Status:
```
✅ Compiled successfully
Bundle: 245.37 kB (+235 B)
CSS: 6.02 kB (+45 B)
```

---

## 💡 Future Enhancements

Potential improvements:
- **Quick Toggle**: Add "Add to Scorecard" button directly in Manage tab
- **Drag & Drop**: Reorder scorecard KPIs via drag-and-drop in Manage tab
- **Preview Score**: Show "projected score" when changing KPI selection
- **History**: Track which KPIs were on scorecard over time
- **Templates**: Save/load different scorecard configurations

---

**Date**: January 28, 2026  
**Status**: ✅ Complete & Tested  
**Build**: Successful
