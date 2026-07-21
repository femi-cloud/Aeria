import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const WASM_ROOT = '/mediapipe-tasks-vision'
const HAND_LANDMARKER_MODEL = '/models/hand_landmarker.task'
let creationCount = 0

export async function createHandLandmarker() {
  const instanceId = ++creationCount
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      delegate: 'GPU',
      modelAssetPath: HAND_LANDMARKER_MODEL,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.75,
    minHandPresenceConfidence: 0.75,
    minTrackingConfidence: 0.7,
  })

  if (import.meta.env.DEV) {
    console.info('[Aeria] Tasks HandLandmarker ready', { delegate: 'GPU', instanceId })
  }

  return { handLandmarker, instanceId }
}

export function mapMirroredHandedness(handedness = []) {
  return handedness.map((hand) => {
    const rawCategoryName = hand?.[0]?.categoryName?.toLowerCase()
    // The video is mirrored with CSS for a natural selfie view, while
    // MediaPipe receives the unmirrored camera pixels. Its raw label must be
    // inverted exactly once before the rest of Aeria assigns a hand role.
    const categoryName = getMirroredAppHandedness(rawCategoryName)
    return [{ ...hand?.[0], categoryName, displayName: categoryName, rawCategoryName }]
  })
}

export function getMirroredAppHandedness(rawCategoryName) {
  if (rawCategoryName === 'left') return 'Right'
  if (rawCategoryName === 'right') return 'Left'
  return rawCategoryName
}

export { HandLandmarker }
