# Pitwall

Interactive, single-page race analysis MVP using React, Vite and Recharts.

## Run

```sh
npm install
npm run dev
```

`npm run build` outputs a static production site to `dist/`. `npm test` checks the historical data, missing-lap handling, clean pace and editorial claims. With the preview running on port 5173, `npm run test:browser` checks interactions and mobile layout using installed Microsoft Edge.

## Data

`src/data/monza-2024.json` is a historical snapshot of the 1 September 2024 Italian Grand Prix: 20 drivers, 1,008 recorded driver laps, results, tyre stints, weather, track status and race-control messages. It includes FastF1 version, import timestamp and upstream timing path. `src/data.js` derives gaps, clean pace and insight text from this snapshot. There is no simulated race data in the dashboard.

The import uses FastF1 3.8.3 because OpenF1 temporarily restricted historical access during a live session. The deployed site does not call either API and does not require a data subscription. It is a fixed historical snapshot, not an automatic or live feed.

To refresh the snapshot using Python 3.12:

```sh
python -m pip install --target .import-deps -r scripts/requirements.txt
python scripts/import-race.py
npm test
npm run build
```

Data methodology:

- Gaps compare timestamps at the same lap number, relative to the earliest crossing of that lap. They are not simultaneous live intervals for lapped cars.
- Final classification and podium margins use the source results, including penalties. Raw timing gaps intentionally remain unadjusted; for example, Magnussen's final timing gap is 58.302 seconds and classified gap is 68.302 seconds.
- Missing, uncompleted and FastF1-generated laps are not interpolated. Tsunoda's line ends after lap 7; lapped finishers end after lap 52. Franco Colapinto is included in the actual lineup.
- A completed stop requires a pit entry followed by an exit. Retirement in the pits is not counted as a stop.
- Stints preserve consecutive sets of the same compound. Their lengths count race laps on the set; they do not imply that every tyre set was new.
- Clean pace excludes the opening lap, pit in/out laps, non-green track status, deleted laps and records FastF1 marks inaccurate or generated. No fuel, traffic or tyre-age correction is applied; each driver's eligible-lap count is shown.
- Weather values average readings during the race. There was no safety car or VSC in the imported track-status records.

The importer requires network access. It caches source requests in ignored `.fastf1-cache/`; `.import-deps/` is also ignored. The production website serves the checked-in snapshot only. Source: https://github.com/theOehrly/Fast-F1.

## Interactions

- Select up to five drivers, clear selections, or restore the podium.
- Hover/tap the chart or use the keyboard-accessible lap slider for exact readings.
- Toggle event markers and highlight linked race moments.
- Expand all 20 strategies and click stints to inspect their ending lap.
- Compare any two different drivers; cross-team selections are labelled.
- Mobile charts scroll horizontally while the lap slider provides precise inspection.

The race picker contains the one available historical race. Driver colors remain stable across every panel. No application login or runtime data service is required. Google Fonts are optional, with system fallbacks. Hosting remains owner-private at the existing Pitwall URL.
