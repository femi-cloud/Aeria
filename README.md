# Aeria

**Aeria** is a browser-based, gesture-controlled music instrument. Open the app, allow camera access, and use your hands to play C-major notes, chords, switch instruments, create visual trails, and record a performance—no physical instrument required.

Built for the OpenAI Build Week hackathon as a fully client-side experience: hand tracking, audio, visuals, and recording all run locally in the browser.

## Highlights

- Real-time MediaPipe Hand Landmarker tracking for one player's left and right hands (maximum two hands)
- A two-hand C-major finger layout that forms one continuous octave
- Notes and Chords modes, plus right-hand Pinch melody and Theremin+ modes
- Piano, Pad, Bells, and Violin synth voices powered by Tone.js
- Gesture-triggered sustain, arpeggio flourish, and instrument switching
- Hand-colored skeletons, pitch-colored particle trails, pseudo-3D instrument visuals, waveform visuals, and tempo-reactive ambience
- Combined performance video and Tone.js audio recording exported as `.webm` (up to 60 seconds)
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

After allowing the camera, complete the short onboarding overlay, hold your hands naturally open for the two-second calibration, then use the compact control strip below the stage to choose a performance mode.

### Piano keys — Notes mode

Curl a finger toward your palm to play a note in one continuous C-major octave.

| Finger | Right hand | Left hand |
| --- | --- | --- |
| Thumb | C4 | A4 |
| Index | D4 | B4 |
| Middle | E4 | C5 |
| Ring | F4 | — |
| Pinky | G4 | — |

Use multiple curled fingers—and multiple hands—for chords.

Raise or lower either whole hand to transpose that hand's assigned notes by one octave. The small hand badges on the stage show the current shift.

### Piano keys — Chords mode

Hold one of these shapes on either hand:

| Shape | Chord |
| --- | --- |
| Thumb + middle + pinky curled | C major |
| Index + ring curled | A minor |

### Pinch melody mode

Move the right hand vertically to select a note from a two-octave C-major scale, then pinch thumb and index finger together to play it.

### Theremin+ mode

The right hand controls continuous pitch, stereo panning, filter brightness (wrist tilt), and subtle vibrato (small up/down motion). The left hand shapes the theremin volume. The stage switches to a glowing antenna-field visual in this mode.

### Global gestures

- Hold **two closed fists** for about 400 ms to cycle instruments: Piano → Pad → Bells → Violin.
- Hold an **open, flat palm** for about 500 ms to activate extended-release sustain.
- Hold a **peace sign** (index + middle extended, other fingers curled) for a quick C-major arpeggio.

The active notes, instrument, and sustain state appear on the stage. A waveform bar along the stage edge idles gently, then responds to played notes and a stable detected tempo.

## Recording

Select **Record** after camera setup to capture a single performance video: the webcam feed (or the clean hidden-camera stage), hand skeleton, particle trails, waveform, and instrument visual are composited into a canvas video track and combined with Tone.js audio. Recording continues until you select **Stop recording** or the 60-second cap is reached; select **Download recording** to save the resulting `.webm` file.

Recording relies on `canvas.captureStream()`, Web Audio, and the browser MediaRecorder API. It works best in current Chrome, Edge, and Firefox. A lost recording track or recorder failure is shown in the app and logged to the browser console.

## Tracking reliability

- Detection and hand-presence confidence are set to `0.75`; tracking confidence is set to `0.7`.
- Overlapping duplicate detections are reduced to a single hand before gesture processing.
- Frames with incomplete landmarks, implausible proportions, low classification confidence, or abrupt impossible wrist jumps are ignored before they can trigger notes.
- For best results, keep both hands fully in frame with even, front-facing light and a clear background.

## Visual modes and privacy

- Use **Hide camera** to leave the hand skeleton, particles, notes, and ambient stage visible while hiding the raw video feed.
- Video stays in the browser. Aeria does not upload, store, or transmit camera footage or gesture data.
- The MediaPipe hand-landmark model downloads when first initialized, so the initial load needs an internet connection; no API key is required.

## Project structure

```text
src/
├── components/     # Camera overlays, tracking/compositor canvases, particles, controls, onboarding
├── lib/            # MediaPipe setup, gesture mapping, Tone.js engine, rhythm detection
├── pages/          # Performance view
├── App.jsx
└── styles.css
```

## Tech stack

- React + Vite
- `@mediapipe/tasks-vision` for browser hand tracking
- Tone.js and Web Audio for instruments, effects, and recording
- Canvas for skeletons, particles, recording compositing, and performance visuals
- Plain CSS with Google Fonts

## Demo tips

- Use even, front-facing lighting and a clear background for the most reliable detection.
- Keep both hands fully in frame and begin with relaxed, open hands for calibration.
- Open the app before presenting so the hand model is already cached.
- Keep a short screen recording handy as a fallback for webcam permission or venue-lighting issues.
