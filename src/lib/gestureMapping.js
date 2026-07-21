const FINGERS = [
  { name: 'thumb', tip: 4, knuckle: 2, noteIndex: 0 },
  { name: 'index', tip: 8, knuckle: 5, noteIndex: 1 },
  { name: 'middle', tip: 12, knuckle: 9, noteIndex: 2 },
  { name: 'ring', tip: 16, knuckle: 13, noteIndex: 3 },
  { name: 'pinky', tip: 20, knuckle: 17, noteIndex: 4 },
]

const CHORD_SHAPES = [
  { fingers: ['thumb', 'middle', 'pinky'], id: 'c-major', name: 'C major', notes: ['C4', 'E4', 'G4'] },
  { fingers: ['index', 'ring'], id: 'a-minor', name: 'A minor', notes: ['A4', 'C5', 'E5'] },
]

// The visible keyboard ascends left to right: left hand plays C–G and right
// hand plays A–high C, matching the mirrored webcam presentation.
const LEFT_HAND_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4']
const RIGHT_HAND_NOTES = ['A4', 'B4', 'C5']
const PINCH_MELODY_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6']
const CURL_THRESHOLD_RATIO = 0.95
const PINCH_THRESHOLD = 0.06
const FIST_THRESHOLD_RATIO = 1.1
const EXTENDED_FINGER_RATIO = 1.2
// Each finger gets a resting height relative to the wrist and an open-hand
// length. Piano taps are measured as a fast, downward change from that rest.
const TAP_DOWN_RATIO = 0.18
const TAP_UP_RATIO = 0.09
const THUMB_TAP_DOWN_RATIO = 0.14
const THUMB_TAP_UP_RATIO = 0.07
const TAP_START_RATIO = 0.35
const TAP_WINDOW_MS = 220
const MAX_NOTE_HOLD_MS = 3000

export function getCurledFingerNotes(allLandmarks, allHandedness, handRoles = [], handOctaveShifts = [], stableFingersByHand = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handRole = handRoles[handIndex]
    const handSide = handRole?.id ?? getHandSide(allHandedness[handIndex], handIndex)
    const notes = shiftNotes(handSide === 'left' ? LEFT_HAND_NOTES : RIGHT_HAND_NOTES, handOctaveShifts[handIndex] ?? 0)
    const curledFingers = stableFingersByHand[handIndex] ?? getCurledFingers(landmarks)

    return curledFingers
      .map((finger) => ({
        ...finger,
        mappedNoteIndex: getFingerNoteIndex(handSide, finger, notes.length),
      }))
      .filter((finger) => notes[finger.mappedNoteIndex])
      .map((finger) => ({
        id: `${handRole?.id ?? `${handSide}-${handIndex}`}-${finger.name}`,
        handColor: handRole?.color,
        // Left-hand fingers mirror piano fingering: pinky is lowest, thumb is highest.
        note: notes[finger.mappedNoteIndex],
        octaveShift: handOctaveShifts[handIndex] ?? 0,
        position: landmarks[finger.tip],
      }))
  })
}

export function getCurledFingerChords(allLandmarks, allHandedness, handRoles = [], handOctaveShifts = [], stableFingersByHand = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handRole = handRoles[handIndex]
    // Hand roles are normalized once at the tracker boundary. Reuse that
    // identity here rather than independently deriving a side for chords.
    const handSide = handRole?.id ?? getHandSide(allHandedness[handIndex], handIndex)
    const curledFingers = stableFingersByHand[handIndex] ?? getCurledFingers(landmarks)
    const curledFingerNames = curledFingers.map(({ name }) => name)
    const chord = CHORD_SHAPES.find(({ fingers }) => hasExactFingerShape(curledFingerNames, fingers))
    if (!chord) return []

    return [{
      id: `${handRole?.id ?? `${handSide}-${handIndex}`}-${chord.id}`,
      handColor: handRole?.color,
      name: chord.name,
      notes: shiftNotes(chord.notes, handOctaveShifts[handIndex] ?? 0),
      octaveShift: handOctaveShifts[handIndex] ?? 0,
      position: landmarks[curledFingers[0].tip],
    }]
  })
}

export function getRightHand(allLandmarks, allHandedness) {
  return getHandBySide(allLandmarks, allHandedness, 'right')
}

export function getLeftHand(allLandmarks, allHandedness) {
  return getHandBySide(allLandmarks, allHandedness, 'left')
}

export function mapThereminFrequency(landmarks) {
  const normalizedY = clamp(landmarks[0]?.y ?? 1, 0, 1)
  const lowestMidi = 48
  const highestMidi = 84
  const midi = lowestMidi + (1 - normalizedY) * (highestMidi - lowestMidi)
  return 440 * 2 ** ((midi - 69) / 12)
}

