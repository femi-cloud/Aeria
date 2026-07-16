# AGENTS.md — Aeria

## Project overview
Aeria is a gesture-controlled music creator built for the OpenAI Build Week
hackathon (category: Apps for Your Life). The user's webcam tracks their
hands in real time; hand position and gestures control a live musical
performance — no instrument required. Right hand controls pitch (within a
pentatonic scale, so it always sounds musical) and note triggering; left
hand controls volume and reverb. Visual particle trails render alongside the
sound.

This is a hackathon MVP. Everything runs 100% client-side/local — no paid
API calls, no external services requiring a key. This is a deliberate
constraint: reliability during a live demo matters more than any feature
that depends on network calls.

## Tech stack
- **Frontend**: React + Vite
- **Hand tracking**: MediaPipe Hand Landmarker (via `@mediapipe/tasks-vision`
  npm package) — runs fully in-browser, no server calls
- **Audio**: Tone.js for synths (Piano via Tone.Sampler or a built-in-like
  poly synth, Pad via Tone.PolySynth with a soft ethereal patch, Bells via
  Tone.MetalSynth or FMSynth)
- **Visuals**: Canvas (not SVG, for performance with continuous particle
  rendering) drawn on top of or alongside the webcam feed
- **Styling**: plain CSS, dark theme, page-prefixed class naming (`ae-*`)
- **No backend needed for MVP** — everything runs client-side

## Project structure
- Components in their own files under `src/components/` (e.g.
  `HandTracker.jsx`, `ParticleCanvas.jsx`, `InstrumentSelector.jsx`,
  `PerformanceView.jsx`) — never embed a component inside a page-level file.
- Pages under `src/pages/`.
- Shared logic under `src/lib/`:
  - `handTracking.js` — MediaPipe setup and landmark processing
  - `musicEngine.js` — pentatonic scale mapping, note triggering logic,
    Tone.js instrument setup
  - `gestureMapping.js` — translates raw hand landmarks into musical
    parameters (pitch, volume, reverb, instrument switch)

## Naming conventions
- CSS classes prefixed `ae-` (e.g. `ae-canvas`, `ae-controls`,
  `ae-instrument-badge`).
- Component files: PascalCase matching component name.
- Functions/variables: camelCase.

## Coding preferences
- Prefer targeted diffs over full-file rewrites once a file exists.
- Extract reusable UI (buttons, badges, modals) into their own component
  files.
- Comment non-obvious logic only (gesture-to-note mapping, pentatonic scale
  math, particle physics) — skip comments on simple code.
- No silent `catch {}` blocks — camera permission errors, MediaPipe load
  failures, or audio context issues must show a clear on-screen message.
- Web Audio (Tone.js) requires a user gesture before starting — always call
  `Tone.start()` in response to a click/tap, never automatically on load.

## Musical logic (core rules)
- Right hand Y position maps to a note within a fixed pentatonic scale
  (e.g. C pentatonic: C, D, E, G, A) across roughly 2 octaves — never
  chromatic/free pitch, to guarantee musical coherence regardless of hand
  movement.
- A pinch gesture (thumb tip + index tip distance below a threshold)
  triggers note-on; releasing the pinch triggers note-off or a natural
  decay.
- Left hand Y position maps to volume (linear or log scale, clamped to a
  sensible range).
- Left hand horizontal distance from center maps to reverb wet/dry mix.
- A closed-fist gesture (all fingertips close to the palm center) on both
  hands simultaneously cycles the active instrument (piano → pad → bells →
  piano).
- Movement speed of the right hand (delta position over time) can modulate
  note density/staccato-vs-legato feel — implement only if time allows,
  not required for MVP.

## MVP scope (build in this order)
1. Project scaffold (Vite + React, folder structure)
2. Webcam access + MediaPipe Hand Landmarker integration, with hand
   skeleton overlay drawn on a canvas over the video feed
3. Right hand → pitch mapping (pentatonic) + pinch → note trigger, using
   the Piano instrument only
4. Left hand → volume + reverb mapping
5. Instrument switching (fist gesture, piano/pad/bells)
6. Particle trail visuals synced to notes played (color mapped to pitch)
7. Polish: on-screen instructions/tutorial overlay, permission error
   states, loading states, responsive layout, hide raw webcam feed option
   (show only skeleton + particles for a cleaner look, if time allows)

## Explicitly out of scope for MVP
- Any paid AI API calls (OpenAI, etc.) — this project is intentionally
  100% local/free
- Recording/export of performances (unless time allows as a bonus)
- Multi-user or backend persistence
- Mobile-native app

## Bonus if time allows (not required)
- Loop/layering mode: record a 4-8 second phrase and loop it while playing
  a new layer on top, for a live composition effect.

## Demo reliability notes
- Test hand tracking under the actual lighting conditions of the demo
  location beforehand — MediaPipe hand tracking is sensitive to poor
  lighting and cluttered backgrounds.
- Have a fallback plan if webcam access fails during judging (e.g. a
  pre-recorded video clip of the app working, ready to show immediately).
- Practice the gesture control until it looks smooth and intentional, not
  fumbling — this is a live, physical demo and first impressions matter a
  lot here.