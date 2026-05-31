# Apptivia Platform Bible
> Comprehensive reference for the Apptivia sales performance intelligence platform.
> Last updated: May 29, 2026 (Engage expansion, deal management, task system, org playbooks, onboarding drip, contest org-hardening, signal auto-archive, Aaron Sonnet 4.6 upgrade, 207 migrations, 199 API endpoints, 113 components, 25 hooks, 25 crons)

---

## 1. Product Overview

**Apptivia** is a sales performance intelligence platform that helps sales teams measure, coach, and improve rep performance. It combines KPI scoring, AI coaching, gamification, signal-based prospecting, and real-time visibility into a unified system.

### Core Product Pillars
| Pillar | Description |
|--------|-------------|
| **Apptivia Scorecard** | MVP — weighted KPI scoring for sales reps with configurable metrics, goals, and attainment tracking |
| **Apptivia Coach** | Coaching tools for managers — coaching plans, IDPs, performance reviews, 1:1 prep, AI-generated recommendations |
| **Apptivia Engage** | Outward-facing signal prospecting — find companies to sell to, research prospects, generate outreach, manage pipeline |
| **Wallboard** | Real-time team visibility — 8 auto-rotating slides for TV display |
| **Contests** | Gamification — sales competitions with leaderboards, badges, and rewards |
| **Analytics** | Advanced dashboards — score distributions, team trends, KPI watchdog anomaly detection, org health scorecard |
| **Aaron AI** | AI coaching chatbot — Claude-powered assistant with 14 coaching frameworks, rep memory, and live KPI context |

### Value Proposition
Apptivia replaces a $180K-$250K RevOps hire with a productized system covering 12 RevOps functions. Key metric: "70% → 20% admin reduction" for sales managers.

---

## 2. Architecture & Tech Stack

### Frontend
- **Framework:** React 18 + Vite
- **Language:** JSX/TSX (mixed, migrating toward TypeScript)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **PDF:** jsPDF + html2canvas
- **Markdown:** ReactMarkdown (for Aaron chatbot responses)
- **Real-time:** Socket.IO client (for Aaron chatbot)
- **Auth:** Supabase Auth (JWT-based)
- **State:** React Context (AuthContext, NotificationContext, ToastProvider)

### Backend
- **Runtime:** Node.js / Express
- **File:** `public_html/backend/server.js` (~8,665 lines — monolith)
- **Supporting files:** emailService.js, engageService.js, integrationService.js, reportTemplates.js
- **Provider modules:** `providers/` directory — 10 provider modules auto-loaded at startup (see Section 3.7). Canonical KPI layer in `providers/kpiCanonical.js`
- **AI:** Anthropic Claude SDK — model IDs: `claude-sonnet-4-6-20250514` (Aaron, coaching plans, signal classification), `claude-haiku-4-5-20251001` (outreach drafts, follow-up nudges, competitive briefs, IDP auto-drafts)
- **Database:** Supabase (PostgreSQL with RLS)
- **Real-time:** Socket.IO server
- **Scheduling:** Custom CronManager with overlap guards
- **Email:** Nodemailer (SMTP)
- **Calling:** Twilio Voice SDK (WebRTC browser-based)
- **Payments:** Stripe (checkout, portal, webhooks)

### Infrastructure
- **Hosting:** Hostinger (hPanel — NOT cPanel)
- **Domain:** apptivia.app (frontend), api.apptivia.app (backend API)
- **SSL:** Hostinger edge terminates SSL for apptivia.app. Express serves HTTPS on port 3000 with Let's Encrypt cert for api.apptivia.app
- **Process Manager:** PM2 (`apptivia-backend`, id: 0)
- **Database:** Supabase hosted PostgreSQL
- **CDN/Proxy:** Apache on Hostinger (but `[P]` proxy does NOT work — Express handles its own HTTPS)

### External Services (12+)
| Service | Purpose |
|---------|---------|
| Supabase | Auth, database, RLS, Edge Functions, realtime subscriptions |
| Anthropic Claude | Aaron chatbot, AI coaching plans, AI research briefs, signal classification, outreach drafts |
| Apollo.io | People search, company search, person/company enrichment |
| Tavily | AI-powered web search for signal scanning and research |
| People Data Labs | Person/company enrichment (complement to Apollo — always fires for company research, phone fallback for people) |
| Hunter.io | Email finder (fills gaps when Apollo truncates) |
| Stripe | Subscription billing, checkout, customer portal |
| Twilio | Voice SDK for browser-based click-to-call |
| IPInfo | IP-to-company resolution for website visitor tracking |
| SEC Edgar | SEC filing search during signal scanning |
| Nodemailer/SMTP | Transactional emails |
| Integration Providers | 10 provider modules: Salesforce, HubSpot, Outreach, Gong, SalesLoft, Marketo, Sendoso (org-level OAuth 2.0), Apollo (personal API key), Google Calendar, Microsoft Outlook (personal OAuth 2.0). AES-256-GCM encrypted credentials. |

---

## 3. Source File Inventory

### 3.1 Pages (23)

| File | Description |
|------|-------------|
| `AccountSetup.jsx` | Post-invite account completion — set name and password after clicking invitation link |
| `Analytics.jsx` | Advanced analytics — score distribution, team trends, KPI attainment, sales funnel, org health, KPI watchdog |
| `Coach.jsx` | Coaching hub — skillsets, levels, playbooks, coaching plans, reviews, IDPs, 1:1 prep |
| `CoachingPlans.jsx` | Coaching plan lifecycle — Rep Plans, Manager Playbooks, IDPs, Reviews tabs with AI generation |
| `Contests.jsx` | Contest management — creation, enrollment, leaderboards, badge awarding, lifecycle, CSV/PDF export |
| `Engage.jsx` | Sales intelligence hub — Signal Prospecting, Discover, Accounts, Pipeline Operator tabs + dialpad/contacts panels |
| `ForgotPassword.jsx` | Password reset request form |
| `Integrations.jsx` | Integration management — connect/disconnect, OAuth, API keys, sync, history |
| `LandingPage.jsx` | Public marketing page — hero, features, pricing, demo request |
| `OrganizationSettings.jsx` | Multi-tab admin — General (ICP, signals, CEP, Sales DNA, wallboard, reports, KPI import), Teams, Billing |
| `PilotApplication.jsx` | Pilot application form for prospective pilot customers |
| `PilotDashboard.jsx` | Admin-only pilot validation dashboard — 3 Cornell assumption cards, health score ring, signal breakdown (route: /admin/pilot) |
| `PermissionsTeams.jsx` | Per-user granular permission toggle grid |
| `Profile.jsx` | User profile — info, badges, achievements, skillsets, photo upload, CSV/PDF export |
| `Resources.jsx` | Resources and documentation page for users |
| `Systems.jsx` | Unified admin — Integrations, Teams, Permissions tabs |
| `Wallboard.jsx` | Full-screen TV display — 8 auto-rotating slides with confetti and keyboard controls |
| `UpdatePassword.jsx` | Password update form (post-reset-link) |
| `SignUp.jsx` | Self-service org signup with 14-day Pro trial |
| `PublicIntegrations.jsx` | Public integrations catalog (no auth required) |
| `PrivacyPolicy.jsx` | Privacy policy page |
| `TermsOfService.jsx` | Terms of service page |
| `Security.jsx` | Security practices page |

### 3.2 Components (113)

#### Top-Level Components (77)

| File | Description |
|------|-------------|
| `AaronMemoryPanel.jsx` | Aaron rep memory viewer — summaries, goals, challenges, strengths, preferences |
| `AccountContactsModal.jsx` | Account contacts modal — view/manage contacts associated with account |
| `AccountIntelligence.jsx` | ICP scoring, buying committee, territory management, AI account analysis |
| `ActiveDealModal.jsx` | Active deal view/edit — stage, value, close date, contacts, activities |
| `ActivityFeed.jsx` | Real-time feed — deals, calls, badges, signals with filtering and auto-refresh |
| `AddTeamMembersModal.tsx` | Add team members to contest with search, department filtering, org-scoping |
| `AddToSequenceModal.jsx` | Add prospect to outreach sequence — sequence picker, step preview |
| `AnalyticsRecords.jsx` | Analytics record browser — CRM activity and event records with filtering |
| `ApptiviaLevelInfoModal.jsx` | Educational modal explaining progression system (5 levels, skillsets, achievements) |
| `ApptiviaLogo.jsx` | Apptivia logo component (rebrand) |
| `ApptiviaMark.jsx` | Apptivia mark/icon component (rebrand) |
| `AskAIFooter.jsx` | Ask AI footer bar — inline AI query from any page |
| `BadgeAssignmentModal.jsx` | Assign badge to team members (manager/admin) |
| `BadgeCreationModal.jsx` | Create custom badge with icon, color, rarity, points |
| `BadgeModal.jsx` | Badge detail view with social sharing (email, Twitter, LinkedIn) |
| `CallReviewModal.jsx` | Call review — recording playback, AI analysis, sentiment, talk-time |
| `CelebrationModal.jsx` | Animated celebration overlay for achievements and milestones |
| `CepConfigSection.jsx` | CEP stage configuration — drag-reorder, color picker, checklists, exit criteria |
| `ChangePasswordModal.jsx` | In-app password change |
| `Charts.jsx` | Recharts components — TrendChart, ScoreDistribution, TeamPerformance, HistoricalScores |
| `CoachingPlanTemplatesModal.jsx` | Template picker for coaching plans |
| `ConfigureModal.tsx` | Full-screen KPI configuration — add/remove/reorder, goals, weights, visibility |
| `ConfigurePanel.tsx` | Slide-out KPI quick-configure panel |
| `ConfirmModal.jsx` | Reusable confirmation dialog (danger/warning/success variants) |
| `ContestCreationModal.tsx` | Contest creation/edit — template, KPI, dates, rewards, enrollment |
| `ContestTemplatesModal.jsx` | Pre-built contest template gallery |
| `CreateDealModal.jsx` | Deal creation form — stage, value, close date, account linking |
| `CreateTaskModal.jsx` | Task creation for prospect follow-up — type, due date, priority, assignment |
| `DataDrivenPlaybook.jsx` | AI coaching playbook — 5-week KPI trends, weakness detection, tiered recommendations |
| `DealCelebration.jsx` | Confetti overlay for closed-won deals (Supabase realtime trigger) |
| `EditProfileModal.jsx` | Profile edit form |
| `EngageActivityModal.jsx` | Engage activity log — view activity history for accounts/prospects |
| `EngageCalendar.jsx` | Calendar view for Engage — meetings, tasks, scheduled outreach |
| `EngageContacts.jsx` | Contacts tab — detail panel, notes with auto-save, meetings, deal cross-navigation |
| `EngageContactsPanel.jsx` | Side panel — prospect list with call/email/LinkedIn actions |
| `EngageDialpadPanel.jsx` | Phone dialpad with numpad and recent call history |
| `EngageDiscover.jsx` | AI research tool — Apollo search, ICP filtering, enrichment, auto-research, multi-angle outreach (4 draft cards), Hunter email fallback |
| `ErrorBoundary.jsx` | React error boundary with friendly fallback UI |
| `ExportReportModal.jsx` | CSV vs PDF export format selector |
| `InfoTooltip.jsx` | Info icon with hover tooltip |
| `IntegrationLogo.jsx` | Dynamic integration provider logo component |
| `KpiImportModal.jsx` | CSV KPI import wizard — upload, map columns, preview, validate, process |
| `KpiWatchdog.jsx` | Anomaly detection — drops/spikes/stagnation with severity, AI analysis, actions |
| `LeaderboardModal.tsx` | Full-screen contest leaderboard with rank changes |
| `Meeting1On1PrepModal.jsx` | 1:1 meeting prep — structured agenda from KPI data, shareable synopsis |
| `MeetingsModal.jsx` | Meeting detail modal — attendees, agenda, notes, calendar integration |
| `NotificationPanel.jsx` | Slide-out notification panel with categories, mark-read, delete |
| `OrgHealthDetailModal.jsx` | Org health dimension detail — score breakdown, data points, navigation |
| `OrgHealthScorecard.jsx` | 5-dimension health check (Performance, Configuration, Coaching, Engagement, Outbound) |
| `PageActionBar.jsx` | Unified top-right action bar (Filter, Configure, Export, Notifications, Actions) |
| `PipelineOperator.jsx` | Deal pipeline — CEP stages, risk flags, AI forecast, CRUD, initialDealId cross-tab navigation |
| `PromptLibrary.jsx` | Prompt template CRUD — categories, AI model tags, variables, search |
| `PromptTemplateSelector.jsx` | Dropdown selector for prompt templates |
| `QuickAddSignalModal.jsx` | Quick-add signal to account — type, score, notes |
| `RightFilterPanel.jsx` | Reusable slide-out right panel wrapper |
| `SalesDnaConfigSection.jsx` | Sales DNA configuration — methodology, qualification framework, hybrid mapping |
| `SalesFunnel.jsx` | Visual funnel chart — stage conversions with deltas and benchmarks |
| `SavedBriefModal.jsx` | AI research brief — save persistence (saved_by_user), enrichment writeback, fit score |
| `SavedContactsModal.jsx` | Saved contacts browser — manage saved/bookmarked contacts |
| `ScheduleMeetingModal.jsx` | Schedule meeting — calendar integration, attendee picker, agenda |
| `ScheduleReportModal.jsx` | Schedule automated email reports — type, frequency, recipients |
| `ScorecardFilters.tsx` | Multi-select filter bar — date, department, team, member with org-scoping |
| `SearchWithHistory.jsx` | Search input with localStorage autocomplete history |
| `SequenceBuilder.jsx` | Multi-step outreach sequence — step editor, channel routing, send windows |
| `ShareCoachSnapshotModal.jsx` | Coach data sharing — image, clipboard, email |
| `ShareScorecardSnapshotModal.jsx` | Scorecard data sharing — image, clipboard, email |
| `ShareSnapshotModal.jsx` | Profile achievement sharing — image, clipboard, email |
| `SharedAgendaModal.jsx` | Shared 1:1 agenda — collaborative meeting prep with manager |
| `SignalOutreachModal.jsx` | AI outreach from signal — email/LinkedIn/call scripts |
| `SignalProspecting.jsx` | Signal-based prospecting — intent signals, tier badges, category filter, action queue, stale signal dismiss |
| `Skeleton.jsx` | Loading skeleton components with shimmer animation |
| `SkillsetDetailsModal.tsx` | Skillset deep-dive — achievements, completion progress, difficulty ranking |
| `TaskPanel.jsx` | Task management panel — create, assign, track, complete tasks |
| `TwilioDialerWidget.jsx` | Floating in-call widget — status, timer, mute, hang-up |
| `UpgradePrompt.jsx` | Upgrade prompts — 4 variants (aaron_limit/feature_gate/team_size/generic), 3 contexts |
| `UserImportModal.jsx` | CSV user import wizard — parse, review, create profiles |
| `ViewAllBadgesModal.jsx` | Full badge catalog — earned + locked with search and filtering |

