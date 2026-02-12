# Production Readiness Assessment

## Current State Analysis

### ✅ Multi-Tenant Architecture
Your app **IS** ready for multi-company deployment! The schema includes:
- `organizations` table - Each company gets its own organization
- `teams` table with `organization_id` foreign key
- `profiles` table with `organization_id` and `team_id`
- All data properly scoped to organizations

### 🔍 Sample Data Currently in Database

The following migrations contain **sample/demo data** that should be removed for production:

#### **002_kpis_and_seed_data.sql**
- Demo Company organization (UUID: `00000000-0000-0000-0000-000000000001`)
- 2 sample teams (Sales Team Alpha, Sales Team Beta)
- 15+ sample profiles (Ava Carter, Mike Chen, Sarah Johnson, etc.)
- Historical KPI values for sample users

#### **003_admin_permissions.sql**
- Sample admin user inserts

#### **004_skillsets_and_achievements.sql**
- Sample profile updates (apptivia_level, current_score)
- Sample profile_skillsets data

#### **005_contests_and_badges.sql**
- 2 sample active contests (Q1 Sales Blitz, Meeting Master)
- Sample contest participants and leaderboard data

#### **006_populate_departments_and_teams.sql**
- Additional sample teams and departments

#### **008_populate_badges.sql**
- Sample badge definitions (these may be PRODUCT features, not sample data)

#### **010_populate_historical_data.sql**
- 90 days of historical KPI values for demo users

### ⚠️ What to Keep vs. Remove

**KEEP (Product Configuration):**
- ✅ KPI metric definitions (call_connects, talk_time_minutes, meetings, etc.)
- ✅ Badge definitions (82 badges across 9 categories)
- ✅ Achievement definitions (100 achievements across skillsets)
- ✅ Skillset definitions (Sales Prospecting, Deal Management, etc.)
- ✅ Contest templates
- ✅ All schema/table structures
- ✅ All functions and triggers

**REMOVE (Sample Data):**
- ❌ Demo Company organization
- ❌ Sample teams
- ❌ Sample profiles/users
- ❌ Sample KPI values
- ❌ Sample contests
- ❌ Sample profile_badges
- ❌ Sample profile_skillsets
- ❌ Sample profile_achievements
- ❌ Sample notifications

---

## Production Cleanup Script

Use this SQL script to remove all sample data while preserving your product configuration:

```sql
-- PRODUCTION_CLEANUP.sql
-- Remove all sample data while keeping product definitions

BEGIN;

-- 1. Delete sample user data (cascades to related tables)
DELETE FROM profiles 
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 2. Delete sample teams
DELETE FROM teams 
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 3. Delete demo organization
DELETE FROM organizations 
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 4. Clean up any orphaned data
DELETE FROM kpi_values WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_badges WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_skillsets WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_achievements WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM notifications WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM coaching_plans WHERE coach_id NOT IN (SELECT id FROM profiles);
DELETE FROM coaching_plans WHERE student_id NOT IN (SELECT id FROM profiles);
DELETE FROM contest_participants WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM contest_leaderboards WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM active_contests WHERE created_by NOT IN (SELECT id FROM profiles);

-- 5. Reset sequences if needed (optional)
-- ALTER SEQUENCE IF EXISTS organizations_id_seq RESTART WITH 1;

COMMIT;

-- Verify cleanup
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'kpi_values', COUNT(*) FROM kpi_values
UNION ALL
SELECT 'profile_badges', COUNT(*) FROM profile_badges
UNION ALL
SELECT 'active_contests', COUNT(*) FROM active_contests;
```

---

## New Company Onboarding Flow

### Step 1: Create Organization
```sql
INSERT INTO organizations (name, industry, subscription_plan, settings)
VALUES (
  'Acme Corporation',
  'Technology',
  'Pro',
  '{"integrations": {}, "features": {}}'::jsonb
)
RETURNING id;
```

### Step 2: Create Initial Admin User
```sql
-- Use Supabase Auth to create user first, then:
INSERT INTO profiles (
  id,                    -- Use auth.user.id from Supabase Auth
  organization_id,       -- Organization ID from Step 1
  email,
  first_name,
  last_name,
  role,
  department,
  title
) VALUES (
  'auth-user-uuid',
  'org-uuid-from-step-1',
  'admin@acmecorp.com',
  'John',
  'Doe',
  'admin',
  'Management',
  'VP of Sales'
);
```