export function mapLeftHandDistanceToVolume(landmarks) {
  const normalizedDistance = clamp(Math.abs((landmarks[0]?.x ?? 0.5) - 0.5) / 0.5, 0, 1)
  return -28 + normalizedDistance * 24
}

export function mapThereminPan(landmarks) {
  return clamp(((landmarks[0]?.x ?? 0.5) - 0.5) * 2, -1, 1)
}

export function mapThereminFilterCutoff(landmarks) {
  const wrist = landmarks[0]
  const middleMcp = landmarks[9]
  if (!wrist || !middleMcp) return 1200

  const tiltAngle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x)
  const normalizedTilt = clamp((tiltAngle + Math.PI) / (Math.PI * 2), 0, 1)
  return 280 + normalizedTilt * 5200
}

export function getMicroVibratoAmount(samples) {
  if (samples.length < 6) return 0

  const recentSamples = samples.slice(-8)
  const values = recentSamples.map(({ y }) => y)
  const range = Math.max(...values) - Math.min(...values)
  let directionChanges = 0
  let previousDirection = 0

  for (let index = 1; index < values.length; index += 1) {
    const direction = Math.sign(values[index] - values[index - 1])
    if (direction && previousDirection && direction !== previousDirection) directionChanges += 1
    if (direction) previousDirection = direction
  }

  return range >= 0.006 && range <= 0.07 && directionChanges >= 2
    ? clamp((range - 0.006) / 0.064, 0, 1)
    : 0
}

export function collectOpenHandFingerBaselines(landmarks) {
  return Object.fromEntries(FINGERS.map((finger) => {
    const fingertip = landmarks[finger.tip]
    const wrist = landmarks[0]
    const knuckle = landmarks[finger.knuckle]

    return [finger.name, {
      fingerLength: getLandmarkDistance(fingertip, knuckle),
      restY: (fingertip?.y ?? 0) - (wrist?.y ?? 0),
      thumbArcDistance: finger.name === 'thumb'
        ? getLandmarkDistance(fingertip, landmarks[1])
        : null,
    }]
  }))
}

export function ensureFingerTapBaselines(allLandmarks, handRoles, baselines) {
  allLandmarks.forEach((landmarks, handIndex) => {
    const handId = handRoles[handIndex]?.id ?? `hand-${handIndex}`
    if (!hasFingerBaselines(baselines.get(handId))) {
      baselines.set(handId, collectOpenHandFingerBaselines(landmarks))
    }
  })
}

export function getStableTappedFingersByHand(allLandmarks, handRoles, calibrationBaselines, fingerStates, now = performance.now()) {
  return allLandmarks.map((landmarks, handIndex) => {
    const handId = handRoles[handIndex]?.id ?? `hand-${handIndex}`
    const baseline = calibrationBaselines.get(handId)
    if (!hasFingerBaselines(baseline)) return []

    return FINGERS.filter((finger) => {
      const key = `${handId}-${finger.name}`
      const fingerBaseline = baseline[finger.name]
      const downwardMotion = getFingerTapMotion(landmarks, finger, fingerBaseline)
      const { downThreshold, upThreshold } = getFingerTapThresholds(finger, fingerBaseline)
      const state = fingerStates.get(key) ?? {
        activeAt: null,
        isPressed: false,
        requiresRelease: false,
        tapStartedAt: null,
      }

      if (state.requiresRelease) {
        if (downwardMotion <= upThreshold) state.requiresRelease = false
        state.activeAt = null
        state.isPressed = false
        state.tapStartedAt = null
      } else if (state.isPressed) {
        if (!state.activeAt) state.activeAt = now
        if (state.activeAt && now - state.activeAt >= MAX_NOTE_HOLD_MS) {
          // Never leave a live-performance note stuck; require an extension
          // before the finger may trigger again.
          state.activeAt = null
          state.isPressed = false
          state.requiresRelease = true
        } else if (downwardMotion <= upThreshold) {
          state.activeAt = null
          state.isPressed = false
          state.tapStartedAt = null
        }
      } else {
        if (downwardMotion <= upThreshold) {
          state.tapStartedAt = null
        } else if (state.tapStartedAt === null && downwardMotion >= downThreshold * TAP_START_RATIO) {
          state.tapStartedAt = now
        }

        if (downwardMotion >= downThreshold && state.tapStartedAt !== null && now - state.tapStartedAt <= TAP_WINDOW_MS) {
          state.activeAt = now
          state.isPressed = true
          state.tapStartedAt = null
        } else if (state.tapStartedAt !== null && now - state.tapStartedAt > TAP_WINDOW_MS) {
          // A slow descent is not a piano tap. It must return to rest before
          // it can begin another downstroke.
          state.requiresRelease = true
          state.tapStartedAt = null
        }
      }

      fingerStates.set(key, state)
      return state.isPressed
    })
  })
}