#### Coaching Components (17) + Config Files (3)

| File | Description |
|------|-------------|
| `AssignPlanModal.jsx` | Assign coaching plan to team members |
| `CreateRepPlanModal.jsx` | Create new coaching plan with AI generation |
| `CreateReviewModal.jsx` | Create performance review |
| `IdpBuilderForm.jsx` | IDP form — milestones, actions, career goals, AI generation |
| `IdpCard.jsx` | IDP card — status, milestone progress, overdue detection |
| `IdpDetailModal.jsx` | IDP detail view — milestone toggle, status transitions |
| `IdpTab.jsx` | IDP management tab — CRUD, templates, AI, filtering, card/list view toggle |
| `IdpTemplatesModal.jsx` | IDP template picker |
| `PlanBuilderForm.jsx` | Coaching plan form — KPIs, goals, milestones, AI generation |
| `PlanCard.jsx` | Coaching plan card — status, KPIs, assignments, actions |
| `PlanDetailModal.jsx` | Plan detail modal — content, assignments, effectiveness |
| `RequestCoachingPlanModal.jsx` | Rep-initiated coaching request to manager |
| `ReviewBuilderForm.jsx` | Review creation form — type, dates, rep assignment |
| `ReviewCard.jsx` | Review card — type badge, status, rating |
| `ReviewDetailModal.jsx` | Review detail — self-assessment, manager scoring, AI drafts |
| `ReviewTab.jsx` | Review management tab — lifecycle, AI, trends, card/list view toggle |
| `SelfAssessmentForm.jsx` | Rep self-assessment for reviews |
| `idpStatusConfig.js` | IDP status definitions — labels, colors, transitions |
| `planStatusConfig.js` | Coaching plan status definitions — labels, colors, transitions |
| `reviewStatusConfig.js` | Review status definitions — labels, colors, transitions |

#### Onboarding Components (11)

| File | Description |
|------|-------------|
| `OnboardingWizard.jsx` | 9-step orchestrator with draft persistence and validation |
| `StepOrgInfo.jsx` | Step 1: Company name, industry, size, title, website |
| `StepSalesDna.jsx` | Step 2: Methodology + qualification framework selection |
| `StepTeamStructure.jsx` | Step 3: Departments, teams, member invites |
| `StepKpiConfig.jsx` | Step 4: Role-based KPI templates, goal/weight customization |
| `StepYourMarket.jsx` | Step 5: ICP configuration — pain points, keywords, titles, tech stack |
| `StepChoosePlan.jsx` | Step 6: Subscription plan selection (Starter/Pro/Enterprise) |
| `StepIntegration.jsx` | Step 7: First integration connection (OAuth or API key) |
| `StepOptionalSetup.jsx` | Step 8: Wallboard, scheduled reports, notification preferences |
| `StepReviewLaunch.jsx` | Step 9: Readiness checklist with go-to-step navigation |
| `SetupChecklist.jsx` | Post-onboarding floating checklist with remaining items |

#### Shared Components (8)

| File | Description |
|------|-------------|
| `Tooltip.jsx` | Pure-CSS tooltip with configurable position and arrow |
| `IconButton.jsx` | Accessible icon button with size/style variants and tooltip |
| `StateDisplays.jsx` | EmptyState, ErrorState, LoadingState reusable displays |
| `FeedbackThumb.jsx` | "Was this helpful?" thumbs up/down widget |
| `SyncHistoryModal.jsx` | Integration sync history display |
| `DisconnectConfirmModal.jsx` | Integration disconnect confirmation |
| `CredentialsModal.jsx` | API key credential entry for integrations |
| `TeamManagementPanel.jsx` | Team CRUD UI with member assignment |

### 3.3 Hooks (25)

| Hook | Description |
|------|-------------|
| `useAccountIntelligence.ts` | Account scoring, buying committee, territory, AI analysis |
| `useActiveDeal.ts` | Active deal state management — selection, CRUD, linking |
| `useBilling.ts` | Subscription state, Stripe checkout/portal integration |
| `useCepConfig.ts` | CEP stages + org titles with default seeding |
| `useCoachData.ts` | Rep profiles with levels, skillsets, achievements, badges |
| `useContests.ts` | Contest CRUD, leaderboards, enrollment, real-time updates, org-scoped |
| `useEngageAgent.ts` | Research/prospecting workflow orchestration (Apollo + Tavily + Claude) |
| `useEngageCalendar.ts` | Calendar integration — meetings, scheduling, Google/Microsoft sync |
| `useHistoricalScores.ts` | 5-week historical scorecard trend data |
| `useIcpProfiles.ts` | ICP profile management — persona definitions, scoring criteria |
| `useIcpProspector.ts` | Apollo ICP prospecting with fit scoring |
| `useIntegrations.ts` | Integration lifecycle — OAuth, credentials, sync, status |
| `useKpiTemplates.ts` | KPI role templates (global + org-specific) |
| `useModalBehavior.ts` | Shared modal behavior — ESC close, scroll lock, focus trap |
| `usePipelineOperator.ts` | Pipeline deals, CEP stages, AI forecast, risk flags |
| `usePlaybooks.ts` | AI playbook CRUD with trigger conditions |
| `usePromptLibrary.ts` | Prompt template CRUD and filtering |
| `useRecords.ts` | CRM activity records — fetch, filter, paginate |
| `useSalesDna.ts` | Sales DNA config persistence |
| `useScorecardData.ts` | Core scorecard — KPI metrics, values, scores, attainment, trends |
| `useSignalProspecting.ts` | Signal detection, definitions, action queue, stale dismiss |
| `useTeamManagement.ts` | Team CRUD, member management, org-scoped |
| `useTitles.ts` | Job titles (global + org-specific) from DB |
| `useTwilioDialer.ts` | Twilio WebRTC calling — device, state, mute, auto-logging |

### 3.4 Constants (12)

| File | Description |
|------|-------------|
| `aaronFrameworks.ts` | 14 proprietary B2B sales coaching frameworks for Aaron AI routing |
| `cepDefaults.ts` | Default CEP stage templates (Standard B2B — 6 stages with checklists) |
| `integrations.ts` | 10 integration definitions with display metadata and API key field configs |
| `kpiGuidance.ts` | Per-KPI coaching guidance (27+ KPIs) with diagnosis, questions, and tips |
| `orgHealthMetrics.ts` | 5 org health dimensions with explanations, data points, and links |
| `roles.ts` | Role constants (admin/manager/coach/power_user), LEADERSHIP_ROLES, filter strings |
| `salesDna.ts` | 8 methodologies + 6 qualification frameworks with definitions |
| `scoreColors.ts` | KPI attainment color functions (green/yellow/orange/red thresholds) |
| `signalThresholds.ts` | Signal score thresholds, tier system (T1/T2/T3), category mappings |
| `skillsets.ts` | 7 skillsets, KPI mappings, 5 Apptivia Levels, utility functions |
| `subscriptionTiers.ts` | 3 tiers (Starter $19, Pro $49, Enterprise custom) with feature gates |
| `titles.ts` | Standard job titles (BDR, AE, Sales Leader, CS Rep, etc.) |

### 3.5 Utils (10)

| File | Description |
|------|-------------|
| `backendFetch.ts` | Authenticated fetch wrapper with JWT Bearer token + SSE streaming |
| `contestUtils.ts` | Leaderboard calculation, rank display (medals), score updates |
| `dateUtils.ts` | timeAgo, formatDate, getMonday, date presets for filters |
| `emailTemplates.ts` | Branded HTML email builders for all email types |
| `engageApi.ts` | Engage frontend API client routing to backend + direct Supabase |
| `exportPdf.ts` | Branded PDF reports via jsPDF + html2canvas (5 export types) |
| `exportUtils.ts` | CSV export with unit-aware formatting (5 export types) |
| `kpiCalc.ts` | calcPct() — KPI attainment % with direction-aware calculation |
| `reviewDataAggregator.ts` | Historical data aggregation for performance review snapshots |
| `scorecardFetch.ts` | Imperative scorecard data fetching (non-hook) for AI generation |

### 3.6 Core Files (9)

