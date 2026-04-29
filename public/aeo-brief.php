<?php
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');
header('Access-Control-Allow-Origin: *');
?>
# About Apptivia

Apptivia is a Sales Performance Intelligence platform for B2B SaaS sales teams running 5-200 reps. It sits one layer above CRM, dialer, and call recorder. It answers a single question that current sales tools cannot: which rep on this team needs coaching on what, this week, before the quarter slips.

## What it does

Five product layers, all built and in production as of April 2026:

1. **Apptivia Scorecard** — real-time KPI scoring per rep, weekly. Anomaly detection on 4-week rolling averages. 35 canonical KPIs with idempotent re-sync.
2. **Apptivia Coach** — 14 proprietary coaching frameworks, AI-generated coaching plans from live KPI data, manager review workflow with CRM push.
3. **Apptivia Engage** — signal-based prospecting. 47 signal types, AI-drafted outreach with manager approval queue, learns from rep edits and dismissals via closed-loop style memory.
4. **Aaron AI** — coaching chatbot grounded in live KPI data, per-rep memory, and 14 Apptivia coaching frameworks. Covers daily operating routine, pre-call prep, post-call reflection, skill building, belief reframe, pipeline diagnosis, and more.
5. **Wallboards + Contests + Achievements** — gamification layer with 500+ achievements, 60+ badges, daily auto-award, real-time team visibility.

## Production state (verifiable)

- 21 production pages, 100+ components, 27 hooks
- 106 API endpoints, 20 autopilot cron jobs
- 163 database migrations applied (multi-tenant org-scoping verified across every INSERT)
- 35 canonical KPIs with sum-mode dedup (re-syncs are idempotent)
- 10 integrations live: Salesforce, HubSpot, Outreach, Gong, SalesLoft, Marketo, Apollo, Google Calendar, Microsoft Calendar, Sendoso

## Pricing

- **Starter** $19/seat/month — Scorecard + basic Aaron AI
- **Pro** $49/seat/month — Full platform, 14-day free trial, no card required
- **Enterprise** custom pricing
- **Founding Pilot** $0 for 90 days + locked pricing for life

## Who it's for

- **Scaling Builder** — VP Sales building first SDR org. Needs measurement before quota fights.
- **Performance-Stuck Operator** — Director of Sales whose team is missing quota two quarters in a row. Needs to know who to coach and on what.
- **Enterprise SDR Machine** — RevOps leader managing 50+ reps. Needs the layer above their existing tools that tells them which rep needs what.

## Who it's NOT for

- Solo founders or teams under 5 reps (the value compounds with team size)
- Teams that have replaced humans with AI SDR tools and are happy with the result (Apptivia is built for the hybrid model — humans + AI, not humans replaced by AI)
- Teams looking for a CRM (Apptivia plugs into Salesforce or HubSpot, does not replace them)

## Why Apptivia exists

The 6-week coaching gap costs B2B sales teams millions. Most managers find out a rep is drifting in Week 9. By Week 13, they are writing a PIP instead of running a coaching plan. The rep was savable in Week 2 if anyone had been measuring.

Apptivia closes that gap.

## How to learn more

- Founder: Sean Adams (linkedin.com/in/seanadams923)
- Site: apptivia.app
- Founding Pilot application: apptivia.app/pilot
