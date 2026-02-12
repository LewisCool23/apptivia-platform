# Scorecard Selection System

## Overview
The Apptivia Platform now features a selective scorecard display system that allows users to choose exactly **5 KPI metrics** from a library of 21+ available metrics to display on the main scorecard dashboard.

## Key Features

### 📊 Focused Dashboard
- **Main Scorecard**: Displays only 5 carefully selected KPIs
- **Clean Interface**: Reduces clutter and focuses on what matters most
- **Customizable**: Users can choose which 5 KPIs best represent their organization's productivity goals

### 🎯 21+ Available Metrics
While the scorecard displays only 5 metrics, users have access to 21+ KPI options organized into 5 categories:

#### Activity Metrics
- Call Connects
- Dials
- Talk Time Minutes
- Emails Sent
- Social Touches

#### Engagement Metrics
- Meetings
- Conversations
- Demos Completed
- Follow-ups

#### Pipeline Metrics
- Sourced Opportunities
- Stage 2 Opportunities
- Pipeline Created
- Pipeline Advanced
- Qualified Leads
- Discovery Calls

#### Revenue Metrics
- Closed Won Deals
- Revenue Generated
- Average Deal Size

#### Efficiency Metrics
- Response Time (hours)
- Win Rate (%)
- Sales Cycle (days)

## How to Configure Scorecard KPIs

### Step 1: Open Configuration Modal
1. Navigate to the Apptivia Scorecard page
2. Click the **"Configure"** button in the top-right corner

### Step 2: Select Scorecard KPIs
1. Click on the **"📊 Scorecard Selection"** tab
2. You'll see:
   - Currently selected KPIs (if any) with their position numbers
   - Available KPIs to choose from
   - A counter showing your progress (e.g., "3/5 selected")

### Step 3: Add/Remove KPIs
- **To Add**: Click "Add to Scorecard" next to any available KPI
- **To Remove**: Click "Remove" next to any selected KPI
- **To Reorder**: Use the ↑ (up) and ↓ (down) arrows to change KPI positions

### Step 4: Save Changes
- Once you have exactly 5 KPIs selected, click **"Save Changes"**
- The scorecard will automatically refresh with your new selection

## Default Selection
The system comes pre-configured with these 5 core metrics:
1. **Call Connects** (Activity)
2. **Talk Time Minutes** (Activity)
3. **Meetings** (Engagement)
4. **Sourced Opportunities** (Pipeline)
5. **Stage 2 Opportunities** (Pipeline)

These represent the foundational productivity indicators for most sales organizations.

## Database Schema

### New Columns in `kpi_metrics` Table
```sql
show_on_scorecard boolean DEFAULT false
scorecard_position integer
```

- **show_on_scorecard**: Boolean flag indicating if KPI is selected for scorecard display
- **scorecard_position**: Integer (1-5) indicating the display order on the scorecard

## Benefits of the 5-KPI System

### 1. **Focus**
- Sales reps see only the most critical metrics
- Reduces cognitive overload
- Enables faster decision-making

### 2. **Flexibility**
- Organizations can customize based on their unique goals
- Different teams can potentially have different scorecard configurations
- Easy to adjust as business priorities change

### 3. **Performance**
- Faster page loads with fewer metrics to calculate
- Simplified data queries
- Cleaner UI rendering

### 4. **Strategic Alignment**
- Forces leadership to identify their true north star metrics
- Aligns team focus on what truly drives success
- Prevents metric overload

## Best Practices

### Choosing Your 5 KPIs
Consider selecting:
1. **1-2 Activity Metrics**: Leading indicators (calls, emails, dials)
2. **1-2 Engagement Metrics**: Mid-funnel indicators (meetings, conversations)
3. **1-2 Pipeline/Revenue Metrics**: Lagging indicators (opportunities, closed deals)

### Balancing Leading & Lagging Indicators
- **Leading Indicators**: Activity-based metrics that predict future success
- **Lagging Indicators**: Result-based metrics that measure outcomes
- Aim for a 60/40 split (leading/lagging) for balanced performance tracking

### Regular Review
- Review your scorecard KPI selection quarterly
- Adjust based on seasonal changes or shifting business priorities
- Ensure alignment with company OKRs and strategic goals

## Technical Implementation

### Frontend Components
- **ConfigureModal.tsx**: Contains the 3-tab interface (Manage/Scorecard Selection/Create)
- **ApptiviaScorecard.tsx**: Filters and displays only selected KPIs

### Key Functions
```typescript
// Fetch only scorecard KPIs
fetchKpiMetrics() {
  const { data } = await supabase
    .from('kpi_metrics')
    .select('*')
    .eq('show_on_scorecard', true)
    .order('scorecard_position');
}

// Toggle KPI selection
handleToggleScorecardKpi(key: string) {
  // Adds/removes KPI from scorecard
  // Updates database in real-time
}

// Reorder KPIs
handleMoveScorecardKpi(key: string, direction: 'up' | 'down') {
  // Swaps positions
  // Updates scorecard_position in database
}
```

## Migration
The scorecard selection feature is implemented via migration `009_expand_kpi_metrics.sql`:
- Adds `show_on_scorecard` and `scorecard_position` columns
- Sets default 5 KPIs to `show_on_scorecard = true`
- Maintains backward compatibility with existing data

## Future Enhancements
Potential improvements for future versions:
- Team-specific scorecard configurations
- Role-based default scorecard templates
- Historical tracking of scorecard changes
- A/B testing different KPI combinations
- AI-powered KPI recommendations based on industry benchmarks
