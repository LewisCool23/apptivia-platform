# KPI Metrics - Complete Reference

## Overview
Your Apptivia Platform now supports **21 comprehensive sales KPI metrics** organized into 5 categories, plus the ability to create unlimited custom metrics.

## Built-in KPI Metrics

### 📞 Activity Metrics
- **Call Connects** - Number of successful call connections (Goal: 100)
- **Dials** - Total number of outbound dials made (Goal: 200)
- **Talk Time Minutes** - Total talk time in minutes (Goal: 100)
- **Emails Sent** - Total outbound emails sent (Goal: 150)
- **Social Touches** - LinkedIn messages and interactions (Goal: 50)

### 🤝 Engagement Metrics
- **Meetings** - Number of scheduled meetings (Goal: 3)
- **Conversations** - Meaningful conversations with prospects (Goal: 80)
- **Demos Completed** - Product demonstrations delivered (Goal: 5)
- **Follow-ups** - Follow-up activities completed (Goal: 30)

### 📊 Pipeline Metrics
- **Sourced Opportunities** - Number of opportunities sourced (Goal: 4)
- **Stage 2 Opportunities** - Opportunities advanced to Stage 2 (Goal: 3)
- **Pipeline Created** - Total pipeline value created (Goal: $50,000)
- **Pipeline Advanced** - Pipeline value moved to next stage (Goal: $30,000)
- **Qualified Leads** - Leads qualified for sales process (Goal: 10)
- **Discovery Calls** - Initial discovery calls completed (Goal: 8)

### 💰 Revenue Metrics
- **Closed Won Deals** - Number of deals closed and won (Goal: 2)
- **Revenue Generated** - Total revenue from closed deals (Goal: $100,000)
- **Average Deal Size** - Average size of closed deals (Goal: $50,000)

### ⚡ Efficiency Metrics
- **Response Time (hrs)** - Average response time to leads (Goal: 2 hours)
- **Win Rate** - Percentage of opportunities won (Goal: 30%)
- **Sales Cycle (days)** - Average days to close a deal (Goal: 30 days)

## How to Configure KPIs

### Access Configuration
1. Navigate to any scorecard page (Dashboard, Analytics)
2. Click the **"Configure"** button in the top-right
3. You'll see two tabs: **Manage KPIs** and **Create Custom KPI**

### Manage Existing KPIs
- **Edit Names** - Click the ✏️ icon to edit KPI name and description
- **Adjust Goals** - Set target values for each metric
- **Set Weights** - Assign percentage weights (should total 100%)
- **Change Units** - Select appropriate unit (count, hours, currency, etc.)
- **Delete Custom KPIs** - Click 🗑️ to remove custom metrics

### Create Custom KPIs
1. Click **"Create Custom KPI"** tab
2. Fill in required fields:
   - **KPI Key**: Unique identifier (lowercase_with_underscores)
   - **KPI Name**: Display name for the metric
   - **Description**: What this metric measures
   - **Category**: Activity, Engagement, Pipeline, Revenue, or Efficiency
   - **Unit**: count, minutes, hours, days, currency, or percentage
   - **Goal**: Target value
   - **Weight**: Percentage contribution to Apptivia Score

3. Click **"Create KPI"**
4. New KPI appears immediately in the Manage tab

## Migration Instructions

Run the new migration to add expanded KPI metrics:

```bash
# In your Supabase SQL Editor, run:
/supabase/migrations/009_expand_kpi_metrics.sql
```

This migration:
- Adds new columns: `is_custom`, `is_active`, `category`, `updated_at`
- Inserts 16 new sales metrics
- Creates RLS policies for security
- Enables soft-delete functionality

## Features

### ✅ What You Can Do
- Create unlimited custom KPI metrics
- Edit metric names, descriptions, goals, and weights
- Organize metrics by category
- Delete custom metrics (soft-delete preserves historical data)
- Scorecards automatically adapt to active KPIs
- Changes apply to all team members globally

### 🚫 Restrictions
- Cannot delete system KPIs (only custom ones)
- System KPIs can be edited but not removed
- KPI keys must be unique
- Weights should total 100% for accurate scoring

## Technical Details

### Database Schema
```sql
kpi_metrics
├── id (uuid)
├── key (text, unique)
├── name (text)
├── description (text)
├── goal (numeric)
├── weight (numeric)
├── unit (text)
├── category (text)
├── is_custom (boolean)
├── is_active (boolean)
└── updated_at (timestamptz)
```

### Categories
- `activity` - Outbound activities and touchpoints
- `engagement` - Prospect interactions and meetings
- `pipeline` - Opportunity creation and advancement
- `revenue` - Deals closed and revenue generated
- `efficiency` - Performance ratios and cycle times

### Units
- `count` - Simple numeric count
- `minutes` / `hours` / `days` - Time-based metrics
- `currency` - Dollar amounts
- `percentage` - Ratio metrics (0-100)

## Best Practices

1. **Balance Your Scorecard** - Mix activity, pipeline, and revenue metrics
2. **Weight Appropriately** - Give more weight to outcome metrics (revenue, pipeline)
3. **Set Realistic Goals** - Base targets on historical performance
4. **Review Regularly** - Adjust goals and weights quarterly
5. **Keep It Focused** - Use 5-10 key metrics, not all 21
6. **Test Custom Metrics** - Start with low weight to validate before increasing

## Examples

### SDR Scorecard (Focus on Activity & Pipeline)
- Dials: 30%
- Conversations: 20%
- Meetings: 20%
- Qualified Leads: 20%
- Pipeline Created: 10%

### AE Scorecard (Focus on Revenue)
- Demos Completed: 15%
- Pipeline Advanced: 20%
- Closed Won: 25%
- Revenue Generated: 30%
- Win Rate: 10%

### Custom Metric Example
```
KPI Key: customer_referrals
Name: Customer Referrals
Description: Number of referrals from existing customers
Category: pipeline
Unit: count
Goal: 5
Weight: 0.15 (15%)
```

## Support

For issues or questions:
1. Check that migration 009 has been run
2. Verify RLS policies are active
3. Confirm user has appropriate permissions
4. Check browser console for errors

## Future Enhancements
- Per-team KPI configurations
- Time-based KPI activation (seasonal metrics)
- KPI benchmarking across teams
- Historical KPI performance tracking
- Import/export KPI configurations
