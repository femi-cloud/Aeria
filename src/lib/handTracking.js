import { HAND_CONNECTIONS, Hands, VERSION } from '@mediapipe/hands'

const HANDS_CDN_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}`
const LITE_MODEL_COMPLEXITY = 0
let creationCount = 0

export async function createLiteHandTracker(onResults) {
  const instanceId = ++creationCount
  const gpuDiagnostics = getGpuDiagnostics()
  const runtimeDelegate = gpuDiagnostics.webglAvailable
    ? 'GPU/WebGL available (MediaPipe Hands does not expose a delegate getter)'
    : 'CPU/WASM fallback likely (WebGL unavailable)'

  if (import.meta.env.DEV) {
    console.info('[Aeria] Creating Lite Hands tracker', {
      delegateReportedByMediaPipe: 'not exposed by the public Hands API',
      instanceId,
      modelComplexity: LITE_MODEL_COMPLEXITY,
      runtimeDelegate,
      ...gpuDiagnostics,
    })
  }

  const hands = new Hands({ locateFile: (file) => `${HANDS_CDN_ROOT}/${file}` })
  hands.setOptions({
    maxNumHands: 2,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.7,
    modelComplexity: LITE_MODEL_COMPLEXITY,
    // The video is mirrored in CSS. Keep the model input raw, then flip its
    // raw labels once below so every consumer uses screen-consistent identity.
    selfieMode: false,
  })
  hands.onResults((results) => {
    onResults({
      handedness: (results.multiHandedness ?? []).map(({ label, score }) => {
        const rawCategoryName = label.toLowerCase()
        return [{
          categoryName: flipHandedness(rawCategoryName),
          rawCategoryName,
          score,
        }]
      }),
      landmarks: results.multiHandLandmarks ?? [],
    })
  })
  await hands.initialize()

  if (import.meta.env.DEV) {
    console.info('[Aeria] Lite Hands tracker ready', {
      delegateReportedByMediaPipe: 'not exposed by the public Hands API',
      instanceId,
      model: 'hand_landmark_lite.tflite',
      modelComplexity: LITE_MODEL_COMPLEXITY,
      runtimeDelegate,
    })
  }

  return { hands, instanceId, runtimeDelegate }
}

function flipHandedness(label) {
  if (label === 'left') return 'Right'
  if (label === 'right') return 'Left'
  return label
}

function getGpuDiagnostics() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    ?? canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })
  const debugInfo = context?.getExtension('WEBGL_debug_renderer_info')

  return {
    gpuRenderer: debugInfo ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unavailable',
    webglAvailable: Boolean(context),
  }
}

export { HAND_CONNECTIONS }