| File | Description |
|------|-------------|
| `App.jsx` | Root — routing, providers (Auth, Toast, Notification, ErrorBoundary), lazy loading |
| `AuthContext.jsx` | Auth provider — Supabase session, profile fetch, role normalization, permissions |
| `DashboardLayout.jsx` | Authenticated layout — sidebar (9 nav items + admin-only Pilot Dashboard), trial banner, Aaron button, setup checklist |
| `ApptiviaScorecard.tsx` | Primary scorecard page — KPI grid, scores, charts, export, configure |
| `AaronChatbot.jsx` | AI chatbot widget — Socket.IO, presets, frameworks, offline fallback, markdown |
| `Login.jsx` | Login form with Supabase auth |
| `supabaseClient.ts` | Supabase client init with in-memory lock (replaces LockManager) |
| `socket.ts` | Socket.IO client (autoConnect: false, 5 reconnect attempts) |
| `permissions.js` | 14 permissions, role defaults, DB overrides, hasPermission() |

### 3.7 Integration Provider Modules (10)

Located in `public_html/backend/providers/`. Auto-loaded by server.js at startup via `fs.readdirSync()`.

Each module exports: `type`, `getAuthUrl()`, `exchangeCode()`, `refreshToken()`, `sync` (entity sync functions), `kpiMap` (webhook → KPI mapping), `mapWebhookEvent()`, `verifyWebhook()`, and optional `push` (CRM write-back).

All sync functions accept `(integration, cursor, sb)` and return `{ records, nextCursor, kpiMappings }`. KPI mappings include `profileId`, `kpiKey`, `increment`, `source`, `externalEventId`, `weekStart`.

Org-level providers use `resolveProfileByEmail(sb, orgId, email)` to map external users to Apptivia profiles. Personal providers use `integration.profile_id` directly.

| Provider | Auth | Sync Entities | KPIs Mapped |
|----------|------|---------------|-------------|
| `salesforce.js` | OAuth 2.0 | Activities (calls + follow-ups), Meetings, Deals, Contacts | call_connects, dials, talk_time_minutes, emails_sent, meetings, demos_completed, discovery_calls, follow_ups, sourced_opps, stage2_opps, closed_won, revenue_generated, pipeline_created, sales_cycle_days |
| `hubspot.js` | OAuth 2.0 | Activities (calls), Meetings, Deals | call_connects, dials, talk_time_minutes, meetings, demos_completed, sourced_opps, closed_won, revenue_generated, pipeline_created, sales_cycle_days |
| `gong.js` | OAuth 2.0 | Activities (calls), Meetings, Call Intelligence | call_connects, talk_time_minutes, meetings, talk_to_listen_ratio, longest_monologue_sec, questions_asked, next_steps_mentioned, interactivity_score |
| `salesloft.js` | OAuth 2.0 | Activities (calls), Meetings, Emails | call_connects, talk_time_minutes, meetings, emails_sent, sequence_replies |
| `outreach.js` | OAuth 2.0 | Activities (calls), Meetings, Emails, Sequences | call_connects, talk_time_minutes, meetings, emails_sent, sequence_replies |
| `marketo.js` | OAuth 2.0 (client credentials) | Activities, Campaigns | emails_sent, form_submissions, campaign_responses |
| `sendoso.js` | OAuth 2.0 | Gifts (sends) | sends_sent, gifts_accepted, gift_influenced_meetings |
| `apollo.js` | API Key (personal) | Calls, Emails, Opportunities, Conversations, Sequences, Tasks | call_connects, dials, conversations, talk_time_minutes, meetings, emails_sent, sequence_replies, sequences_started, sourced_opps, stage2_opps, closed_won, revenue_generated, pipeline_created, sales_cycle_days, talk_to_listen_ratio, longest_monologue_sec, questions_asked, next_steps_mentioned, interactivity_score |
| `google_calendar.js` | OAuth 2.0 (personal) | Calendar Events | meetings |
| `microsoft_outlook.js` | OAuth 2.0 (personal) | Calendar Events, Emails | meetings, emails_sent |

**Personal integrations** (Apollo, Google Calendar, Microsoft Outlook): scoped to `integration.profile_id`, no org-wide email resolution needed. These are connected from the user's Profile → Integrations tab (requires `connect_own_integrations` permission).

### 3.4 KPI Canonical Translation Layer

All providers use the canonical KPI registry (`providers/kpiCanonical.js`) for unit transformation and aggregation rules. This prevents drift where different providers convert the same concept differently (e.g. Apollo `duration/60` vs Outreach `Math.round(duration/60)` vs HubSpot `ms/60000`).

**Aggregation Types:**
- `sum` — Add values (call_connects, dials, talk_time_minutes, revenue_generated, emails_sent, pipeline_created, etc.)
- `avg` — Rolling average with `sample_count` (talk_to_listen_ratio, interactivity_score, sales_cycle_days)
- `max` — Keep maximum value per week (longest_monologue_sec)
- `set` — Direct value upsert for derived/computed KPIs (win_rate, average_deal_size)

**Unit Transformers (used via `buildKpiMapping({ fromUnit })`):**
- `fromSeconds` → minutes with 2 decimal precision
- `fromMilliseconds` → minutes with 2 decimal precision
- `fromRatio` → percentage with 1 decimal precision (0.65 → 65.0%)
- `fromPercent` → percentage with 1 decimal precision
- `fromCount` → integer count
- `fromBoolean` → 0/1 count
- `fromDollars` → USD with 2 decimal precision
- `fromCents` → dollars with 2 decimal precision
- `fromDays` → days with 1 decimal precision
- `fromScore` → score 0-100 with 1 decimal precision
- `fromMinutes` → minutes with 2 decimal precision

**35 canonical KPIs defined** across 6 categories: Call Activity (8), Email/Sequence (5), Pipeline (6), Efficiency/Derived (3), Call Intelligence (5), Marketing/Gift (5). Contract tests in `providers/__tests__/kpiContract.test.js` verify all providers generate identical KPI formats for the same logical data.

**Derived KPIs Engine:**
`computeDerivedKpis()` in `integrationService.js` runs after each sync. For each synced profile, queries `kpi_values` for `closed_won`, `sourced_opps`, and `revenue_generated`, then computes:
- `win_rate` = (closed_won / sourced_opps) * 100 (set aggregation)
- `average_deal_size` = revenue_generated / closed_won (set aggregation)
Uses deterministic event IDs (`derived:{profileId}:{weekStart}:{kpiKey}`) for idempotent re-computation.

**Sum-Mode Dedup (Migrations 149-150):**
`processed_event_ids` JSONB array on `kpi_values` tracks ALL event IDs aggregated into each sum row. `upsert_kpi_sum()` RPC checks this array before incrementing, making re-syncs fully idempotent. Returns BOOLEAN (true = new event, false = duplicate skip) for observability logging.

---

## 4. Database Schema

### 4.1 Core Tables

