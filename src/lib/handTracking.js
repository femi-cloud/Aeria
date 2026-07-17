import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      delegate: 'GPU',
      modelAssetPath: HAND_LANDMARKER_MODEL,
    },
    runningMode: 'VIDEO',
    numHands: 4,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  })
}

export { HandLandmarker }