### Step 3: Create Teams
```sql
INSERT INTO teams (organization_id, name, description)
VALUES 
  ('org-uuid', 'Enterprise Sales', 'Large deal team'),
  ('org-uuid', 'SMB Sales', 'Small business team');
```

### Step 4: Configure Integrations
The company should now:
1. Set up their CRM integration (Salesforce, HubSpot, etc.)
2. Configure data sync settings
3. Map their KPIs to your standard metrics
4. Import their users into profiles table
5. Begin syncing KPI data into `kpi_values` table

---

## Integration Architecture

### Data Flow for Production Companies

```
Company CRM (Salesforce/HubSpot)
    ↓ (API Integration)
Your Integration Service
    ↓ (Transform & Validate)
kpi_values table
    ↓ (Triggers fire)
Auto-calculate achievements, badges, contests
    ↓ (Notifications created)
User sees real-time updates
```

### Required Integration Components

**You'll need to build:**
1. **Integration Hub** - UI for companies to connect their systems
2. **Data Sync Service** - ETL pipeline to pull CRM data
3. **Webhook Handlers** - Real-time updates from CRM systems
4. **Data Mapping UI** - Map their fields to your KPIs
5. **User Import Tool** - Bulk import users from their directory

### Sample Integration Config Schema
```json
{
  "organization_id": "uuid",
  "integrations": {
    "salesforce": {
      "enabled": true,
      "credentials": {
        "instance_url": "https://acme.salesforce.com",
        "access_token": "encrypted-token"
      },
      "field_mappings": {
        "call_connects": "Task.Type=Call AND Task.Status=Completed",
        "meetings": "Event.Type=Meeting",
        "sourced_opps": "Opportunity.StageName=Prospecting"
      },
      "sync_frequency": "hourly",
      "last_sync": "2026-02-06T10:00:00Z"
    }
  }
}
```

---

## Production Checklist

### Before Launch
- [ ] Run `PRODUCTION_CLEANUP.sql` to remove all sample data
- [ ] Set up environment variables for production Supabase instance
- [ ] Configure RLS (Row Level Security) policies for organization isolation
- [ ] Set up organization-scoped queries in all API endpoints
- [ ] Build integration hub UI
- [ ] Create company onboarding wizard
- [ ] Set up data sync infrastructure
- [ ] Configure monitoring and alerting

### Organization Isolation (Security)
Make sure these are in place:

```sql
-- Example RLS policy for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see profiles in their organization"
ON profiles FOR SELECT
USING (
  organization_id = (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can only insert profiles in their organization"
ON profiles FOR INSERT
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
```

### Multi-Tenant Considerations
1. **Data Isolation**: Every query must filter by `organization_id`
2. **APIs**: Add organization context to all API calls
3. **Authentication**: Bind users to organizations on signup
4. **Billing**: Track usage per organization for subscription management
5. **Feature Flags**: Enable/disable features per subscription plan

---

## Recommended Architecture Enhancements

### Add Organization Context to Auth
```typescript
// On user login, fetch and cache organization context
const getUserOrganization = async (userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('organization_id, organizations(*)')
    .eq('id', userId)
    .single();
  
  return data;
};

// Store in React context for all API calls
<OrganizationContext.Provider value={organization}>
  {children}
</OrganizationContext.Provider>
```

### Middleware for Organization Scoping
```typescript
// All database queries should go through this
const queryWithOrgContext = async (table: string, orgId: string) => {
  return supabase
    .from(table)
    .select('*')
    .eq('organization_id', orgId);
};
```

---

## Summary

**Your app IS production-ready from an architecture standpoint!** 

✅ You have proper multi-tenant structure  
✅ Schema supports multiple companies  
✅ Data isolation is possible via organization_id  

**What you need to do:**
1. Run cleanup script to remove sample data
2. Build integration hub for companies to connect their systems
3. Add RLS policies for organization isolation
4. Create onboarding wizard for new companies
5. Build data sync service to pull in real company data

The foundation is solid - you just need to layer on the integration/onboarding features!