#### organizations
Primary tenant table. Every user belongs to one org.
- `id` (uuid PK), `name`, `subscription_plan` (Basic/Pro/Enterprise), `sales_dna` (jsonb), `icp_config` (jsonb)
- Stripe: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`
- Onboarding: `onboarding_status`, `onboarding_step`, `onboarding_readiness` (jsonb)
- `last_signal_scan_at` (dedup guard for signal scan — tier-aware cooldown: 20h tier1, 6d default)

#### profiles
One per auth user. Org membership, role, team.
- `id` (uuid PK = auth.users.id), `organization_id` FK, `team_id` FK (nullable)
- `first_name`, `last_name`, `full_name` (GENERATED), `email`
- `role` (admin/manager/coach/power_user), `title` (text), `title_id` FK → titles
- `department` (enum: Sales/Marketing/Customer Success/Product/Engineering)
- `segment` (enum: Territory/Mid-Market/Enterprise)
- `apptivia_level` (Developing/Intermediate/Proficient/Elite/Master), `apptivia_points` (int)
- `status` (active/inactive), `avatar_url`

#### teams
- `id`, `organization_id` FK, `name`, `department_id` FK → departments, `segment` (enum), `manager_id` FK → profiles

#### departments
- `id`, `organization_id` FK, `name`, `sort_order`, UNIQUE(org, name)

#### titles
- `id`, `organization_id` FK (nullable = global), `title_key`, `title_name`, `description`
- 13 global titles seeded. Orgs can add their own.

### 4.2 Scorecard / KPIs

#### kpi_metrics (global catalog — 38 KPIs)
- `key` (unique), `name`, `goal`, `weight`, `unit` (count/minutes/dollars/percent/days), `category` (activity/engagement/pipeline/revenue/efficiency)
- `show_on_scorecard`, `scorecard_position`, `is_custom`, `is_active`

#### kpi_values (actual rep data)
- `kpi_id` FK, **`profile_id`** FK (not user_id), `team_id` FK, `value`, `period_start`, `period_end`, `source`

#### kpi_org_configs (per-org overrides)
- `organization_id` FK, `kpi_id` FK, `goal`, `weight`, `is_active`, `show_on_scorecard`
- History tracked in `kpi_org_config_history` via trigger

#### kpi_role_templates (role-based presets)
- `organization_id` FK (nullable = global), `title_key`, `kpi_configs` (jsonb array of {kpi_key, goal, weight})
- 3 global templates: BDR, AE, Sales Manager

#### kpi_benchmarks
- **`org_id`** FK (NOT organization_id), `kpi_key`, `benchmark_type`, `value`

### 4.3 Gamification

#### skillsets (7 global categories)
- Conversationalist, Call Conqueror, Email Warrior, Pipeline Guru, Task Master, Scorecard Master, Engage Pro

#### achievements
- `skillset_id` FK, `kpi_key`, `threshold`, `calculation_type` (cumulative/single_week), `points`, `difficulty`

#### profile_achievements
- `profile_id` FK, `achievement_id` FK, `completed_at`, `points_awarded` — no org_id (FK-scoped via RLS)

#### profile_skillsets
- `profile_id` FK, `skillset_id` FK, `progress`, `achievements_completed`, milestone flags (25/50/75/100)

#### badge_definitions
- `badge_name` (unique), `badge_type`, `criteria_type`, `criteria_value`, `rarity`, `category`, `points`

#### profile_badges
- `profile_id` FK, `badge_name`, `badge_type`, `icon`, `color`, `awarded_at` — no org_id (FK-scoped)

### 4.4 Contests

#### active_contests
- `organization_id` FK, `name`, `kpi_key`, `status` (draft/active/completed/cancelled)
- `start_date`, `end_date`, `reward_type/value/description`, `winner_id` FK

#### contest_participants / contest_leaderboards
- No org_id column — scoped via contest FK in RLS

### 4.5 Coaching

#### coaching_plans
- `organization_id` FK, `name`, `created_by` FK, `plan_type` (auto/custom)
- `goals` (text[]), `focus_kpis` (text[]), `action_items` (text[]), `success_metrics` (text[])
- `assigned_to` (uuid[]), `team_id` FK, `date_range_start/end`

#### coaching_plan_assignments
- `plan_id` FK, `assigned_to` FK → profiles, `status` (active/in_progress/completed/cancelled)

#### individual_development_plans
- `organization_id` FK, `profile_id` FK, `name`, `plan_type`, `status`
- `career_goals`, `milestones`, `action_items`, `resources`, `success_criteria` (all jsonb)

#### performance_reviews
- `organization_id` FK, `profile_id` FK (rep), `manager_id` FK
- `review_type` (mid_year/annual), `status` (7-state machine: draft → pending_self_assessment → ... → completed)
- Auto-populated snapshots: `scorecard_summary`, `kpi_attainment`, `skillset_progress`, etc.
- Manager fields: `manager_summary`, `manager_rating`, etc.
- Rep fields: `rep_self_assessment`, `rep_accomplishments`, etc.
- `final_rating` (1-5)

### 4.6 Engage (Signal Prospecting)

#### engage_companies
- `organization_id` FK, `name`, `domain`, `industry`, `tech_stack` (jsonb), `funding_data` (jsonb)
- `enriched_at` (timestamptz — last enrichment run), `raw_enrichment_data` (jsonb — merged Apollo+PDL snapshot for 7-day cache)

#### engage_enrichment_log
- `organization_id` FK, `domain`, `prospect_email`, `enrichment_type` (company/person/phone_batch)
- `provider` (apollo/pdl/hunter/tavily), `hit` (boolean), `fields_filled` (text[]), `error_message`
- `from_cache` (boolean), `created_at` — per-call log for cost tracking and ROI analysis

#### engage_prospects
- `organization_id` FK, `company_id` FK, `first_name`, `last_name`, `email`, `title`
- `fit_score`, `intent_score`, `status`, `owner_id` FK → profiles

#### engage_accounts
- `organization_id` FK, `company_id` FK, `account_score`, `intent_score`, `engagement_score`
- `tier` (tier_1/tier_2/tier_3/untiered), `buying_stage`, `readiness_score`, `signal_velocity`

#### engage_intent_signals
- `organization_id` FK, `signal_type` (maps to signal_key), `signal_score`, `signal_strength`
- `signal_tier` (tier1/tier2/tier3), `respond_by` (timestamptz — SLA window)
- `ai_summary`, `ai_recommended_action`, `ai_outreach_angle`

#### engage_signal_definitions (global library — 47 signals)
- `signal_key` (unique), `signal_name`, `category` (buyer_intent/interest/company_event/universal)
- `default_score`, `default_strength`, `is_universal`

#### engage_org_signal_configs (per-org overrides)
- `organization_id` FK, `signal_definition_id` FK (nullable = custom signal)
- `score_override`, `strength_override`, `is_enabled`

#### engage_signal_actions (AI outreach queue)
- `signal_id` FK, **`org_id`** FK (NOT organization_id), `profile_id` FK
- `draft_email_subject/body`, `draft_linkedin_message`, `status` (pending/approved/sent/dismissed)

#### engage_pipeline_deals
- `organization_id` FK, `owner_id` FK, `deal_name`, `deal_value`, `stage`, `probability`
- `cep_stage_id` FK → cep_stages, `close_date`, `forecast_category`

#### engage_sequences → engage_sequence_steps → engage_sequence_enrollments → engage_sequence_executions
Multi-step outreach sequence system.

### 4.7 Notifications

#### notifications (29+ types)
- `profile_id` FK, `type` (notification_type enum), `title`, `message`
- `metadata` (jsonb — pending migration, for structured notification data like competitive briefs)
- `dedupe_key` (unique — prevents duplicates), `priority`, `is_read`, `expires_at`
- Types include: achievement_earned, level_up, badge_earned, contest_started/winner, scorecard_high/low, coaching_suggestion, kpi_anomaly, signal_action_queued, follow_up_ready, competitive_brief, idp_auto_drafted, etc.

### 4.8 Integrations

#### integrations
- `organization_id` FK, `profile_id` FK (nullable = org-level vs personal)
- `integration_type` (10 providers), `credentials` (jsonb — AES-256-GCM encrypted)
- `field_mappings` (jsonb), `sync_config` (jsonb), `last_sync_at/status/error`

#### cep_stages (Customer Engagement Process)
- `organization_id` FK, `stage_key`, `stage_name`, `stage_order`, `cep_type`
- `checklist_items`, `exit_criteria`, `role_responsibilities` (all jsonb)

### 4.9 Other Tables
- `aaron_rep_memory` — per-rep chatbot learning (**user_id**, not profile_id)
- `aaron_conversation_threads` — persistent chat threads (Pro+): messages jsonb, thread_name, last_active_at
- `aaron_coaching_actions` — coaching actions logged from Aaron chat: action_type, action_label, crm_push_status, source_framework
- `feature_gate_hits` — logs when users hit Pro feature gates (for upgrade trigger analysis)
- `scheduled_reports` — automated email reports
- `prompt_templates` — AI prompt library (org_id nullable = global)
- `kpi_import_jobs` — CSV import audit trail
- `webhook_events` — inbound webhook event log
- `demo_requests` — public demo form submissions
- `invitations` — pending user invitations

### 4.10 Column Naming Inconsistencies

| Pattern | Tables Using Variant |
|---------|---------------------|
| **org_id** (not organization_id) | engage_signal_actions, kpi_benchmarks |
| **user_id** (not profile_id) | engage_call_logs, engage_activity_log, aaron_rep_memory, user_permission_overrides |
| **assigned_to** as uuid[] | coaching_plans |
| **assigned_to** as uuid FK | coaching_plan_assignments, engage_accounts |

### 4.11 Enum Types

| Enum | Values |
|------|--------|
| `subscription_plan` | Basic, Pro, Enterprise |
| `user_status` | active, inactive |
| `contest_status` | draft, active, completed, cancelled |
| `department_enum` | Sales, Marketing, Customer Success, Product, Engineering |
| `segment_enum` | Territory, Mid-Market, Enterprise |
| `notification_type` | 29 values (see Section 4.7) |

### 4.12 Key Database Functions

| Function | Purpose |
|----------|---------|
| `auth_user_org_id()` | Returns current user's organization_id (SECURITY DEFINER) |
| `auth_user_role()` | Returns current user's role |
| `award_achievement()` | Awards achievement + points, updates skillsets and level |
| `calculate_skillset_progress()` | Recalculates skillset progress for a profile |
| `update_contest_leaderboards()` | Recalculates all active contest rankings |
| `create_notification()` | Creates notification with dedup check |
| `fn_kpi_org_config_history()` | Auto-tracks per-org KPI config changes (trigger) |

### 4.13 RLS Security Model

Three patterns:
1. **Direct org_id**: `USING (organization_id = auth_user_org_id())` — most tables
2. **FK via profile_id**: subquery through profiles for tables without org_id (profile_achievements, profile_badges, notifications)
3. **FK via contest_id**: contest_participants, contest_leaderboards scope via contest FK

Global data tables allow NULL organization_id for system records.

---

## 5. API Endpoints (199 total)

### Auth & Onboarding (4)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Self-service signup (rate limited 5/hr) |
| POST | `/api/auth/ensure-profile` | Ensure profile for OAuth users |
| POST | `/api/onboarding/link-org` | Link user to org during onboarding |
| POST | `/api/onboarding/save-kpis` | Save KPI goals during onboarding |

### Billing / Stripe (6)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/subscription` | Current subscription info |
| POST | `/api/billing/checkout` | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Create Stripe Customer Portal session |
| POST | `/api/billing/webhook` | Stripe webhook handler |
| GET | `/api/billing/can-add-user` | Check seat availability |
| POST | `/api/billing/update-seats` | Update subscription seat count |

### AI / Claude (5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai-draft` | AI draft for coaching plan fields |
| POST | `/api/ai/coaching-plan` | Full AI coaching plan generation |
| POST | `/api/ai/idp-plan` | AI IDP generation |
| POST | `/api/ai/review-draft` | AI performance review draft |
| DELETE | `/api/aaron/memory` | Clear Aaron rep memory |
| GET | `/api/aaron/threads` | List user's conversation threads (last 10) |
| POST | `/api/aaron/threads` | Create new conversation thread |
| GET | `/api/aaron/threads/:id` | Fetch thread messages (last 60) |
| DELETE | `/api/aaron/threads/:id` | Delete a conversation thread |
| PATCH | `/api/aaron/threads/:id/name` | Rename a conversation thread |
| POST | `/api/aaron/coaching-action` | Log coaching action from Aaron chat (Haiku label extraction, CRM push) |
| GET | `/api/aaron/coaching-actions` | List coaching actions (with rep filter for managers) |
| PATCH | `/api/org/slack-webhook` | Set org-level Slack webhook (admin only) |
| GET | `/api/analytics/benchmarks-summary` | Pro-tier peer benchmarks (min 2 orgs, anonymized ranges) |

### Email / Communication (4)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send-coaching-plan` | Send coaching plan email |
| POST | `/api/send-contest-results` | Send contest results email |
| POST | `/api/send-snapshot` | Send scorecard snapshot email |
| GET | `/api/email-status` | SMTP health check |

### Scheduled Reports (5)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH/DELETE | `/api/scheduled-reports` | CRUD for scheduled reports |
| POST | `/api/scheduled-reports/:id/send-now` | Immediate send |

### Engage — Discover/Research (8)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engage/search/prospects` | Apollo people search |
| POST | `/api/engage/search/companies` | Apollo company search |
| POST | `/api/engage/search/people-at-company` | Find people at company by domain |
| POST | `/api/engage/search/suggested-contacts` | Top 5 contacts at company |
| POST | `/api/engage/search/organizations` | Company disambiguation |
| POST | `/api/engage/research/company` | Full company research (Apollo + PDL merge + Tavily + Claude) with 7-day cache, `force_refresh` bypass, sufficiency checker, and enrichment logging |
| POST | `/api/engage/research/prospect` | Full prospect research pipeline |
| POST | `/api/engage/search/web` | AI web search via Tavily |

### Engage — Outreach & Intelligence (5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engage/outreach/draft` | AI outreach draft (email/LinkedIn) — supports template prompt overrides + multi-angle (4-draft) generation |
| GET | `/api/engage/status` | External provider health check |
| POST | `/api/engage/pipeline/forecast` | AI pipeline forecast (SSE streaming) |
| POST | `/api/engage/calls/analyze` | AI call analysis |
| POST | `/api/engage/playbooks/generate` | AI playbook generation |

### Engage — Signal Prospecting (5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engage/signals/scan` | Full signal scan (Apollo + Tavily + SEC + Claude) |
| POST | `/api/engage/watchdog/analyze` | KPI Watchdog AI analysis |
| POST | `/api/engage/accounts/analyze` | Account Intelligence AI analysis |
| POST | `/api/engage/accounts/score` | Bulk account scoring (up to 20) |
| POST | `/api/engage/signals/:id/outcome` | Record signal outcome |

### Engage — Action Queue (3)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/engage/action-queue` | List pending action queue items |
| POST | `/api/engage/action-queue/:id/approve` | Approve queued action |
| POST | `/api/engage/action-queue/:id/dismiss` | Dismiss queued action |

### Engage — Deal Risk & Manual Triggers (5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engage/deals/check-risk` | Manual deal risk scan |
| POST | `/api/engage/signals/trigger-scan` | Manual signal scan trigger |
| POST | `/api/engage/scorecard/trigger-alerts` | Manual scorecard alerts |
| POST | `/api/achievements/check-and-award` | Manual achievement check |
| POST | `/api/badges/check-and-award` | Manual badge auto-award |

### Website Visitor Tracking (2)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/track/visit` | Track visitor via `visitor_tracking_key` (public UUID, never exposes org ID). IP → company via IPInfo. Check-then-upsert for page_views increment. |
| GET | `/api/track/visitors` | List recent visitors (7 days) |

### Twilio Click-to-Call (2)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engage/calls/token` | Generate Twilio Voice SDK token |
| POST | `/api/engage/calls/twiml` | TwiML webhook for call setup |

### Webhooks (2)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/outreach` | Outreach.io webhook (HMAC-SHA256) |
| POST | `/api/webhooks/:provider` | Generic integration webhook |