export function getFingerTapDebugData(allLandmarks, handRoles, calibrationBaselines, fingerStates) {
  return allLandmarks.map((landmarks, handIndex) => {
    const handId = handRoles[handIndex]?.id ?? `hand-${handIndex}`
    const handSide = handRoles[handIndex]?.id ?? (handIndex === 0 ? 'right' : 'left')
    const baseline = calibrationBaselines.get(handId)
    const notes = handSide === 'left' ? LEFT_HAND_NOTES : RIGHT_HAND_NOTES

    return {
      color: handRoles[handIndex]?.color,
      id: handId,
      fingers: FINGERS.map((finger) => {
        const fingerBaseline = baseline?.[finger.name]
        const distance = fingerBaseline ? getFingerTapMotion(landmarks, finger, fingerBaseline) : null
        const state = fingerStates.get(`${handId}-${finger.name}`)
        const note = notes[getFingerNoteIndex(handSide, finger, notes.length)]
        const { downThreshold, upThreshold } = fingerBaseline
          ? getFingerTapThresholds(finger, fingerBaseline)
          : {}

        return {
          distance,
          motionAxis: finger.name === 'thumb' ? 'arc' : 'vertical',
          name: finger.name,
          note,
          noteOffThreshold: upThreshold ?? null,
          noteOnThreshold: downThreshold ?? null,
          triggered: Boolean(note && state?.isPressed),
        }
      }),
    }
  })
}

function getHandBySide(allLandmarks, allHandedness, side) {
  const handIndex = allHandedness.findIndex((hand) => getHandSide(hand) === side)
  if (handIndex >= 0) return allLandmarks[handIndex]

  return allLandmarks.length === 1 ? allLandmarks[0] : null
}

export function mapRightHandToNote(landmarks, octaveShift = 0) {
  const normalizedY = clamp(landmarks[0]?.y ?? 1, 0, 1)
  const noteIndex = Math.min(
    PINCH_MELODY_NOTES.length - 1,
    Math.floor((1 - normalizedY) * PINCH_MELODY_NOTES.length),
  )

  return shiftNotes([PINCH_MELODY_NOTES[noteIndex]], octaveShift)[0]
}

export function getOctaveShiftForWrist(wristY, currentShift = 0) {
  if (currentShift === 1) return wristY > 0.44 ? (wristY > 0.72 ? -1 : 0) : 1
  if (currentShift === -1) return wristY < 0.56 ? (wristY < 0.28 ? 1 : 0) : -1
  if (wristY < 0.28) return 1
  if (wristY > 0.72) return -1
  return 0
}

export function isPinching(landmarks) {
  const thumbTip = landmarks[4]
  const indexTip = landmarks[8]
  return Boolean(thumbTip && indexTip && getLandmarkDistance(thumbTip, indexTip) < PINCH_THRESHOLD)
}

export function areBothHandsClosedFists(allLandmarks) {
  return allLandmarks.filter(isClosedFist).length >= 2
}

export function getOpenPalms(allLandmarks, handRoles = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => (
    isOpenPalm(landmarks)
      ? [{ id: handRoles[handIndex]?.id ?? `hand-${handIndex}`, position: landmarks[9] }]
      : []
  ))
}

export function getPeaceSigns(allLandmarks, handRoles = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => (
    isPeaceSign(landmarks)
      ? [{ id: handRoles[handIndex]?.id ?? `hand-${handIndex}`, position: landmarks[9] }]
      : []
  ))
}

function isClosedFist(landmarks) {
  const palmCenter = getPalmCenter(landmarks)
  const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])
  if (!palmCenter || !palmWidth) return false

  return [4, 8, 12, 16, 20].every((tipIndex) => (
    getLandmarkDistance(landmarks[tipIndex], palmCenter) < palmWidth * FIST_THRESHOLD_RATIO
  ))
}

function isOpenPalm(landmarks) {
  const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])
  if (!palmWidth) return false

  const fingertips = FINGERS.map(({ tip }) => landmarks[tip]).filter(Boolean)
  const isFlatToCamera = Math.max(...fingertips.map(({ z }) => z)) - Math.min(...fingertips.map(({ z }) => z)) < 0.3
  return isFlatToCamera && FINGERS.every((finger) => (
    getLandmarkDistance(landmarks[finger.tip], landmarks[finger.knuckle]) > palmWidth * EXTENDED_FINGER_RATIO
  ))
}

