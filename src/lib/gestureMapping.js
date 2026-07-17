const FINGERS = [
  { name: 'thumb', tip: 4, knuckle: 2, noteIndex: 0 },
  { name: 'index', tip: 8, knuckle: 5, noteIndex: 1 },
  { name: 'middle', tip: 12, knuckle: 9, noteIndex: 2 },
  { name: 'ring', tip: 16, knuckle: 13, noteIndex: 3 },
  { name: 'pinky', tip: 20, knuckle: 17, noteIndex: 4 },
]

const CHORD_SHAPES = [
  { fingers: ['thumb', 'middle', 'pinky'], id: 'c-major', name: 'C major', rightNotes: ['C4', 'E4', 'G4'], leftNotes: ['C3', 'E3', 'G3'] },
  { fingers: ['index', 'ring'], id: 'a-minor', name: 'A minor', rightNotes: ['A3', 'C4', 'E4'], leftNotes: ['A2', 'C3', 'E3'] },
]

const LEFT_HAND_NOTES = ['C3', 'D3', 'E3', 'G3', 'A3']
const RIGHT_HAND_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4']
const PINCH_MELODY_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5']
const CURL_THRESHOLD_RATIO = 0.95
const PINCH_THRESHOLD = 0.06
const FIST_THRESHOLD_RATIO = 1.1
const EXTENDED_FINGER_RATIO = 1.2

export function getCurledFingerNotes(allLandmarks, allHandedness, handIdentities = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handSide = getHandSide(allHandedness[handIndex], handIndex)
    const handIdentity = handIdentities[handIndex]
    const notes = handSide === 'left' ? LEFT_HAND_NOTES : RIGHT_HAND_NOTES
    const curledFingers = getCurledFingers(landmarks)

    return curledFingers
      .map((finger) => ({
        id: `${handIdentity?.id ?? `${handSide}-${handIndex}`}-${finger.name}`,
        handColor: handIdentity?.color,
        note: notes[finger.noteIndex],
        position: landmarks[finger.tip],
      }))
  })
}

export function getCurledFingerChords(allLandmarks, allHandedness, handIdentities = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handSide = getHandSide(allHandedness[handIndex], handIndex)
    const handIdentity = handIdentities[handIndex]
    const curledFingers = getCurledFingers(landmarks)
    const curledFingerNames = curledFingers.map(({ name }) => name)
    const chord = CHORD_SHAPES.find(({ fingers }) => hasExactFingerShape(curledFingerNames, fingers))
    if (!chord) return []

    return [{
      id: `${handIdentity?.id ?? `${handSide}-${handIndex}`}-${chord.id}`,
      handColor: handIdentity?.color,
      name: chord.name,
      notes: handSide === 'left' ? chord.leftNotes : chord.rightNotes,
      position: landmarks[curledFingers[0].tip],
    }]
  })
}

export function getRightHand(allLandmarks, allHandedness) {
  const rightHandIndex = allHandedness.findIndex((hand) => getHandSide(hand) === 'right')
  if (rightHandIndex >= 0) return allLandmarks[rightHandIndex]

  return allLandmarks.length === 1 ? allLandmarks[0] : null
}

export function mapRightHandToNote(landmarks) {
  const normalizedY = clamp(landmarks[0]?.y ?? 1, 0, 1)
  const noteIndex = Math.min(
    PINCH_MELODY_NOTES.length - 1,
    Math.floor((1 - normalizedY) * PINCH_MELODY_NOTES.length),
  )

  return PINCH_MELODY_NOTES[noteIndex]
}

export function isPinching(landmarks) {
  const thumbTip = landmarks[4]
  const indexTip = landmarks[8]
  return Boolean(thumbTip && indexTip && getLandmarkDistance(thumbTip, indexTip) < PINCH_THRESHOLD)
}

export function areBothHandsClosedFists(allLandmarks) {
  return allLandmarks.filter(isClosedFist).length >= 2
}

export function getOpenPalms(allLandmarks, handIdentities = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => (
    isOpenPalm(landmarks)
      ? [{ id: handIdentities[handIndex]?.id ?? `hand-${handIndex}`, position: landmarks[9] }]
      : []
  ))
}

export function getPeaceSigns(allLandmarks, handIdentities = []) {
  return allLandmarks.flatMap((landmarks, handIndex) => (
    isPeaceSign(landmarks)
      ? [{ id: handIdentities[handIndex]?.id ?? `hand-${handIndex}`, position: landmarks[9] }]
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
