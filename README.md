# Pitwall

Interactive, single-page race analysis MVP using React, Vite and Recharts.

## Run

```sh
npm install
npm run dev
```

`npm run build` outputs a static production site to `dist/`. `npm test` checks the data invariants and editorial claims.

## Data

`src/data.js` contains a deliberately fictional 53-lap Monza race with a 2024 driver lineup, 20 drivers, one stop each, and a safety car on laps 33–36. It is not a reconstruction of official results. A shared elapsed-time model derives end-of-lap gaps, classifications, clean-lap pace and insights. Pit costs persist in elapsed time. Tyre stints cover exactly 53 laps.

Clean pace excludes each driver's pit in/out laps, safety-car laps, lap 1 and restart lap 37. No corrections for fuel, traffic or tyre age. Replace this module with a data adapter while retaining its exported contract to connect a future source.

## Interactions

- Select up to five drivers, clear selections, or restore the podium.
- Hover/tap the chart or use the keyboard-accessible lap slider for exact readings.
- Toggle event markers and highlight linked race moments.
- Expand all 20 strategies and click stints to inspect their ending lap.
- Compare any two different drivers; cross-team selections are labelled.
- Mobile charts scroll horizontally while the lap slider provides precise inspection.

The race picker contains the one available sample race. Driver colors remain stable across every panel. No authentication or data service is required. Google Fonts are optional, with system fallbacks.
