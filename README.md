# Aeria

**Aeria** is a browser-based, gesture-controlled music instrument. Open the app, allow camera access, and use your hands to play pentatonic notes, chords, switch instruments, create visual trails, and record a performance—no physical instrument required.

Built for the OpenAI Build Week hackathon as a fully client-side experience: hand tracking, audio, visuals, and recording all run locally in the browser.

## Highlights

- Real-time MediaPipe Hand Landmarker tracking for up to four hands / two players
- Pentatonic finger-key playing, so the notes always work musically together
- Notes and Chords modes, plus a right-hand pinch melody mode
- Piano, Pad, Bells, and Violin synth voices powered by Tone.js
- Gesture-triggered sustain, arpeggio flourish, and instrument switching
- Hand-colored skeletons, pitch-colored particle trails, waveform visuals, and tempo-reactive ambience
- Browser recording and `.webm` export (up to 60 seconds)
- No backend, accounts, API keys, uploads, or paid services

## Run locally

Prerequisites: a current Chromium-based browser or Firefox, Node.js, and a webcam.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`), then select **Enable camera**. Audio is unlocked from that button click to meet browser Web Audio requirements.

To create a production build:

```bash
npm run build
npm run preview
```

## How to play

After allowing the camera, complete the short onboarding overlay and use the controls below the stage to choose a performance mode.

### Piano keys — Notes mode

Curl a finger toward your palm to play one pentatonic note.

| Finger | Right hand | Left hand |
| --- | --- | --- |
| Thumb | C4 | C3 |
| Index | D4 | D3 |
| Middle | E4 | E3 |
| Ring | G4 | G3 |
| Pinky | A4 | A3 |

Use multiple curled fingers—and multiple hands—for chords.

### Piano keys — Chords mode

Hold one of these shapes on either hand:

| Shape | Chord |
| --- | --- |
| Thumb + middle + pinky curled | C major |
| Index + ring curled | A minor |

### Pinch melody mode

Move the right hand vertically to select a note from a two-octave C pentatonic scale, then pinch thumb and index finger together to play it.

### Global gestures

- Hold **two closed fists** for about 400 ms to cycle instruments: Piano → Pad → Bells → Violin.
- Hold an **open, flat palm** for about 500 ms to activate extended-release sustain.
- Hold a **peace sign** (index + middle extended, other fingers curled) for a quick pentatonic arpeggio.

The active notes, instrument, and sustain state appear on the stage. A waveform bar along the stage edge idles gently, then responds to played notes and a stable detected tempo.

## Recording

Select **Record** in the control strip to capture Aeria's audio output. Recording automatically stops after 60 seconds; select **Download recording** to save the result as a `.webm` file.

Recording relies on the browser MediaRecorder API and works best in Chrome, Edge, and Firefox.

## Visual modes and privacy

- Use **Hide camera** to leave the hand skeleton, particles, notes, and ambient stage visible while hiding the raw video feed.
- Video stays in the browser. Aeria does not upload, store, or transmit camera footage or gesture data.
- The MediaPipe hand-landmark model downloads when first initialized, so the initial load needs an internet connection; no API key is required.

## Project structure

```text
src/
├── components/     # Camera overlays, tracking canvas, particles, controls, onboarding
├── lib/            # MediaPipe setup, gesture mapping, Tone.js engine, rhythm detection
├── pages/          # Performance view
├── App.jsx
└── styles.css
```

## Tech stack

- React + Vite
- `@mediapipe/tasks-vision` for browser hand tracking
- Tone.js and Web Audio for instruments, effects, and recording
- Canvas for skeletons and particles
- Plain CSS with Google Fonts

## Demo tips

- Use even, front-facing lighting and a clear background for the most reliable detection.
- Keep hands fully in frame, especially with two players.
- Open the app before presenting so the hand model is already cached.
- Keep a short screen recording handy as a fallback for webcam permission or venue-lighting issues.
