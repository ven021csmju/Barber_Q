# Flook Barber — Architecture

## Baseline

- Next.js 16 + React 19 on Vercel; Supabase Free; single barber.
- No customer signup/authentication.
- No self-hosted server, no Ubuntu deployment.
- No GitHub Actions — except the approved exception below.
- Supabase recovery is monitoring only (Phase 3/4): read-only checks, no
  automatic resume, no Management API writes.

## Approved exceptions

### AE-1 — GitHub Actions keep-alive workflow (temporary)

| | |
|---|---|
| Status | Approved, temporary |
| Approved | 2026-11-06 |
| File | `.github/workflows/keep-supabase-alive.yml` (the only permitted workflow) |
| Expires | When the Phase 4 recovery cron (`/api/recovery/cron`) is deployed and verified working in production. At that point decide to keep it as a backup or delete it. |

**What it does.** Twice a week (Mon/Thu 12:00 UTC) and on manual dispatch, it
sends one read-only request:
`GET <SUPABASE_URL>/rest/v1/time_slots?select=id&limit=1` with the publishable
key only. `time_slots` holds no customer data. The job fails on any status
other than 200, so GitHub's failure notification is a basic "possibly paused"
signal.

**Why.** Phase 4 already provides a daily read of the same kind, but it is not
deployed yet (the Vercel Hobby commercial-use question is still open). This
workflow covers that gap.

**This is a mitigation, not a guarantee.** Supabase does not publish exactly
what counts as activity for the Free-tier inactivity pause, so a read request
lowers the risk but cannot guarantee the project stays active. GitHub can also
disable scheduled workflows in a public repository after 60 days without
repository activity, which would stop it silently.

**Boundaries.**

- Read-only. No writes, no RPCs, no SQL, no Management API calls.
- Never resumes a paused project. Resume stays a manual owner action.
- Publishable key only. The workflow refuses any key that does not start with
  `sb_publishable_`. Repository secrets: `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`.
- `permissions: contents: read`; 2-minute job limit; 20-second request limit.
- No other workflows may be added under this exception.
