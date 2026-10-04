# Pitwall

Historical F1 analysis with React, Recharts and the Sites Vinext server runtime. No live timing or AI calls. Existing private access is preserved.

## Run

```powershell
npm.cmd install
npm.cmd run dev -- --port 5173
```

## Supabase

Run `supabase/migrations/001_archive.sql` in the SQL Editor. Copy `.env.example` to `.env.local` if needed, then set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to a new `sb_secret_…` key. Restart development after environment changes. Configure the same variables in Sites production settings and mark the key secret before deployment.

Keys stay server-side and are sent in the `apikey` header, not as bearer JWTs. No publishable key is needed. The SQL `service_role` grant is intentional: new secret keys use that Postgres role. [Supabase documentation](https://supabase.com/docs/guides/getting-started/api-keys).

The table has RLS enabled with no anonymous grants; the bucket is private. Supabase Free can pause inactive projects and has no automatic backups. Keep local snapshots. An unavailable cloud archive is identified explicitly; only the saved Italian GP can be opened as a local fallback.

## Manual imports

Use Python 3.11+:

```powershell
python -m pip install --target .import-deps -r scripts/requirements.txt
# Size trial
python scripts/import-archive.py --years 2023 --round 1
# Backfill
python scripts/import-archive.py --years 2023 2024 2025 2026
# Upload cached data without contacting FastF1
python scripts/import-archive.py --publish-only --years 2023 2024 2025 2026
# Import and publish a weekend
python scripts/import-archive.py --years 2026 --round 1 --publish
# Explicit source correction
python scripts/import-archive.py --years 2024 --round 16 --types R --refresh --publish
```

Omit years to cover 2023 through the current year. Types `R S Q SQ` cover races, sprints, qualifying and sprint qualifying, including Sprint Shootout. Practice and telemetry are excluded. Existing valid local snapshots are reused unless `--refresh` is supplied.

Ignored outputs: `archive/sessions/` contains snapshots; `archive/index.json` tracks import state; `archive/coverage.md` lists availability, missing seasons, file size and publication count; `archive/schedule-status.json` tracks season discovery; `.fastf1-cache/` preserves source responses.

On FastF1 rate limits, wait for the limit window before resuming. Already saved sessions remain usable. Failed imports are unavailable, not cancelled. Events absent from the provider schedule are not inferred to be cancellations; the database/UI can represent independently established cancelled sessions.

Local snapshots are validated and replaced atomically. Cloud uploads use SHA-256 paths, then update the session pointer. Failure preserves the previous published version. Identical imports reuse the same key/path. Old object versions remain for recovery; monitor quota use before repeated refreshes.

## APIs and calculation methods

`GET /api/archive` returns the session index and cloud/local/unavailable mode. `GET /api/archive/:id` loads just one snapshot. The explicit `?local=1` fallback is supported only for `2024-16-R`. Share links use `?session=2023-4-SQ`.

`src/model.js` normalizes data; `src/stories.js` derives evidence records containing session/driver IDs, lap ranges, values, exclusions, source and import time. A future LLM can consume this format.

- Gaps compare crossings of the same lap, not simultaneous live intervals. Missing laps stay missing.
- Classification/penalties are separate from timing gaps. Unknown/pit-lane grids have no fabricated positions-gained metric.
- Pit stops require an entry and subsequent exit; retirement in the pits is excluded.
- Matched pace uses lap numbers eligible for both drivers, excluding opening, pit, non-green, deleted, inaccurate and generated laps. Stories require three paired laps and show sample size. Fuel, traffic and tyre age are not normalized.
- Qualifying best laps exclude deleted/generated timing and only compare within the selected stage. Final classification is separate from recalculated stage bests.
- Position changes are observations, not proof of an overtake or a causal strategy claim.

## Checks

```powershell
npm.cmd test
python tests/test_importer.py
npm.cmd run build
# With local server running; uses Microsoft Edge:
npm.cmd run test:browser
```

Tests preserve Monza regressions and cover evidence, matched pace, qualifying, missing storage, downloaded session integrity, retry/repeatability and failure recovery. Browser checks cover selections, hover, sliders, markers, strategy/moment/evidence links, deep links and mobile overflow. Multi-session tests use real downloaded 2023 rounds 4 and 7 as HTTP fixtures; live cloud connectivity is checked separately.

For a single long backfill that waits after source limits, run `python scripts/backfill.py --years 2023 2024 2025 2026`. This is a manually started process, not a recurring scheduler. Progress is in `archive/backfill-status.json`; keep the process/computer running. The checked-in `docs/archive-coverage.md` is the delivery snapshot; `archive/coverage.md` is updated by active imports.

