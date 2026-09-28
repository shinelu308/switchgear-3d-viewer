# SG-01 switchgear viewer

Live: https://shinelu308.github.io/switchgear-3d-viewer/

## V3 operating demonstration

Interactive 72-second guided tour, standby / normal / high-load / simulated overload trip,
synchronized three-phase energy-flow arrows and simplified one-line diagram, local cable
cutaway, simulation readings, and event history. Structure mode retains explosion, door
opening, component highlighting, and still renders. Pause/resume the tour or select scenes manually.

All operating data are simulated. Assumptions: 400 V line voltage, 630 A reference current,
balanced three-phase load, power factor 0.92. Normal load is 60%, high load 90%; the fault
scenario injects 125% load and trips after 4 simulation seconds. These are teaching values,
not verified equipment ratings or protection settings. Temperature uses an accelerated
illustrative first-order response, not a thermal calculation. Reset leaves the breaker open.

Supply is assumed to enter the upper busbars, pass through QF01, and leave through the lower
cables. Internal breaker conduction and conductor routing are explanatory overlays, not
verified electrical design. No continuous energy arrows are drawn on N or PE. Arrows indicate
energy transfer, not electron velocity or AC instantaneous current direction. The cutaway
copper strands are illustrative. No live device connection or remote equipment control exists.

Implementation: `simulation.mjs` contains deterministic state logic, `twin.js` binds it to
Three.js and the DOM. Existing GLB and dependencies are reused; no added CDN or telemetry.
Future real telemetry should replace the simulation through a separately secured backend;
never place device or gateway credentials in this public repository.

Static, self-contained Three.js viewer for an assumed-dimension switchgear model.

Features: orbit/zoom, assembly/explosion/door states, animation playback, cutaway, component selection and high-resolution stills. Vendor dependencies are served from this repository, with the Three.js MIT license retained.

Nominal enclosure: 800 × 1000 × 2200 mm, excluding protruding fittings. The model is a visualization asset with inferred internal geometry, not verified manufacturing CAD or an electrical design. No real-time telemetry is connected.

Serve this directory using an HTTP server. GitHub Pages publishes the root of main.

## Najie branding

The UI, favicon, front-door nameplate and gallery images use Shanghai Najie Electric branding. The blue/green emblem is a visual reconstruction from the facade photograph supplied by the user, not an official vector master. The nameplate is embedded mesh geometry attached to the door, so assembly, explosion, and door opening retain the branding. Equipment identifiers remain unchanged.
