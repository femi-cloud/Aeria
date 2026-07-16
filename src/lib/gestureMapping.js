const FINGERS = [
  { name: 'thumb', tip: 4, knuckle: 2, noteIndex: 0 },
  { name: 'index', tip: 8, knuckle: 5, noteIndex: 1 },
  { name: 'middle', tip: 12, knuckle: 9, noteIndex: 2 },
  { name: 'ring', tip: 16, knuckle: 13, noteIndex: 3 },
  { name: 'pinky', tip: 20, knuckle: 17, noteIndex: 4 },
]

const LEFT_HAND_NOTES = ['C3', 'D3', 'E3', 'G3', 'A3']
const RIGHT_HAND_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4']
const PINCH_MELODY_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5']
const CURL_THRESHOLD_RATIO = 0.95
const PINCH_THRESHOLD = 0.06

export function getCurledFingerNotes(allLandmarks, allHandedness) {
  return allLandmarks.flatMap((landmarks, handIndex) => {
    const handSide = getHandSide(allHandedness[handIndex], handIndex)
    const notes = handSide === 'left' ? LEFT_HAND_NOTES : RIGHT_HAND_NOTES
    const palmWidth = getLandmarkDistance(landmarks[5], landmarks[17])

    return FINGERS
      .filter((finger) => isFingerCurled(landmarks, finger, palmWidth))
      .map((finger) => ({
        id: `${handSide}-${finger.name}`,
        note: notes[finger.noteIndex],
        position: landmarks[finger.tip],
      }))
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

function isFingerCurled(landmarks, finger, palmWidth) {
  const fingertip = landmarks[finger.tip]
  const lowerKnuckle = landmarks[finger.knuckle]
  if (!fingertip || !lowerKnuckle || !palmWidth) return false

  // Scaling the threshold by palm width keeps the gesture consistent at different distances from the camera.
  return getLandmarkDistance(fingertip, lowerKnuckle) < palmWidth * CURL_THRESHOLD_RATIO
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
