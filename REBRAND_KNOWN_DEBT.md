# Rebrand v1 — Known Scope Debt

Documented during Phase 9 verification (commit 68bf3ab base).
All items are post-Planera-pilot cleanup, NOT pilot-blocking.

## 1. text-white / bg-white primitive usage (1,021 occurrences)

Tailwind primitives used instead of text-apptivia-paper / bg-apptivia-paper tokens. Visually identical to users; bypasses token system for grep audits.

Top 5 files for cleanup priority:
- Wallboard.jsx (73)
- Contests.jsx (36)
- EngageDiscover.jsx (33)
- LandingPage.jsx (30)
- OrganizationSettings.jsx (20)

Cleanup strategy: file-by-file in dedicated session; rule on each instance (legitimate primitive vs token bypass) since context matters (CTA text vs card bg vs glass alpha).

## 2. BadgeCreationModal #8B5CF6 picker color

Intentional — preserves user-selectable badge color diversity. Not debt; documented for future audits to skip.

## 3. >Apptivia< standalone text in:
- exportPdf (PDF report header)
- Wallboard (display surfaces)
- Legal pages (privacy/terms)
- PilotApplication (form text)
- backup SVG (bak file, ignore)

Post-Planera: review each for whether to migrate to ApptiviaLogo or keep as plain text in non-logo context.

## 4. Phase 4.10 inline template hexes (RESOLVED)

Originally deferred from Phase 4.4. Migrated in Phase 4.10a (emailTemplates.ts) and 4.10b (exportPdf.ts). No remaining work.
