import { useEffect, useRef, useState } from 'react'
import { createHandLandmarker, HandLandmarker } from '../lib/handTracking.js'

const HAND_COLORS = ['#a791ff', '#5be6b3']
const HAND_IDENTITY_COLORS = ['#a791ff', '#5be6b3', '#ff9d68', '#68c8ff']
const LOG_INTERVAL_MS = 500

function HandTracker({ videoRef, onError, onResults, reloadKey }) {
  const canvasRef = useRef(null)
  const lastLogTimeRef = useRef(0)
  const hasHandsRef = useRef(false)
  const previousHandsRef = useRef([])
  const nextHandIdRef = useRef(1)
  const [isLoading, setIsLoading] = useState(true)
  const [hasHands, setHasHands] = useState(false)

  useEffect(() => {
    let animationFrameId
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
        detectHands()
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
      if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const results = handLandmarker.detectForVideo(video, performance.now())
          const landmarks = results.landmarks ?? []
          const identities = assignHandIdentities(landmarks, results.handedness ?? [], previousHandsRef, nextHandIdRef)

          drawHandSkeleton(canvas, video, landmarks, identities)
          updateHandHint(landmarks.length > 0)
          logLandmarks(landmarks)
          onResults({ landmarks, handedness: results.handedness ?? [], identities })
        } catch (error) {
          onError('Hand tracking stopped unexpectedly. Refresh the page to try again.')
          console.error('Aeria: MediaPipe hand detection failed.', error)
          return
        }
      }

      animationFrameId = requestAnimationFrame(detectHands)
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
}

function drawHandSkeleton(canvas, video, hands, identities) {
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
    const color = identities[handIndex]?.color ?? HAND_COLORS[handIndex % HAND_COLORS.length]
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

function assignHandIdentities(landmarks, handedness, previousHandsRef, nextHandIdRef) {
  const previousHands = previousHandsRef.current
  const matches = []

  landmarks.forEach((hand, handIndex) => {
    previousHands.forEach((previousHand, previousIndex) => {
      const wrist = hand[0]
      const distance = Math.hypot(wrist.x - previousHand.wrist.x, wrist.y - previousHand.wrist.y)
      const currentLabel = handedness[handIndex]?.[0]?.categoryName
      const handednessPenalty = currentLabel && previousHand.label && currentLabel !== previousHand.label ? 0.12 : 0
      matches.push({ distance: distance + handednessPenalty, handIndex, previousIndex })
    })
  })

  matches.sort((first, second) => first.distance - second.distance)
  const identities = Array(landmarks.length)
  const usedHands = new Set()
  const usedPreviousHands = new Set()

  matches.forEach(({ distance, handIndex, previousIndex }) => {
    if (distance > 0.35 || usedHands.has(handIndex) || usedPreviousHands.has(previousIndex)) return
    identities[handIndex] = previousHands[previousIndex].identity
    usedHands.add(handIndex)
    usedPreviousHands.add(previousIndex)
  })

  landmarks.forEach((hand, handIndex) => {
    if (identities[handIndex]) return
    const idNumber = nextHandIdRef.current++
    identities[handIndex] = {
      color: HAND_IDENTITY_COLORS[(idNumber - 1) % HAND_IDENTITY_COLORS.length],
      id: `hand-${idNumber}`,
    }
  })

  previousHandsRef.current = landmarks.map((hand, handIndex) => ({
    identity: identities[handIndex],
    label: handedness[handIndex]?.[0]?.categoryName,
    wrist: hand[0],
  }))

  return identities
}

export default HandTracker