function isPeaceSign(landmarks) {
  const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])
  if (!palmWidth) return false

  const isIndexExtended = isFingerExtended(landmarks, FINGERS[1], palmWidth)
  const isMiddleExtended = isFingerExtended(landmarks, FINGERS[2], palmWidth)
  const curledFingers = [FINGERS[0], FINGERS[3], FINGERS[4]]
  return isIndexExtended && isMiddleExtended && curledFingers.every((finger) => isFingerCurled(landmarks, finger, palmWidth))
}

function isFingerExtended(landmarks, finger, palmWidth) {
  return getFingerCurlDistance(landmarks, finger) > palmWidth * EXTENDED_FINGER_RATIO
}

function isFingerCurled(landmarks, finger, palmWidth) {
  if (!palmWidth) return false

  // Scaling the threshold by palm width keeps the gesture consistent at different distances from the camera.
  return getFingerCurlDistance(landmarks, finger) < palmWidth * CURL_THRESHOLD_RATIO
}

function getCurledFingers(landmarks) {
  const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])
  return FINGERS.filter((finger) => isFingerCurled(landmarks, finger, palmWidth))
}

function hasExactFingerShape(curledFingerNames, expectedFingerNames) {
  return curledFingerNames.length === expectedFingerNames.length
    && expectedFingerNames.every((fingerName) => curledFingerNames.includes(fingerName))
}

function getFingerNoteIndex(handSide, finger, noteCount) {
  return handSide === 'left' ? noteCount - 1 - finger.noteIndex : finger.noteIndex
}

function getHandSide(handedness, handIndex = 0) {
  const label = (handedness?.[0]?.categoryName ?? handedness?.[0]?.displayName ?? '').toLowerCase()
  if (label === 'left' || label === 'right') return label

  return handIndex === 0 ? 'right' : 'left'
}

function getLandmarkDistance(first, second) {
  if (!first || !second) return 0
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function getFingerCurlDistance(landmarks, finger) {
  const fingertip = landmarks[finger.tip]
  if (!fingertip) return 0

  if (finger.name === 'thumb') return getLandmarkDistance(fingertip, getPalmCenter(landmarks))
  return getLandmarkDistance(fingertip, landmarks[finger.knuckle])
}

function getFingerRelativeY(landmarks, finger) {
  return (landmarks[finger.tip]?.y ?? 0) - (landmarks[0]?.y ?? 0)
}

function getFingerTapMotion(landmarks, finger, baseline) {
  if (finger.name === 'thumb') {
    // Thumb presses travel diagonally across the palm, so measure how much the
    // tip retracts toward its own CMC joint instead of its screen-space Y.
    return baseline.thumbArcDistance - getLandmarkDistance(landmarks[finger.tip], landmarks[1])
  }

  return getFingerRelativeY(landmarks, finger) - baseline.restY
}

function getFingerTapThresholds(finger, baseline) {
  const isThumb = finger.name === 'thumb'
  const downRatio = isThumb ? THUMB_TAP_DOWN_RATIO : TAP_DOWN_RATIO
  const upRatio = isThumb ? THUMB_TAP_UP_RATIO : TAP_UP_RATIO

  return {
    downThreshold: Math.max(isThumb ? 0.014 : 0.018, baseline.fingerLength * downRatio),
    upThreshold: Math.max(isThumb ? 0.008 : 0.01, baseline.fingerLength * upRatio),
  }
}

function hasFingerBaselines(baseline) {
  return FINGERS.every((finger) => (
    Number.isFinite(baseline?.[finger.name]?.fingerLength)
    && baseline[finger.name].fingerLength > 0
    && Number.isFinite(baseline[finger.name].restY)
    && (finger.name !== 'thumb' || Number.isFinite(baseline[finger.name].thumbArcDistance))
  ))
}

function getPalmCenter(landmarks) {
  const palmLandmarks = [0, 5, 9, 13, 17].map((index) => landmarks[index]).filter(Boolean)
  if (!palmLandmarks.length) return null

  return palmLandmarks.reduce(
    (center, landmark) => ({
      x: center.x + landmark.x / palmLandmarks.length,
      y: center.y + landmark.y / palmLandmarks.length,
      z: center.z + landmark.z / palmLandmarks.length,
    }),
    { x: 0, y: 0, z: 0 },
  )
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function shiftNotes(notes, octaveShift) {
  return notes.map((note) => note.replace(/(\d+)$/, (octave) => String(Number(octave) + octaveShift)))
}