### Integration Framework (16)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations` | List org integrations |
| GET | `/api/integrations/templates` | List mapping templates |
| GET/POST/DELETE | `/api/integrations/my` | Personal integration CRUD |
| GET/POST/PATCH/DELETE | `/api/integrations/:id` | Org integration CRUD |
| GET | `/api/integrations/oauth/:provider/init` | Start org OAuth flow |
| GET | `/api/integrations/oauth/:provider/callback` | OAuth callback |
| GET | `/api/integrations/oauth/:provider/init-personal` | Start personal OAuth flow |
| POST | `/api/integrations/:id/sync` | Trigger on-demand sync |
| GET | `/api/integrations/:id/sync-history` | Sync history |
| POST | `/api/integrations/:id/backfill` | Trigger historical backfill |
| GET/POST | `/api/integrations/:id/calendar/events` | Calendar event CRUD |

### User Management (2)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users/invite` | Invite users (magic link) |
| POST | `/api/users/resend-invite` | Resend invite email |

### Pilot & Analytics (2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pilot/adoption-signals` | Planera pilot validation — coaching, outreach, IDP adoption metrics |
| GET | `/api/analytics/cross-org-benchmarks` | Enterprise-gated cross-org KPI benchmarks (3-org minimum for de-anonymization) |

### Other (5)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reviews/:id/transition` | Review state machine transition |
| POST | `/api/kpi/import` | CSV KPI import |
| POST | `/api/contact/demo-request` | Public demo request |
| POST | `/api/contests/refresh-leaderboards` | Manual contest leaderboard refresh |
| GET | `/` | Health check |

---

## 6. Cron Jobs (25 total)

| Job | Interval | Description |
|-----|----------|-------------|
| `deal-risk` | 24h | Scan for inactive high-value deals, notify owners |
| `signal-scan` | 24h | Per-org signal detection → auto-qualification → action queue (tier-aware cooldown: 20h tier1, 6d default). p-limit(5) concurrency cap on Tavily queries. |
| `scorecard-alerts` | 7d | Score vs prior week → coaching_suggestion / improvement_opportunity / top_performer notifications |
| `contest-complete` | 24h | Transition contest status (upcoming→active→completed), set winner, award badge. Dedup via `winner_finalized_at` timestamp. |
| `kpi-anomaly` | 7d | Org-scoped via `kpi_org_configs` join. Direction-aware attainment (lower-is-better KPIs). Rolling 4-week averages → warning (-30%) and critical (-50%) anomaly notifications. Startup threshold validation. |
| `scheduled-reports` | 24h | Send reports past next_scheduled_at, update schedule |
| `achievement-check` | 24h | Evaluate all achievements, award via DB RPC, fire notifications, then run badge auto-award |
| `coaching-nudges` | 7d | Detect Tier 1 KPIs below 80% for 2+ consecutive weeks → manager notification + IDP auto-draft (3+ weeks). Delivers via `deliverNudge()` (email/slack/in_app). |
| `follow-up-nudges` | 24h | Detect stale approved/sent signal actions (7+ days) → AI follow-up drafts via Haiku |
| `leaderboard-refresh` | 6h | Recalculate all active contest leaderboards |
| `integration-sync` | 30m | Run scheduled syncs for all connected integrations (reduced from 6h for Planera pilot near-real-time feedback) |
| `competitive-intel` | 7d | Tavily web search for competitor signals → Haiku brief → competitive_brief notification |
| `integration-push` | 15m | Process push queue for CRM write-back |
| `sequence-execution` | 1h | Execute pending sequence steps for enrolled prospects |
| `upgrade-triggers` | 24h | Check Basic-tier orgs for upgrade signals (Aaron limits, signal volume, team size, feature gates) → nudge notification |
| `notification-cleanup` | 24h | Clean up old read notifications to prevent table bloat |
| `trial-expiry` | 24h | Detect expiring trials, send reminder notifications, enforce trial-to-paid conversion gates |
| `outreach-style-memory` | 7d | Aggregate per-rep edit diffs and dismissal feedback into outreach style preferences for Engage drafting |
| `aaron-outcome-attribution` | 24h | Measure coaching recommendation outcomes at +14d/+30d/+60d windows against KPI baselines |
| `competitor-takedown-scan` | 24h | Tavily news scan for each org's competitor domains → surfaces Competitor Takedown signals with 48h SLA |
| `play-step-execution` | 1h | Execute due org playbook steps — automated coaching and engagement workflows |
| `pre-call-prep` | 1h | Auto-generate Aaron Pre-Call Prep cards for meetings starting within 60 minutes |
| `daily-briefing-notify` | 24h | Fire daily operating summary notification for reps with upcoming meetings or KPI anomalies |
| `onboarding-drip` | 24h | Send onboarding drip emails based on user signup date and engagement milestones |
| `signal-auto-archive` | 24h | Archive signals with status='new' older than 14 days → status='archived' |

All jobs use CronManager with overlap guards (prevents concurrent runs) + stale guard safety valve (force-clears jobs running > 2× interval).

---

## 7. Aaron AI Chatbot

### Architecture
- **Model:** Claude Sonnet 4.6 (max_tokens: 800, 30-msg history, 60-msg cap)
- **Transport:** Socket.IO events (`chat_message` → `aaron_message`)
- **14 proprietary B2B sales coaching frameworks**
- **Framework detection:** `detectFrameworks()` — keyword + preset scoring → top 3 per message
- **Preset framework map:** 10+ presets including RevOps View, CRO Dashboard, Manager Dashboard, Pipeline Health
- **Context injection:** Sales DNA, org info, ICP, CEP, live KPI data (60s cache), rep memory
- **Title-based coaching modes:** RevOps mode (revops/revenue operations titles), CRO/VP Sales mode (cro/chief revenue/vp sales titles)
- **Rep memory:** `aaron_rep_memory` table — summary, goals, challenges, strengths, preferences (updated every 5th message)
- **Thread persistence (Pro+):** `aaron_conversation_threads` table — jsonb messages, auto-naming via Haiku, debounced save (every 3 msgs + on disconnect), collapsible sidebar in chat panel
- **Coaching actions:** `aaron_coaching_actions` table — "Log Action" hover button on Aaron messages → Haiku label extraction → CRM push via `enqueuePush()`. "Aaron Actions" tab in CoachingPlans page.
- **Offline fallback:** 20+ regex patterns in AaronChatbot.jsx for local responses
- **Billing gate:** Basic plan = 10 msgs/day limit (per verified `socket.authUser.id`, prevents client-side userId spoofing). Limit hits persisted to `aaron_limit_hit_dates` jsonb for upgrade trigger analysis.
- **Upgrade prompts:** `UpgradePrompt.jsx` — 4 variants (aaron_limit/feature_gate/team_size/generic), 3 contexts (inline/modal/banner). Shown when daily limit reached in chat.
- **Message validation:** 4,000 character limit per message
- **Sales DNA cache:** `_salesDnaCache` with 5-min TTL per org (prevents repeated DB calls for org methodology)
- **Cache eviction:** 10-min interval clears stale live context (>120s), org context (>600s), Sales DNA (>300s), and previous-day limits
- **Tier 2 modes (shipped):** Mode 1 (Daily Operating — KPI summary + anomalies + pipeline alerts), Mode 2 (Pre-Call Prep — auto-generated 60min before meetings, structured card output), Mode 4 (Skill Builder — Sales Performance Pyramid diagnosis, 8 skill dimensions, practice loops with rubric scoring)
- **Tiered model routing:** Haiku for data lookups and label extraction, Sonnet for coaching and complex analysis — reduces per-message inference cost by 50-70%
- **Structured output cards:** 3 card renderers in AaronChatbot.jsx — PreCallPrepCard, SkillPracticeCard, DailyBriefingCard

### Frameworks
Messaging Equation, Winning Call Structure, Objection Handling, Discovery Execution, Value Selling, Negotiation, Time Management, Pipeline Management, Closing Techniques, Relationship Building, Social Selling, Territory Planning, Competitive Positioning, Account Planning

---

## 8. Middleware & Security

| Middleware | Description |
|-----------|-------------|
| `requireAuth` | Verify Supabase JWT (Bearer or query param) |
| `loadProfile` | Fetch caller's profile with org join (id, role, secondary_role, organization_id, subscription_plan, subscription_status, trial_ends_at) — single query, no extra DB call for tier checks |
| `requireMinRole(role)` | Role hierarchy: admin(4) > manager(3) > coach(2) > power_user(1) |
| `requireTier(tier)` | Reads from `req.userProfile` (no DB call). Blocks `canceled`/`expired` with 402. Adds `X-Billing-Warning` header for `past_due`. Lazy trial expiry detection. |
| `requireFeature(feature)` | Feature gate per subscription tier |
| `generalLimiter` | 200 req / 15 min per IP |
| `aiLimiter` | 20 req / 5 min per user |
| `signupLimiter` | 5 req / 1 hour per IP |
| `trackLimiter` | 600 req / 1 min (silent drop) |
| `withDedup(name, fn)` | Prevent concurrent manual + cron runs |
| Process crash handlers | `uncaughtException` + `unhandledRejection` — log and exit(1) |

---

## 9. Business Model

### Pricing
| Tier | Price | Key Features |
|------|-------|-------------|
| **Starter** | $19/seat/month | Scorecard, basic coaching, 5 KPIs, 1 team, email support |
| **Pro** | $49/seat/month | Full coaching suite, Engage, contests, wallboard, all integrations, Aaron AI, RevOps analytics |
| **Enterprise** | Custom | SSO, custom integrations, dedicated support, unlimited everything, RevOps analytics, cross-org benchmarks |

### Revenue Projections
- Year 1: $163K ARR
- Year 2: $960K ARR
- Year 3: $4.05M ARR

### GTM Strategy
- PLG-first (no sales team initially)
- 14-day free Pro trial on signup
- Content: Reddit → SEO playbook, LinkedIn engagement funnel
- Positioning: "Productized RevOps" replacing $200K hire

---

## 10. Roles & Permissions

### 4 Roles (hierarchy)
1. **admin** (4) — full access, org settings, billing, integrations, user management
2. **manager** (3) — team management, coaching plans, contests, reports
3. **coach** (2) — coaching tools, limited team visibility
4. **power_user** (1) — individual scorecard, self-coaching, Engage basic

### 14 Permissions
view_scorecard, configure_scorecard, export_data, manage_teams, manage_team_members, create_contests, edit_contests, manage_permissions, view_analytics, manage_coaching_plans, manage_integrations, manage_badges, view_engage, manage_engage

Per-user overrides stored in `user_permission_overrides` table.

---

## 11. Progression System

### 5 Apptivia Levels
| Level | Points Required |
|-------|----------------|
| Developing | 0 – 999 |
| Intermediate | 1,000 – 2,499 |
| Proficient | 2,500 – 4,999 |
| Elite | 5,000 – 9,999 |
| Master | 10,000+ |

### 7 Skillsets
Conversationalist, Call Conqueror, Email Warrior, Pipeline Guru, Task Master, Scorecard Master, Engage Pro

Each skillset maps to specific KPIs and has achievements at various thresholds.

### Badges
Categories: Volume (17), Achievement Milestones (5), Revenue (5), Scorecard Excellence (5), Improvement (2), Contest Winner, Custom

---

## 12. Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Authenticate with Supabase JWT, join user room |
| `chat_message` | Client → Server | Send message to Aaron AI |
| `aaron_typing` | Server → Client | Typing indicator |
| `aaron_message` | Server → Client | Aaron's response with framework badges |

---

## 13. Key Architectural Decisions

