# Aeria

Aeria is a browser-based, gesture-controlled music instrument. Enable your webcam, play notes with hand movements, switch instruments with gestures, and record an audiovisual performance—no physical instrument, backend, account, or API key required.

Built for OpenAI Build Week, Aeria runs entirely in the browser. Camera frames, MediaPipe hand tracking, Tone.js audio, visuals, and recordings remain local to the device.

## Features

- Local MediaPipe Hand Landmarker tracking for one player, with up to two hands
- Piano-key tap gestures with an eight-note C-major layout, octave shifts, and multi-note chords
- Notes, Chords, Pinch melody, and Theremin+ performance modes
- Piano, Pad, Bells, and Violin synth instruments powered by Tone.js
- Gesture controls for sustain, C-major arpeggios, and instrument switching
- Hand skeletons, pitch-colored particle bursts, pseudo-3D instrument visuals, and a tempo-reactive waveform
- Combined canvas video and Tone.js audio recording exported as `.webm` (up to 60 seconds)
- A polished camera-hidden demo mode that retains the skeletons and visuals on a dark ambient stage

## Run locally

Requirements: Node.js, a webcam, and a current Chromium-based browser or Firefox.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (normally `http://localhost:5173`) and select **Enable camera**. That click also unlocks Web Audio, which browsers require before sound can play.

To verify a production build:

```bash
npm run build
npm run preview
```

## How to play

After camera access is granted, select **Start playing** in the brief onboarding overlay.

### Piano keys

Use a quick downward finger tap to press a virtual key. Each hand contributes to one continuous C-major octave; several fingers can be active together for chords. Raising or lowering either hand changes that hand’s octave, shown by a small on-stage badge.

The left and right hand identities are normalized for the mirrored camera preview, so MediaPipe’s raw labels are inverted once before note assignment.

### Chords

Switch the control strip to **Chords** mode, then hold one of the recognized combinations:

| Gesture | Result |
| --- | --- |
| Thumb + middle + pinky | C major |
| Index + ring | A minor |

### Pinch melody

Choose **Pinch melody**. Move the right hand vertically to select a note from the C-major range, then pinch thumb and index finger together to play it.

### Theremin+

Choose **Theremin+** for continuous sound. The right hand controls pitch, stereo position, filter brightness through wrist tilt, and subtle vibrato from small vertical movements. The left hand controls volume. The antenna field visual responds to pitch and volume in real time.

### Global gestures

- Hold **both fists** for about 400 ms to cycle: Piano → Pad → Bells → Violin.
- Hold an **open flat palm** for about 500 ms to enable extended-release sustain.
- Hold a **peace sign** (index and middle extended) for a quick C-major arpeggio.

## Recording

Select **Record** after the camera preview is active. Aeria composites the performance stage—camera (if visible), skeletons, particles, waveform, and instrument visual—into a canvas video stream and combines it with Tone.js audio. Recording stops only when you choose **Stop recording** or after the 60-second safety cap. Select **Download recording** to save the `.webm` file.

Recording uses `canvas.captureStream()`, Web Audio, and MediaRecorder, and works best in current Chrome, Edge, and Firefox.

## Hand-tracking reliability

- MediaPipe uses local WASM and a local hand-landmarker model stored in `public/`; startup does not need to download a model.
- GPU is requested for the Hand Landmarker, with a 480×360 webcam capture target and detection decoupled from visual rendering.
- Detection/presence confidence is `0.75`; tracking confidence is `0.7`.
- Incomplete, implausible, low-confidence, overlapping, or abruptly jumping hand data is ignored before gesture evaluation.
- For the most reliable control, use even front lighting, keep hands fully visible, and avoid a busy background.

## Privacy

All camera processing happens in the browser. Aeria does not upload, store, or transmit webcam footage or landmark data. Use **Hide camera** for a clean skeleton-and-particles view during a demo.

## Project structure

```text
public/
├── models/                    # Local MediaPipe hand-landmarker model
└── mediapipe-tasks-vision/    # Local MediaPipe WASM runtime
src/
├── components/                # Canvases, controls, overlays, and visuals
├── lib/                       # Tracking setup, gesture mapping, audio, rhythm logic
├── pages/                     # Performance view
├── App.jsx
└── styles.css
```

## Tech stack

- React + Vite
- `@mediapipe/tasks-vision` for hand landmarks
- Tone.js and Web Audio for synths, effects, and recording
- Canvas and CSS for live visual effects
- Plain CSS with Space Grotesk, Inter, and IBM Plex Mono

## Demo tips

- Open the app before presenting and allow camera/audio access early.
- Use even, front-facing lighting and a clear background.
- Keep both hands in frame and begin with relaxed open hands.
- Keep a short screen recording available as a fallback for venue or permission issues.
