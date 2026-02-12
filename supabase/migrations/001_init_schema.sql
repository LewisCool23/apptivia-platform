CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);


-- ENUMS
CREATE TYPE subscription_plan AS ENUM ('Basic', 'Pro', 'Enterprise');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE contest_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'task');
CREATE TYPE outcome_type AS ENUM ('connected', 'voicemail', 'no answer', 'email sent');
CREATE TYPE calculation_type AS ENUM ('sum', 'average', 'count');
CREATE TYPE unit_type AS ENUM ('count', 'minutes', 'dollars');

CREATE TABLE kpi_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    goal_value numeric,
    weight_percentage numeric,
    unit unit_type,
    calculation_type calculation_type,
    is_active boolean DEFAULT true,
    display_order integer,
    created_at timestamptz DEFAULT now()
);

-- USER KPI GOAL
CREATE TABLE user_kpi_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    kpi_id uuid REFERENCES kpi_configurations(id),
    goal_value numeric,
    time_period text,
    start_date date,
    end_date date,
    created_by uuid REFERENCES users(id)
);

-- ACTIVITY RECORD
CREATE TABLE activity_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    activity_type activity_type,
    date_time timestamptz,
    duration integer,
    outcome outcome_type,
    related_contact_id uuid,
    related_opportunity_id uuid,
    notes text,
    source text,
    external_id text,
    created_at timestamptz DEFAULT now()
);

-- OPPORTUNITY
CREATE TABLE opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    name text,
    value numeric,
    stage text,
    source_type text,
    created_date date,
    close_date date,
    external_id text,
    last_synced timestamptz
);

-- DAILY SCORE
CREATE TABLE daily_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    date date,
    total_score numeric,
    kpi_scores jsonb,
    raw_metrics jsonb,
    calculated_at timestamptz DEFAULT now()
);

    -- CONTEST
    CREATE TABLE contests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        contest_type contest_type,
        metric_tracked uuid REFERENCES kpi_configurations(id),
        start_date date,
        end_date date,
        prize_description text,
        prize_value numeric,
        status contest_status NOT NULL DEFAULT 'draft',
        participants jsonb,
        created_by uuid REFERENCES users(id),
        created_at timestamptz DEFAULT now()
    );

    -- CONTEST LEADERBOARD
    CREATE TABLE contest_leaderboards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contest_id uuid REFERENCES contests(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id),
        current_value numeric,
        rank integer,
        last_updated timestamptz
    );

    -- SKILLSET
    CREATE TABLE skillsets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        icon text,
        color text,
        related_kpis jsonb,
        calculation_formula text,
        is_active boolean DEFAULT true
    );

    -- USER SKILLSET PROGRESS
    CREATE TABLE user_skillset_progress (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        skillset_id uuid REFERENCES skillsets(id),
        level integer,
        progress_percentage numeric,
        total_points integer,
        last_calculated timestamptz
    );

        -- ACHIEVEMENT/MILESTONE
        CREATE TABLE achievements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
            name text NOT NULL,
            description text,
            category text,
            icon text,
            criteria jsonb,
            points_value integer,
            is_active boolean DEFAULT true
        );

        -- USER ACHIEVEMENT
        CREATE TABLE user_achievements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES users(id) ON DELETE CASCADE,
            achievement_id uuid REFERENCES achievements(id),
            earned_date date,
            notified boolean DEFAULT false
        );

        -- ACTION PLAN
        CREATE TABLE action_plans (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES users(id) ON DELETE CASCADE,
            created_by uuid REFERENCES users(id),
            title public.profile_title,
            description text,
            focus_area public.level_enum,
            start_date date,
            target_completion_date date,
            status text,
            created_at timestamptz DEFAULT now()
        );

        -- ACTION ITEM
        CREATE TABLE action_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            action_plan_id uuid REFERENCES action_plans(id) ON DELETE CASCADE,
            title text,
            description text,
            priority action_priority,
            due_date date,
            completed boolean DEFAULT false,
            completed_date date,
            notes text
        );

            -- INTEGRATION
            CREATE TABLE integrations (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
                integration_type integration_type,
                status text,
                credentials text,
                last_sync timestamptz,
                sync_frequency text,
                settings jsonb,
                created_at timestamptz DEFAULT now()
            );

            -- SYNC LOG
            CREATE TABLE sync_logs (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                integration_id uuid REFERENCES integrations(id) ON DELETE CASCADE,
                sync_started timestamptz,
                sync_completed timestamptz,
                records_synced integer,
                errors jsonb,
                status sync_status
            );

            -- NOTIFICATION
            CREATE TABLE notifications (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid REFERENCES users(id) ON DELETE CASCADE,
                type notification_type,
                title text,
                message text,
                is_read boolean DEFAULT false,
                action_url text,
                created_at timestamptz DEFAULT now()
            );

            -- COMMENT/NOTE
            CREATE TABLE comments (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid REFERENCES users(id) ON DELETE CASCADE,
                author_id uuid REFERENCES users(id),
                related_to_type text,
                related_to_id uuid,
                content text,
                is_private boolean DEFAULT false,
                created_at timestamptz DEFAULT now()
            );

            -- SYSTEM SETTINGS
            CREATE TABLE system_settings (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
                setting_key text,
                setting_value jsonb,
                updated_by uuid REFERENCES users(id),
                updated_at timestamptz DEFAULT now()
            );
CREATE TYPE notification_type AS ENUM ('achievement_earned', 'contest_started', 'goal_missed');
CREATE TYPE action_priority AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE integration_type AS ENUM ('Salesforce', 'Outreach', 'Gong');
CREATE TYPE sync_status AS ENUM ('success', 'failed', 'partial');

-- ORGANIZATION
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text,
    subscription_plan subscription_plan NOT NULL DEFAULT 'Basic',
    settings jsonb,
    created_at timestamptz DEFAULT now(),
    billing_info jsonb
);

-- TEAM
CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    manager_id uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

-- USER
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    name text,
    phone text,
    role public.roles_enum NOT NULL DEFAULT 'Power User',
    team_id uuid REFERENCES teams(id),
    manager_id uuid REFERENCES users(id),
        department public.department_enum,
    start_date date,
    photo_url text,
    status user_status NOT NULL DEFAULT 'active',
    timezone text,
    created_at timestamptz DEFAULT now(),
    last_login timestamptz
);