1. **Monolith backend** — single server.js file (~7,520 lines). Works for current scale, consider splitting when adding more developers.
2. **Supabase for everything** — auth, database, RLS, realtime, edge functions. Reduces infrastructure complexity.
3. **Organization-scoped multi-tenancy** — every query filtered by organization_id via RLS. No data leaks between orgs.
4. **KPI config history** — point-in-time tracking of goal/weight changes so historical scores compute correctly.
5. **CronManager with overlap guards** — prevents duplicate cron runs. All jobs have initial delay offsets. Stale guard safety valve force-clears jobs running > 2× interval.
6. **AES-256-GCM integration credentials** — encrypted at rest, decrypted only during sync/OAuth refresh.
7. **Role hierarchy with secondary_role** — `Math.max(primary, secondary)` for effective role, enabling dual roles.
8. **CEP (Customer Engagement Process)** — configurable sales stages per org, replacing hardcoded pipeline stages.
9. **Sales DNA** — per-org methodology and qualification framework injected into AI prompts for org-aware coaching.
10. **Signal Tier System** — 3-tier classification (tier1/tier2/tier3) based on signal_type first, score fallback. Tier1 types: 8 hiring signals (sdr_manager_posting, bdr_manager_posting, revops_posting, etc.). Tier2 types: 7 company event signals (funding, growth, etc.). Tier-aware cooldowns (20h tier1, 6d default) and SLA response windows (24h/168h/null).
11. **Shared computeWeightedScore()** — single function for weighted KPI score calculation used by scorecard-alerts, badge-auto-award, and achievement-check crons. Eliminates 3 duplicate implementations.
12. **IDP auto-draft** — coaching-nudges cron triggers Haiku to generate IDP when rep below 80% for 3+ consecutive weeks. Stored as `pending_review` for manager approval.
13. **Messaging Equation Framework** — Persona + Trigger/Challenge/Priority + Specific Solution Component + Result = outreach draft prompt structure for AI-generated signal actions.
14. **Competitive Intelligence agent** — weekly Tavily web search for competitor signals, Haiku generates actionable brief, delivered as notification with metadata.
15. **Follow-up nudge agent** — daily scan for stale approved/sent signal actions (7+ days), generates context-aware follow-up drafts via Haiku.
16. **Aaron cache eviction** — 10-min interval clears stale live context, org context, and previous-day limits to prevent memory leaks.
17. **Process crash handlers** — `uncaughtException` and `unhandledRejection` log the error and exit(1), preventing silent failures.
18. **Batch badge inserts** — `collectBadge()` accumulates qualifying badges, then a single batch `INSERT` + batch notification insert replaces per-badge DB calls. `awardBadge()` is a backward-compatible wrapper.
19. **Batch level-up check** — level-up detection moved from per-rep inner loop to post-loop batch `SELECT` + diff against pre-loop levels.
20. **Route-specific raw body** — Stripe webhook uses `express.raw({ type: 'application/json' })` on `/api/billing/webhook` only. Global `express.json()` has no rawBody buffering overhead.
21. **Twilio signature validation** — TwiML endpoint validates `x-twilio-signature` via `twilio.validateRequest()` when `TWILIO_AUTH_TOKEN` is set. Rejects forged requests with 403.
22. **link-org re-assignment guard** — prevents org re-linking with 409 if profile already has an organization_id.
23. **Visitor tracking key** — public `visitor_tracking_key` (UUID) on organizations table. Embed snippet never exposes the real `organization_id`.
24. **Contest winner dedup** — `winner_finalized_at` timestamp column prevents double-awarding on cron re-runs, replacing notification-based dedup.
25. **p-limit(5) signal concurrency** — Tavily web queries capped at 5 concurrent companies per scan to prevent API rate limiting and resource exhaustion.
26. **Save-kpis batch upsert** — replaced destructive pre-clear + sequential inserts with single `upsert()` on `kpi_org_configs` (conflict: `organization_id, kpi_id`).
27. **Provider module pattern** — 10 provider modules in `providers/` directory auto-loaded at startup. Each exports a standard interface (`type`, `getAuthUrl`, `exchangeCode`, `refreshToken`, `sync`, `kpiMap`, `mapWebhookEvent`, `verifyWebhook`). Sync functions accept `(integration, cursor, sb)` — Supabase client passed through from `integrationService.runSync()`. KPI mappings include `source` (provider name) and `weekStart` (Monday ISO date) for dedup and time-bucketing. `externalEventId` pattern: `'provider:entity:id:kpikey'` prevents double-counting across syncs.
28. **Personal vs org-level integrations** — Personal integrations (Apollo, Google Calendar, Microsoft Outlook) use `integration.profile_id` directly for KPI attribution. Org-level integrations (Salesforce, HubSpot, etc.) use `resolveProfileByEmail(sb, orgId, email)` to map external user emails to Apptivia profiles. Personal OAuth init endpoint redirects to OAuth provider (not JSON response).

---

## 14. Current State & Known Gaps

