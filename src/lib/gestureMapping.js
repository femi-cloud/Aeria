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

// Together, both hands form one C-major octave: right hand C–G, left hand A–high C.
const RIGHT_HAND_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4']
const LEFT_HAND_NOTES = ['A4', 'B4', 'C5']
const PINCH_MELODY_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6']
const CURL_THRESHOLD_RATIO = 0.95
const PINCH_THRESHOLD = 0.06
const FIST_THRESHOLD_RATIO = 1.1
const EXTENDED_FINGER_RATIO = 1.2
// Compare against each user's calibrated open-hand distance. A generous note-on
// threshold makes partial curls feel playable, while the higher release point prevents sticking.
const NOTE_ON_RATIO = 0.72
const NOTE_OFF_RATIO = 0.84
const NOTE_ON_HOLD_MS = 90

export function getCurledFingerNotes(allLandmarks, allHandedness, handRoles = [], handOctaveShifts = [], stableFingersByHand = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handSide = getHandSide(allHandedness[handIndex], handIndex)
    const handRole = handRoles[handIndex]
    const notes = shiftNotes(handSide === 'left' ? LEFT_HAND_NOTES : RIGHT_HAND_NOTES, handOctaveShifts[handIndex] ?? 0)
    const curledFingers = stableFingersByHand[handIndex] ?? getCurledFingers(landmarks)

    return curledFingers
      .filter((finger) => notes[finger.noteIndex])
      .map((finger) => ({
        id: `${handRole?.id ?? `${handSide}-${handIndex}`}-${finger.name}`,
        handColor: handRole?.color,
        note: notes[finger.noteIndex],
        octaveShift: handOctaveShifts[handIndex] ?? 0,
        position: landmarks[finger.tip],
      }))
  })
}

export function getCurledFingerChords(allLandmarks, allHandedness, handRoles = [], handOctaveShifts = [], stableFingersByHand = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handSide = getHandSide(allHandedness[handIndex], handIndex)
    const handRole = handRoles[handIndex]
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

export function collectOpenHandFingerDistances(landmarks) {
  return Object.fromEntries(FINGERS.map((finger) => [
    finger.name,
    getLandmarkDistance(landmarks[finger.tip], landmarks[finger.knuckle]),
  ]))
}

export function getStableCurledFingersByHand(allLandmarks, handRoles, calibrationBaselines, fingerStates, now = performance.now()) {
  return allLandmarks.map((landmarks, handIndex) => {
    const handId = handRoles[handIndex]?.id ?? `hand-${handIndex}`
    const baseline = calibrationBaselines.get(handId)
    const fallbackBaseline = getLandmarkDistance(landmarks[5], landmarks[17]) * 2

    return FINGERS.filter((finger) => {
      const key = `${handId}-${finger.name}`
      const distance = getLandmarkDistance(landmarks[finger.tip], landmarks[finger.knuckle])
      const openDistance = baseline?.[finger.name] ?? fallbackBaseline
      const state = fingerStates.get(key) ?? { isCurled: false, startedAt: null }

      if (state.isCurled) {
        if (distance >= openDistance * NOTE_OFF_RATIO) {
          state.isCurled = false
          state.startedAt = null
        }
      } else if (distance <= openDistance * NOTE_ON_RATIO) {
        if (state.startedAt === null) state.startedAt = now
        if (now - state.startedAt >= NOTE_ON_HOLD_MS) state.isCurled = true
      } else {
        state.startedAt = null
      }

      fingerStates.set(key, state)
      return state.isCurled
    })
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
  return getLandmarkDistance(landmarks[finger.tip], landmarks[finger.knuckle]) > palmWidth * EXTENDED_FINGER_RATIO
}

function isFingerCurled(landmarks, finger, palmWidth) {
  const fingertip = landmarks[finger.tip]
  const lowerKnuckle = landmarks[finger.knuckle]
  if (!fingertip || !lowerKnuckle || !palmWidth) return false

  // Scaling the threshold by palm width keeps the gesture consistent at different distances from the camera.
  return getLandmarkDistance(fingertip, lowerKnuckle) < palmWidth * CURL_THRESHOLD_RATIO
}

function getCurledFingers(landmarks) {
  const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])
  return FINGERS.filter((finger) => isFingerCurled(landmarks, finger, palmWidth))
}

function hasExactFingerShape(curledFingerNames, expectedFingerNames) {
  return curledFingerNames.length === expectedFingerNames.length
    && expectedFingerNames.every((fingerName) => curledFingerNames.includes(fingerName))
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
