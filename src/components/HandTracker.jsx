import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createHandLandmarker, HandLandmarker } from '../lib/handTracking.js'

const HAND_COLORS = ['#a791ff', '#5be6b3']
const LOG_INTERVAL_MS = 1000
const DUPLICATE_WRIST_DISTANCE_RATIO = 0.7
const MIN_HANDEDNESS_CONFIDENCE = 0.75
const MIN_PALM_SIZE = 0.025
const MAX_PALM_SIZE = 0.65
const MAX_FINGER_REACH_RATIO = 4
const MAX_WRIST_JUMP_PALM_MULTIPLIER = 4.5
const WRIST_JUMP_GRACE_MS = 220

const HandTracker = forwardRef(function HandTracker({ videoRef, onError, onResults, reloadKey }, ref) {
  const canvasRef = useRef(null)
  const lastLogTimeRef = useRef(0)
  const hasHandsRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const previousValidHandsRef = useRef(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [hasHands, setHasHands] = useState(false)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }), [])

  useEffect(() => {
    let animationFrameId
    let videoFrameCallbackId
    let handLandmarker
    let isDisposed = false

    async function startTracking() {
      setIsLoading(true)
      setHasHands(false)
      try {
        handLandmarker = await createHandLandmarker()
        if (isDisposed) {
          handLandmarker.close()
          return
        }

        setIsLoading(false)
        scheduleNextDetection()
      } catch (error) {
        if (!isDisposed) {
          setIsLoading(false)
          onError('Hand tracking could not load. Check your internet connection, then refresh and try again.')
          console.error('Aeria: failed to initialize MediaPipe Hand Landmarker.', error)
        }
      }
    }

    function detectHands() {
      if (isDisposed) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const hasNewVideoFrame = video?.currentTime !== lastVideoTimeRef.current
      if (video && canvas && hasNewVideoFrame && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          lastVideoTimeRef.current = video.currentTime
          const results = handLandmarker.detectForVideo(video, performance.now())
          const { landmarks, handedness } = filterOverlappingHands(
            results.landmarks ?? [],
            results.handedness ?? [],
          )
          const isValidFrame = areHandsStableAndPlausible(
            landmarks,
            handedness,
            previousValidHandsRef.current,
            performance.now(),
          )

          if (!isValidFrame) {
            drawHandSkeleton(canvas, video, [], [])
          } else {
            drawHandSkeleton(canvas, video, landmarks, handedness)
            updateHandHint(landmarks.length > 0)
            logLandmarks(landmarks)
            onResults({ landmarks, handedness })
          }
        } catch (error) {
          onError('Hand tracking stopped unexpectedly. Refresh the page to try again.')
          console.error('Aeria: MediaPipe hand detection failed.', error)
          return
        }
      }

      scheduleNextDetection()
    }

    function scheduleNextDetection() {
      const video = videoRef.current
      if (video?.requestVideoFrameCallback) {
        videoFrameCallbackId = video.requestVideoFrameCallback(detectHands)
      } else {
        animationFrameId = requestAnimationFrame(detectHands)
      }
    }

    function updateHandHint(nextHasHands) {
      if (hasHandsRef.current !== nextHasHands) {
        hasHandsRef.current = nextHasHands
        setHasHands(nextHasHands)
      }
    }

    function logLandmarks(landmarks) {
      const now = performance.now()
      if (landmarks.length && now - lastLogTimeRef.current >= LOG_INTERVAL_MS) {
        lastLogTimeRef.current = now
        console.log('Aeria hand landmarks:', landmarks.map((hand) => hand.map(({ x, y, z }) => ({ x, y, z }))))
      }
    }

    startTracking()

    return () => {
      isDisposed = true
      cancelAnimationFrame(animationFrameId)
      videoRef.current?.cancelVideoFrameCallback?.(videoFrameCallbackId)
      handLandmarker?.close()
    }
  }, [onError, onResults, reloadKey, videoRef])

  return (
    <>
      <canvas ref={canvasRef} className="ae-hand-tracker" aria-hidden="true" />
      {isLoading && <p className="ae-hand-tracker__loading">Loading hand tracking…</p>}
      {!isLoading && !hasHands && <p className="ae-hand-tracker__hint">Show your hands to the camera</p>}
    </>
  )
})

