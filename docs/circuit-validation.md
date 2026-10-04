# Monza aerial explorer validation

Validated on 4 October 2026. The source snapshot covers longitude 9.2768–9.3008 and latitude 45.6091–45.6341, approximately 300 metres beyond the circuit's coordinate bounds. It contains 1,380 retained map features: 707 building footprints, 40 woodland features and 527 road/path features. Rendering retains complete polygon holes and excludes outlying building centres and road segments outside the scene boundary.

The scene is a geographic reconstruction with procedural visual detail, not photogrammetry. The race centreline is unchanged. Buildings use mapped footprints; heights prefer recorded metres, then mapped storeys at 3 metres per storey, then conservative 7-metre general / 13-metre pit / 7-metre grandstand defaults. The pit complex is identified by the mapped Palazzina Box name. Residential gabled roofs, garage fronts, grandstand seating and the individual trees are approximate. The historic oval route appears where mapped as a raceway; banking elevations are not inferred.

## Rendering measurements

Device: Windows 11 build 26200, Intel Core i5-12400F, NVIDIA GeForce RTX 4060 using ANGLE Direct3D11, headless Microsoft Edge 154.0.4258.53. Device scale factor 1. These figures include the directional-light shadow pass; they are not measurements on physical mobile hardware.

| Viewport width | Preset | Trees | Draw calls | Rendered triangles |
| --- | --- | --- | --- | --- |
| 1440 | Desktop | 1500 | 43 | 235708 |
| 768 | Desktop | 1500 | 43 | 235708 |
| 390 | Mobile | 900 | 43 | 156988 |
| 320 | Mobile | 900 | 43 | 156988 |

The illustrative tour measured approximately 165 render updates per second over a 2.5-second headless sample. Headless scheduling can exceed display refresh rate; this is a device-specific throughput check, not a cross-device frame-rate promise. No frames were rendered during the tested idle interval or while the playing scene was completely offscreen. Desktop/mobile presets cap pixel ratio at 1.5/1 and shadows at 2048/1024. All generated textures are 512 pixels or smaller.

## Visual and functional checks

Before/after overview screenshots are retained locally as `circuit-before-desktop.png` and `circuit-upgrade-1440.png`. The baseline has only overview screenshots; new close-ups of the mapped pit complex, Lesmo and Ascari are saved as `circuit-upgrade-pits.png`, `circuit-upgrade-lesmo.png` and `circuit-upgrade-ascari.png`. The new overview removes the raised rectangular base, uses clustered mapped woodland and access roads, and fits a continuous, feathered park surface. Close-ups show garage fronts, tiered seating, lower western light, road grain and bounded road joins.

Geometry tests cover shared projection, ring holes, deterministic woodland placement, road/building clearance, the closed track seam, bounded chicane miters and distance-based tour sampling. Browser checks cover camera switching, orbit/zoom, five locations, tour playback, four viewport widths, non-overlapping visible pins, reduced motion, WebGL context loss, unavailable WebGL, and archive regressions. Performance results can be regenerated with `node tests/circuit-visual.mjs` while the development server is running.
