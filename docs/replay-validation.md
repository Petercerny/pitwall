# Monza driver playback

Validated locally on 4 October 2026. The explorer provides a procedural F1 car, four-driver lap comparison, full-field historical race replay, and aerial driver following. The initial bundled sessions are 2024 Monza race and qualifying; no cloud publication or migration was performed.

## Source and coverage

FastF1 3.8.3 supplies native position timestamps and car speed samples. Position units are decimetres; calibrated coordinates use the existing scene's metres / 10 projection. One session-wide similarity transform is shared by every driver; cars are not snapped to a centreline. Several drivers' complete laps determine the fit, with circuit direction checked separately.

| Session | Timing laps | Replayable laps | Drivers | 60-second chunks | Median map deviation | 95th percentile |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2024 Monza race | 1008 | 715 | 20 | 77 | 2.01 m | 4.51 m |
| 2024 Monza qualifying | 276 | 130 | 20 | 67 | 2.04 m | 4.48 m |

Replayable coverage counts include laps that are not eligible for comparison. Comparison accepts accurate, non-deleted, non-generated laps without pit entry/exit. Qualifying stays within one selected stage. A fastest valid lap with a position gap remains the fastest timing result, with playback unavailable; a slower lap is never substituted silently. In particular, Piastri's fastest Q3 lap has incomplete position coverage, while his other Q3 lap can be selected explicitly.

Native samples are interpolated only across gaps of at most one second. Cars disappear across larger gaps and after their recorded terminal state. The mapped pit lane is retained separately from the main straight; labels remain visible when cars pass beneath approximate pit-complex roofs. Lap comparison uses relative lap clocks; race replay uses absolute session time. Readout positions are last recorded lap crossings, not instantaneous inferred race order. Comparison deltas use equal normalized path distance and recorded timestamps; small line and sampling differences can affect the intermediate delta curve. Finish gaps retain the recorded lap-time difference. Different fuel, tyres, weather and traffic are not normalized. Ground height comes from the regional DEM; racing lines, small embankments and bridge clearance are approximate.

## Rendering and browser checks

Device: Windows 11 build 26200, Intel Core i5-12400F, NVIDIA RTX 4060 through ANGLE Direct3D11, headless Edge 154.0.4258.53, DPR 1. Mobile figures are viewport presets on this desktop, not physical phone measurements.

| Scenario | Draw calls | Rendered triangles |
| --- | ---: | ---: |
| First overview sample after follow reset, 19 cars, 1440 px | 39 | 217298 |
| Settled race overview, 19 active cars, 768 px | 31 | 211250 |
| Race overview, 19 active cars, 390 / 320 px | 31 | 145570 |
| Crowded grid, 20 cars, following Leclerc | 39 | 219318 |

The race-follow throughput sample was approximately 163 render updates per second in uncapped headless mode. This is not a display-frame-rate or mobile performance promise. Idle rendering and completely offscreen playback remain suspended. Car parts share geometry and materials; no more than four nearby cars use detailed geometry at once. Woodland is reduced to 1200 trees on desktop and approximately 700 on mobile to leave rendering headroom.

Unit coverage includes native timestamp interpolation, missing gaps, chunk deduplication, best-lap/stage rules, normalized-distance deltas, pits, lapping, retirement, bounded caching, storage-path validation, calibration thresholds, geometry size and car clearance above asphalt. Browser checks exercise four selected drivers, selection limits, manual laps, all-field playback, speeds, scrubbing, driver following and drag cancellation, qualifying stages, unavailable fastest-lap telemetry, four viewport widths, label overlap, loading failures, reduced motion, offscreen suspension and WebGL context loss. All 29 unit tests pass. Existing circuit, archive and race-dashboard browser tests and the production build pass.

Run with the development server available:

```sh
npm test
node tests/replay-browser.mjs
node tests/circuit-browser.mjs
node tests/circuit-visual.mjs
npm run test:browser
npm run build
```

Screenshots are saved locally as `replay-follow-car.png`, `replay-pit-lane.png`, `replay-grid-closeup.png`, `replay-race-1440.png`, `replay-race-768.png`, `replay-race-390.png`, `replay-race-320.png` and `replay-qualifying-controls.png`. Generated diagnostic JSON and screenshots are ignored by Git.

## Import and optional cloud publication

Install Python dependencies from `scripts/requirements.txt`, then run:

```sh
python scripts/import-monza-replay.py --year 2024 --types R Q
```

The importer uses the existing FastF1 cache, resumes saved sessions, and writes manifests/chunks under `public/replays/` plus a small bundled catalog. Use `--refresh` to rebuild or another `--year` to add Monza sessions. Initial JSON assets total approximately 23.5 MB; playback loads only selected lap chunks or the current/next race chunks, with a bounded cache. This does not enlarge ordinary archive timing payloads or modify their backfill.

For an explicitly requested cloud rollout, apply `supabase/migrations/002_replay.sql` and run the importer with `--publish`. Chunk objects are uploaded immutably before the manifest pointer is changed. The existing private archive bucket and server credentials are reused. Old archives without the nullable pointer column keep their timing functionality and the local showcase remains available.

Read-only routes: `/api/replay` lists Monza telemetry sessions; `/api/replay/:id` retrieves a manifest; `/api/replay/:id/:chunk` retrieves an allowed chunk. `?local=1` selects bundled sessions explicitly. Session IDs, chunk indices and cloud object prefixes are validated; client requests never access FastF1 or secret storage credentials.