function drawHandSkeleton(canvas, video, hands, handedness) {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)

  hands.forEach((hand, handIndex) => {
    const color = getHandColor(handedness[handIndex], handIndex)
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = Math.max(3, width * 0.003)

    HandLandmarker.HAND_CONNECTIONS.forEach(({ start, end }) => {
      const from = hand[start]
      const to = hand[end]
      context.beginPath()
      context.moveTo(from.x * width, from.y * height)
      context.lineTo(to.x * width, to.y * height)
      context.stroke()
    })

    hand.forEach((landmark) => {
      context.beginPath()
      context.arc(landmark.x * width, landmark.y * height, Math.max(4, width * 0.005), 0, Math.PI * 2)
      context.fill()
    })
  })
}

function getHandColor(handedness, handIndex) {
  const label = handedness?.[0]?.categoryName?.toLowerCase()
  if (label === 'left') return HAND_COLORS[1]
  if (label === 'right') return HAND_COLORS[0]
  return HAND_COLORS[handIndex % HAND_COLORS.length]
}

function filterOverlappingHands(landmarks, handedness) {
  if (landmarks.length !== 2) return { landmarks, handedness }

  const [firstHand, secondHand] = landmarks
  const wristDistance = getLandmarkDistance(firstHand[0], secondHand[0])
  const averagePalmSize = (getPalmSize(firstHand) + getPalmSize(secondHand)) / 2

  // Two independent hands cannot have nearly coincident wrists relative to their palm size.
  if (!averagePalmSize || wristDistance >= averagePalmSize * DUPLICATE_WRIST_DISTANCE_RATIO) {
    return { landmarks, handedness }
  }

  const firstScore = handedness[0]?.[0]?.score ?? 0
  const secondScore = handedness[1]?.[0]?.score ?? 0
  const keepIndex = secondScore > firstScore ? 1 : 0

  return {
    landmarks: [landmarks[keepIndex]],
    handedness: handedness[keepIndex] ? [handedness[keepIndex]] : [],
  }
}

function getPalmSize(hand) {
  const wrist = hand[0]
  const knuckles = [5, 9, 13, 17].map((index) => hand[index]).filter(Boolean)
  if (!wrist || !knuckles.length) return 0

  return knuckles.reduce((total, knuckle) => total + getLandmarkDistance(wrist, knuckle), 0) / knuckles.length
}

function getLandmarkDistance(first, second) {
  if (!first || !second) return 0
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function areHandsStableAndPlausible(landmarks, handedness, previousHands, now) {
  if (!landmarks.length) {
    previousHands.clear()
    return true
  }

  const nextHands = new Map()
  const areAllHandsValid = landmarks.every((hand, handIndex) => {
    const palmSize = getPalmSize(hand)
    if (!isPlausibleHand(hand, handedness[handIndex], palmSize)) return false

    const key = getHandTrackingKey(handedness[handIndex], handIndex)
    const previous = previousHands.get(key)
    const wristJump = previous ? getLandmarkDistance(hand[0], previous.wrist) : 0
    const jumpThreshold = Math.max(0.14, ((palmSize + (previous?.palmSize ?? palmSize)) / 2) * MAX_WRIST_JUMP_PALM_MULTIPLIER)
    if (previous && now - previous.seenAt < WRIST_JUMP_GRACE_MS && wristJump > jumpThreshold) return false

    nextHands.set(key, { palmSize, seenAt: now, wrist: hand[0] })
    return true
  })

  if (!areAllHandsValid) return false
  previousHands.clear()
  nextHands.forEach((hand, key) => previousHands.set(key, hand))
  return true
}

function isPlausibleHand(hand, handedness, palmSize) {
  if (hand.length !== 21 || palmSize < MIN_PALM_SIZE || palmSize > MAX_PALM_SIZE) return false

  const confidence = handedness?.[0]?.score
  if (Number.isFinite(confidence) && confidence < MIN_HANDEDNESS_CONFIDENCE) return false

  const coordinatesAreFinite = hand.every(({ x, y, z }) => (
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
      && x >= -0.2 && x <= 1.2 && y >= -0.2 && y <= 1.2 && z >= -1.2 && z <= 1.2
  ))
  if (!coordinatesAreFinite) return false

  return [[4, 2], [8, 5], [12, 9], [16, 13], [20, 17]].every(([tip, knuckle]) => (
    getLandmarkDistance(hand[tip], hand[knuckle]) <= palmSize * MAX_FINGER_REACH_RATIO
  ))
}

function getHandTrackingKey(handedness, handIndex) {
  const label = handedness?.[0]?.categoryName?.toLowerCase()
  return label === 'left' || label === 'right' ? label : `hand-${handIndex}`
}

export default HandTracker