### Completed
- Full scorecard with configurable KPIs, org-scoped
- Coaching suite (plans, IDPs, reviews, playbooks, 1:1 prep)
- Engage (signal prospecting, discover, accounts, pipeline)
- Gamification (achievements, skillsets, badges, levels)
- Contests with leaderboards
- Wallboard (8 slides)
- Aaron AI chatbot (14 frameworks, rep memory, RevOps/CRO coaching modes, Tier 2 modes: Daily Operating, Pre-Call Prep, Skill Builder)
- 10 integration providers (7 org-level + 3 personal) with standardized sync, webhook, and KPI mapping
- Stripe billing with 3 tiers + feature gates (revops_analytics, cross_org_benchmarks)
- 9-step onboarding wizard
- Org health scorecard
- KPI Watchdog anomaly detection
- 25 automated cron jobs (including follow-up nudges, competitive intel, integration-push, sequence-execution, pre-call prep, aaron outcome attribution, style memory, daily briefing, signal auto-archive, onboarding drip, play-step execution, notification cleanup)
- Website visitor tracking
- Twilio click-to-call
- CSV import for KPIs and users
- PDF/CSV export for all pages
- Signal tier system (3-tier classification with SLA response windows)
- Cross-org benchmarking (Enterprise 3-org minimum + Pro 2-org summary via `fetchPeerBenchmarks` shared helper)
- IDP auto-draft (Haiku generates IDP when rep below 80% for 3+ weeks)
- Competitive intelligence agent (weekly Tavily search + Haiku brief)
- Follow-up nudge agent (daily stale action detection + AI follow-up drafts)
- Pilot adoption signals endpoint (Planera validation metrics)
- Messaging Equation framework for AI outreach prompts
- 42-fix server.js audit (April 14, 2026): model IDs, notification profile_id, Stripe seat sync, subscription lifecycle, batch KPI upsert, Twilio sig validation, org-scoped KPI anomaly, direction-aware attainment, loadProfile org join, requireTier optimization, Sales DNA cache, Aaron verified userId, edge function timeout, visitor page_views increment, safe email lookup, try-catch coverage, batch badge inserts, batch level-up check, route-specific raw body, startup threshold validation, p-limit concurrency, visitor tracking key, contest winner dedup
- CRM bidirectional sync (April 14, 2026): push queue + entity mapping + audit trail (migration 127), enqueuePush/processPushQueue engine in integrationService.js, 15-min push cron, exponential backoff retries, event triggers (deal_risk, achievement_earned, coaching_plan_assigned), 3 API endpoints (manual push, push-history, push-queue)
- Org-scoping complete (April 14, 2026): migration 126 adds organization_id NOT NULL to profile_badges/profile_achievements/profile_skillsets with backfill + direct RLS policies, award_achievement() function updated, all badge INSERTs include org_id (server.js + contestUtils.ts + Profile.jsx)
- Multi-step sequence execution engine (April 14, 2026): 7 CRUD endpoints, calculateNextStepTime (send windows + weekend skip), hourly runSequenceExecution cron, reply detection via webhook, channel routing (email→sendEmail, outreach→push queue, call/task→pending), SequenceBuilder.jsx frontend component, Sequences tab in Engage
- Aaron persistent threads (April 14, 2026): `aaron_conversation_threads` table (migration 131), 5 CRUD endpoints, Socket.IO thread persistence with debounced save, auto-naming via Haiku, collapsible sidebar in Aaron chat (Pro+ only)
- Multi-channel nudge delivery (April 14, 2026): `deliverNudge()` helper (in_app/email/slack/email_and_slack), `buildNudgeEmailHtml()` template, `nudge_channel`/`slack_webhook_url` on profiles (migration 132), org-level `slack_webhook_url` on organizations, Profile "Notifications" tab
- Upgrade trigger automation (April 14, 2026): `checkUpgradeTriggers()` daily cron (4 triggers: Aaron limit hits, signal volume, team size, feature gate 403s), `feature_gate_hits` table (migration 133), `aaron_limit_hit_dates` jsonb on profiles (migration 134), `UpgradePrompt.jsx` component (4 variants × 3 contexts), `requireFeature()` logging
- Pro-tier benchmarks summary (April 14, 2026): `GET /api/analytics/benchmarks-summary` (min 2 orgs), `fetchPeerBenchmarks()` shared helper, Analytics "Benchmarks" tab with blurred upsell for Basic users
- CRM write-back on coaching actions (April 14, 2026): `aaron_coaching_actions` table (migration 135), `POST /api/aaron/coaching-action` (Haiku label extraction + `enqueuePush()`), "Log Action" hover button in Aaron chat, "Aaron Actions" tab in CoachingPlans page
- Provider build spec (April 15, 2026): 10 provider modules in `providers/` directory with standardized interface. `integrationService.js` passes `sb` (Supabase client) to all sync functions. All kpiMappings include `source` and `weekStart` fields. 3 personal integrations (Apollo API key, Google Calendar OAuth, Microsoft Outlook OAuth) use `profile_id` directly. 7 org-level providers (Salesforce, HubSpot, Gong, SalesLoft, Outreach, Marketo, Sendoso) use `resolveProfileByEmail(sb, orgId, email)`. Webhook support with HMAC verification on all providers. `getWeekStart()` helper standardized across all modules.
- KPI canonical translation layer (April 16, 2026 → expanded April 21, 2026): `providers/kpiCanonical.js` — 35 canonical KPI definitions (expanded from 22) with unit transformers (`fromSeconds`, `fromMilliseconds`, `fromRatio`, `fromPercent`, `fromDollars`, `fromCents`, `fromCount`, `fromBoolean`, `fromScore`, `fromDays`, `fromMinutes`) and 4 aggregation modes (`sum`, `avg`, `max`, `set`). `buildKpiMapping()` replaces all inline unit conversion in providers. `getWeekStart()` consolidated from 10 duplicate implementations. `upsertKpiValue()` expanded with `avg` (rolling average via `sample_count`), `max`, and `set` (direct value upsert for derived KPIs) aggregation. Migration 138 adds `sample_count` column. Migrations 149-150 add sum-mode dedup via `processed_event_ids` JSONB array. Contract tests: 74/74 passing (`providers/__tests__/kpiContract.test.js`).
- Apollo comprehensive CRM sync (April 16, 2026 → expanded April 21, 2026): Apollo refactored from 2 KPIs / 1 entity to 20 KPIs / 6 entities (calls, emails, opportunities, conversations, sequences, tasks). Verified field names from production API: `duration` (seconds), `status: "completed"`, `logged: true`, `X-Api-Key` header auth. Call intelligence KPIs: talk_to_listen_ratio, longest_monologue_sec, questions_asked, next_steps_mentioned, interactivity_score. New KPIs added: dials (all calls), conversations (conversation records), sequences_started (unique campaigns), pipeline_created (opp amounts), sales_cycle_days (won deals). Graceful 403 handling for plan-gated endpoints.
- Circular dependency fix (April 16, 2026): Moved `module.exports` assignment in `integrationService.js` BEFORE the auto-register providers block. Previously providers were loaded before exports were assigned, causing "non-existent property 'fetchJson'" warnings. All 7 providers with `fetchJson` also moved to lazy imports inside helper functions.
- Integration sync frequency (April 16, 2026): Reduced from 1 hour (`ONE_HOUR`) to 30 minutes (`THIRTY_MIN`) for Planera pilot near-real-time scorecard feedback. Well within Apollo rate limits (48 calls/day vs 1000/hour limit).
- Analytics filters org-scoping fix (April 16, 2026): `ScorecardFilters` in Analytics page was missing `organizationId` prop — Teams and Team Members dropdowns showed all orgs. Fixed by passing `orgId` to the component.
- Scorecard table alignment fix (April 16, 2026): `<td>` element on line 1627 of `ApptiviaScorecard.tsx` had `flex items-center gap-1` directly on the cell, breaking table row alignment. Moved flex to inner `<div>`. Added `table-fixed` to both scorecard tables for consistent column widths. Added `truncate` on name buttons to prevent column blowout.
- Apollo KPI `updated_at` bug fix (April 16, 2026): `upsertKpiValue()` in `integrationService.js` included `updated_at: new Date().toISOString()` in all 3 UPDATE modes (sum, max, avg), but `kpi_values` has NO `updated_at` column. PostgREST silently rejected all UPDATEs, so KPI values never incremented past the initial INSERT. Removed `updated_at` from all UPDATE calls.
- Migration 139 — org structural definitions (April 16, 2026): Seeds 7 skillsets, ~150 achievement definitions, ~40 badge definitions from Apptivia Test Org to all orgs with zero skillsets. Fixes UNIQUE constraints to be org-scoped: `skillsets(name, organization_id)`, `badge_definitions(badge_name, organization_id)`. Construction Test Org (and future orgs) now have the structural foundation for the gamification system — achievements/badges earned through real activity, never seeded.
- Coaching Opportunities removed from Scorecard (April 16, 2026): Removed entire "Coaching Opportunities" section from `ApptiviaScorecard.tsx` (~250 lines). Section used a 30-day fixed window with `numWeeks = 30/7` divisor that artificially diluted new users' metrics (e.g. 3% talk time → 1%). Coaching insights belong on the Coach page, not the Scorecard. Removed: JSX section, `fetchCoachingWindow` useEffect, `coachingOpportunities` useMemo, `coachSkillsetsByName`, `buildCoachLink`, `openCoachForKpi`, related state and imports (`useCoachData`, `KPI_GUIDANCE`, `FeedbackThumb`, `SKILLSET_KPI_MAP`).
- Tooltip clipping fix (April 16, 2026): Coach page "Avg Score" tooltip was clipped by left sidebar due to `overflow-x-hidden` on DashboardLayout main content div. Changed tooltip position from `"bottom"` to `"right"` in `Coach.jsx:1099`.
- Integration hardening 7-fix audit (April 21, 2026): 7 fixes across Salesforce, Apollo, and HubSpot providers. Fix 1: HubSpot null-body crash guard (empty call records). Fix 2: Salesforce SystemModstamp cursor fix (was using ActivityDate, missing re-synced records). Fix 3: Apollo conversations syncCursor initialization. Fix 4: HubSpot meeting attendee resolution (was using `hs_attendee_owner_ids` which is null — switched to `hs_internal_meeting_notes` owner lookup). Fix 5: Apollo email ownership attribution (filter to `email_account.user_id` match). Fix 6: Salesforce SOQL field list validation (removed CallDurationInSeconds from Task queries — field doesn't exist on Task). Fix 7: HubSpot deal pipeline/stage dedup (skip non-pipeline deals, deduplicate by dealId).
- KPI wiring — 12 new KPIs (April 21, 2026): Wired 10 direct-emission KPIs + 2 derived KPIs from existing Apollo/SF/HS integrations. New direct KPIs: `dials` (all calls regardless of status), `conversations` (Apollo conversation records), `sequences_started` (unique Apollo campaign IDs), `pipeline_created` ($ on new opps), `sales_cycle_days` (close - create date for won deals), `follow_ups` (SF non-call/email tasks), `demos_completed` (meetings with "demo" in subject), `discovery_calls` (calls/meetings with "discovery" in subject). New derived KPIs: `win_rate` (closed_won/sourced_opps * 100), `average_deal_size` (revenue/closed_won). Total canonical KPIs: 35 (was 22). Derived KPIs computed post-sync via `computeDerivedKpis()` in integrationService.js. Heuristic KPIs (demos/discovery) use regex subject matching.
- Sum-mode dedup fix (April 21, 2026): Migration 149 adds `processed_event_ids` JSONB array to `kpi_values` for tracking ALL event IDs aggregated into each sum row. `upsert_kpi_sum()` RPC checks this array before incrementing, making re-syncs idempotent. Backfills existing rows. Migration 150 changes return type from VOID to BOOLEAN for observability (TRUE = new event, FALSE = skipped duplicate).
- Salesforce broadened SOQL (April 21, 2026): Changed syncActivities query from `TaskSubtype IN ('Call', 'Email') AND Status = 'Completed'` to `(TaskSubtype = 'Call') OR (TaskSubtype = 'Email' AND Status = 'Completed')` — captures all calls (not just completed) for `dials` KPI. Added separate SOQL for `follow_ups` (non-call/email completed tasks).
- Aaron Tier 2 — Rep-Facing Daily Surface (April 25, 2026): Mode 1 (Daily Operating Mode — KPI summary, anomalies, pipeline alerts, coaching nudges), Mode 2 (Pre-Call Prep Mode — auto-generated 60min before meetings via calendar integration, renders structured prep cards), Mode 4 (Skill Builder Mode — Sales Performance Pyramid diagnosis with 8 skill dimensions, rubric scoring, practice loops). 2 new tables (`aaron_pre_call_prep_cards`, `aaron_skill_practice_logs`), 2 new crons (`pre-call-prep-generation` hourly, `daily-briefing-notification` daily), 4 new API endpoints, 3 structured output card renderers in AaronChatbot.jsx. Tiered model routing: Haiku for data lookups, Sonnet for coaching responses.
- Pipeline Operator CRM deal sync (April 26, 2026): All 3 CRM providers (Salesforce, Apollo, HubSpot) now insert deal records into `engage_pipeline_deals` during sync. `upsertDeal()` function in `integrationService.js` follows the `upsertCalendarEvent()` pattern. Migration 167 adds unique index on `(organization_id, source, external_id)` for upsert dedup. Regular (non-partial) index — PostgreSQL treats NULLs as distinct, so manual deals with NULL external_id don't conflict. Apollo lookback extended from 7 to 90 days to capture older deals.
- Contest leaderboard date filter fix (May 2026): Migration 168 fixes contest leaderboard date filtering edge case
- Contest secondary KPI support (May 2026): Migration 169 adds secondary KPI tracking for contests
- Action queue Gmail fields (May 2026): Migration 170 adds Gmail-specific fields to action queue
- Microsoft Calendar rename (May 2026): Migration 171 renames Microsoft Calendar to Outlook for consistency
- Profile email signature (May 2026): Migration 172 adds email signature field to profiles
- RLS and security definer fixes (May 2026): Migration 173 comprehensive RLS policy audit and security definer fixes
- Engage research persistence (May 2026): Migration 174 adds persistent storage for AI research results
- Calendar meeting outcomes (May 2026): Migration 175 tracks meeting outcomes (completed, cancelled, rescheduled)
- Deal management tables (May 2026): Migrations 176-177 add deal management infrastructure — junction tables, linking columns, account associations
- Call recording and presence (May 2026): Migration 178 adds call recording metadata and presence tracking
- ICP profiles (May 2026): Migration 179 adds `engage_icp_profiles` table for persona definitions
- Account page overhaul (May 2026): Migration 180 restructures account-level data for expanded Account Intelligence
- Notification action URL fix (May 2026): Migration 181 fixes notification action URL routing
- Website visitor RPC (May 2026): Migration 182 adds `upsert_website_visitor` RPC for idempotent visitor tracking
- Deal junction org scoping (May 2026): Migration 183 adds organization_id and RLS to deal junction tables
- Profile FK cascade fix (May 2026): Migration 184 fixes profile foreign key ON DELETE behavior
- Deal account consolidation (May 2026): Migration 185 consolidates deal-account ID references
- Super admin support (May 2026): Migration 186 adds super_admin role capabilities for cross-org management
- Global tasks system (May 2026): Migration 187 adds `global_tasks` table — task creation, assignment, tracking, priority, due dates
- Prospect tenure and influence scoring (May 2026): Migration 188 adds tenure_months and influence_score to engage_prospects
- Coaching effectiveness snapshots (May 2026): Migration 189 adds coaching plan effectiveness tracking snapshots
- Onboarding email drip system (May 2026): Migration 190 adds `onboarding_email_log` table for drip campaign tracking with dedup
- Org playbooks (May 2026): Migration 191 adds org-level playbook definitions and step execution tracking
- API keys management (May 2026): Migration 192 adds API key generation, storage, and rotation for org integrations
- External task sync (May 2026): Migration 193 adds external task sync infrastructure for CRM task bidirectional sync
- KPI org config history backfill (May 2026): Migration 194 backfills kpi_org_config_history for complete audit trail
- CRM activity records (May 2026): Migration 195 adds CRM activity record storage for detailed activity logging
- Deal qualification data (May 2026): Migration 196 adds deal qualification scoring data (MEDDPICC, BANT, etc.)
- Deal software-in-use tracking (May 2026): Migration 197 tracks software/tech stack associated with deals
- Task achievements expansion (May 2026): Migration 198 expands achievement definitions for task-based metrics
- Sequence clicked_at tracking (May 2026): Migration 199 adds click tracking timestamps for sequence emails
- Prospect secondary fields (May 2026): Migration 200 adds secondary contact fields (phone2, email2, LinkedIn, etc.)
- Cross-org contest participant cleanup (May 2026): Migration 201 removes orphaned contest participants from cross-org data leak
- Contest org-hardening (May 2026): Migration 202 cleans orphaned contest data, enables RLS on contest_participants and contest_leaderboards
- Research report save persistence (May 2026): Migration 203 adds saved_by_user boolean and saved_at timestamp to engage_research_reports
- Signal auto-archive (May 2026): Migration 204 adds 'archived' status to engage_intent_signals, creates partial index for cleanup queries
- Fit score enrichment writeback (May 2026): SavedBriefModal now writes fit_score, department, tenure_months, influence_score back to engage_prospects after research completes
- Notes race condition fix (May 2026): EngageContacts ContactDetailPanel uses onContactUpdate callback to sync notes state with parent, preventing stale read on contact switch
- Cross-tab deal navigation (May 2026): PipelineOperator accepts initialDealId prop for auto-selection when navigating from contact side panel
- Hunter email fallback (May 2026): engageService.js researchProspect() adds Hunter.io email fallback after PDL phone fallback
- Aaron model upgrade (May 2026): SONNET_MODEL updated from claude-sonnet-4-20250514 to claude-sonnet-4-6-20250514
- Signal auto-archive cron (May 2026): New runSignalAutoArchive() daily cron archives 'new' signals older than 14 days
- Dismiss stale signals (May 2026): useSignalProspecting.ts exposes dismissStaleSignals() function, SignalProspecting.jsx adds "Dismiss Stale" button
- Welcome email logging (May 2026): server.js logs welcome emails to onboarding_email_log table after sendWelcomeEmail()
- Coaching card/list view toggle (May 2026): IdpTab.jsx and ReviewTab.jsx support card and list view modes with localStorage persistence
- Brief save persistence (May 2026): SavedBriefModal save button persists saved_by_user and saved_at to DB instead of UI-only state
- Contest Add Members org-scoping fix (May 2026): AddTeamMembersModal.tsx accepts organizationId prop and filters profiles query by org

### Known Gaps
- ~~**Admins appear in scorecard**~~ — FIXED (useScorecardData.ts LEADERSHIP_ROLE_FILTER excludes admin/manager/coach)
- **Team-based achievements** — deferred to Coach phase
- **3 KPIs not yet wired** — `qualified_leads` (needs syncLeads handler), `pipeline_advanced` (needs stage-change history tracking), `response_time` (needs lead-to-first-activity timestamp correlation)
- **Gmail email sync** — Google Calendar integration exists (meetings only). No Gmail provider for tracking emails_sent. Planera pilot TBD based on workflow confirmation.
- **LinkedIn Sales Navigator** — No provider exists (LinkedIn API requires partnership approval). LinkedIn URLs populated via Apollo enrichment. UI references are display-only.

### Schema Warnings (Gap Analysis Wave 6)
- **kpi_values has NO organization_id column.** All queries must scope through `profiles.organization_id` JOIN. Never filter directly by org_id.
- **kpi_benchmarks uses `org_id`** (not `organization_id`). Use `org_id` in all queries against this table.
- **aaron_rep_memory uses `user_id`** — same UUID as `profiles.id` (Supabase auth). Column name differs, not a functional bug.
- **engage_signal_actions uses `organization_id`** (standard naming, not `org_id`).
- **aaron_token_logs table** — added in Gap Analysis Wave 3 for queryable AI cost analysis (user_id, org_id, model, tokens, intents).

---

## 15. Migration Summary

207 migrations (000–204 + diagnostic) applied. Recent additions:
- **121** `signal_tier_columns` — `signal_tier` (text) + `respond_by` (timestamptz) on engage_intent_signals, backfill by score
- **122** `idp_drafts` — new table for AI-auto-drafted IDPs (profile_id, manager_id, organization_id, draft_content jsonb, status, generated_by, trigger_reason, review fields, RLS)
- **123** `notifications_metadata` — `metadata` (jsonb) column + GIN index + 3 new notification_type enum values (competitive_brief, idp_auto_drafted, follow_up_ready)
- **124** `visitor_tracking_key` — `visitor_tracking_key` (UUID, default gen_random_uuid()) on organizations with unique index. Prevents exposing real org ID in embed snippets.
- **125** `contest_winner_finalized` — `winner_finalized_at` (timestamptz) on active_contests for cron dedup (prevents double-awarding winners)
- **126** `org_scope_badges_achievements_skillsets` — organization_id (NOT NULL) on profile_badges, profile_achievements, profile_skillsets + backfill + direct RLS policies + updated award_achievement() function
- **127** `integration_push_queue` — 3 tables: integration_push_queue (status lifecycle + retry), integration_entity_map (bidirectional ID mapping), integration_push_log (audit trail) with org-scoped RLS
- **128** `fix_multi_angle_template` — Updates multi-angle outreach strategy prompt to generate 4 complete, ready-to-send draft messages instead of strategy summaries
- **129** `add_enrichment_cache_to_engage_companies` — `enriched_at` (timestamptz) + `raw_enrichment_data` (jsonb) on engage_companies for 7-day enrichment cache + domain/enriched_at index
- **130** `create_enrichment_log` — `engage_enrichment_log` table for per-call provider tracking (org_id, domain, provider, hit, fields_filled, error_message, from_cache) with 3 indexes
- **131** `aaron_conversation_threads` — Persistent chat threads (Pro+): messages jsonb, thread_name, message_count, last_active_at, RLS (user-own + service_role)
- **132** `nudge_delivery_prefs` — `nudge_channel` (text, default 'in_app'), `slack_webhook_url` (text), `nudge_digest_mode` (boolean) on profiles + `slack_webhook_url` on organizations
- **133** `feature_gate_hits` — Table for logging Pro feature gate 403s: user_id, organization_id, feature, hit_at. Admin-only SELECT RLS + service_role bypass
- **134** `aaron_limit_hit_dates` — `aaron_limit_hit_dates` (jsonb, default '[]') on profiles for daily limit hit tracking (trimmed to last 30 dates)
- **135** `coaching_actions` — `aaron_coaching_actions` table: action_type, action_label, source_framework, crm_push_status, session_thread_id FK. User-own SELECT/INSERT RLS + service_role bypass
- **138** `kpi_values_sample_count` — `sample_count` (INTEGER, DEFAULT 1, NOT NULL) on kpi_values for rolling average aggregation support (used by avg-mode KPIs like talk_to_listen_ratio, interactivity_score)
- **139** `seed_org_structural_definitions` — Seeds skillsets (7), achievement definitions (~150 rules), and badge definitions (~40 templates) from Apptivia Test Org to all other orgs missing them. Fixes UNIQUE constraints on skillsets.name and badge_definitions.badge_name to be org-scoped (composite with organization_id). Idempotent — only seeds orgs with zero skillsets.
- **149** `kpi_sum_dedup` — Fixes sum-mode KPI dedup on re-sync. Adds `processed_event_ids` (JSONB, default '[]') to `kpi_values`. Backfills existing rows with their current `external_event_id`. Replaces `upsert_kpi_sum()` RPC with dedup-aware version that checks the array before incrementing.
- **150** `kpi_sum_dedup_observability` — Changes `upsert_kpi_sum()` return type from VOID to BOOLEAN. Returns TRUE for new events, FALSE for duplicate skips. Enables callers to log dedup behavior.
- **151** `org_trial_abuse_guard` — Trial abuse prevention constraints
- **152** `fix_orphaned_achievement_kpi_keys` — Fix orphaned achievement KPI keys
- **153** `backfill_kpi_metric_history` — Backfill kpi_metric_history for complete weekly snapshots
- **154** `volume_badges_new_kpis` — Volume badges for newly wired KPIs
- **155** `trial_expiry_notified_at` — Trial expiry notification tracking
- **156** `achievement_unique_constraint` — Unique constraint on achievements to prevent duplicate awards
- **157** `sync_achievements_across_orgs` — Sync achievement definitions across all orgs
- **158** `apptivia_test_org_signal_updates` — Test org signal configuration updates
- **159** `apptivia_test_org_sales_dna` — Test org Sales DNA configuration
- **160–161** Engage feedback loop — `dismissal_reason`, `edit_diff` capture on signal actions, outreach style memory tables
- **162** `aaron_recommendation_outcomes` — Aaron outcome tracking at +14d/+30d/+60d windows
- **163** `competitor_takedown_website_visitor_signals` — 2 new signal definitions (competitor_takedown, website_visitor_activation)
- **165** `aaron_pre_call_prep_cards` — Pre-Call Prep cards for Aaron Mode 2 (calendar integration, auto-generated 60min before meetings)
- **166** `aaron_skill_practice_logs` — Skill Practice logs for Aaron Mode 4 (8 skill dimensions, rubric scores, improvements tracking)
- **167** `pipeline_deal_sync_upsert` — Unique index on engage_pipeline_deals (organization_id, source, external_id) for CRM deal upsert dedup
- **168** `fix_contest_leaderboard_date_filter` — Contest leaderboard date filtering edge case fix
- **169** `contest_secondary_kpi` — Secondary KPI tracking for contests
- **170** `action_queue_gmail_fields` — Gmail-specific fields on action queue entries
- **171** `rename_microsoft_calendar_to_outlook` — Rename Microsoft Calendar to Outlook for consistency
- **172** `profile_email_signature` — Email signature field on profiles
- **173** `fix_rls_and_security_definer` — Comprehensive RLS policy audit and security definer fixes
- **174** `engage_research_persistence` — Persistent storage for AI research results
- **175** `calendar_meeting_outcomes` — Meeting outcome tracking (completed, cancelled, rescheduled)
- **176** `deal_management_tables` — Deal management infrastructure — junction tables, contact linking
- **177** `deal_linking_columns` — Additional deal-to-account and deal-to-contact linking columns
- **178** `call_recording_and_presence` — Call recording metadata and user presence tracking
- **179** `engage_icp_profiles` — ICP profile/persona definitions table
- **180** `account_page_overhaul` — Account-level data restructure for expanded Account Intelligence
- **181** `notification_action_url_fix` — Notification action URL routing correction
- **182** `upsert_website_visitor_rpc` — Idempotent website visitor upsert RPC function
- **183** `deal_junction_org_id_and_rls` — Organization ID + RLS on deal junction tables
- **184** `profile_fk_on_delete` — Profile foreign key ON DELETE cascade behavior fix
- **185** `consolidate_deal_account_id` — Consolidate deal-account ID references
- **186** `super_admin` — Super admin role for cross-org management
- **187** `global_tasks` — Global tasks table with assignment, priority, due dates
- **188** `prospect_tenure_influence` — Tenure months and influence score on engage_prospects
- **189** `coaching_effectiveness_snapshots` — Coaching plan effectiveness tracking snapshots
- **190** `onboarding_emails` — Onboarding email log table for drip campaign tracking with dedup
- **191** `org_playbooks` — Org-level playbook definitions and step execution tracking
- **192** `api_keys` — API key generation, storage, and rotation for org integrations
- **193** `external_task_sync` — External task sync infrastructure for CRM task bidirectional sync
- **194** `backfill_kpi_org_config_history` — Complete audit trail backfill for KPI org config history
- **195** `crm_activity_records` — CRM activity record storage for detailed activity logging
- **196** `deal_qualification_data` — Deal qualification scoring (MEDDPICC, BANT, etc.)
- **197** `deal_software_in_use` — Software/tech stack tracking associated with deals
- **198** `task_achievements_expansion` — Achievement definition expansion for task-based metrics
- **199** `sequence_clicked_at` — Click tracking timestamps for sequence emails
- **200** `prospect_secondary_fields` — Secondary contact fields (phone2, email2, LinkedIn, etc.)
- **201** `cleanup_cross_org_contest_participants` — Remove orphaned contest participants from cross-org data leak
- **202** `contest_org_hardening` — Clean orphaned contest data, enable RLS on contest_participants/contest_leaderboards
- **203** `research_report_saved` — saved_by_user boolean + saved_at timestamp on engage_research_reports
- **204** `signal_auto_archive` — 'archived' status for engage_intent_signals + partial cleanup index

All migrations cover:
- Core schema (profiles, teams, organizations)
- KPI system (metrics, values, configs, benchmarks, history)
- Gamification (skillsets, achievements, badges)
- Contests (templates, active, participants, leaderboards)
- Coaching (plans, assignments, requests, IDPs, reviews, templates)
- Engage (companies, prospects, accounts, signals, pipeline, sequences, playbooks)
- Notifications (32 types)
- Integrations (OAuth, sync, calendar, cursors)
- CEP (stages, deal progression)
- Billing (Stripe fields)
- Onboarding (readiness, org architecture)
- Organization isolation and scoping fixes

---

*This document was generated from the Apptivia codebase and updated May 29, 2026 (migrations 000–204, 10 provider modules, 35 canonical KPIs, 199 API endpoints, 25 cron jobs, 47 signals, 113 components, 25 hooks, 23 pages, Aaron Sonnet 4.6, deal management, global tasks, org playbooks, onboarding drip, signal auto-archive, contest org-hardening). For implementation-specific details, refer to the source files directly.*
