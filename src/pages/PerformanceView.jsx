import { useCallback, useEffect, useRef, useState } from 'react'
import HandTracker from '../components/HandTracker.jsx'
import ParticleCanvas from '../components/ParticleCanvas.jsx'
import { getCurledFingerNotes, getRightHand, isPinching, mapRightHandToNote } from '../lib/gestureMapping.js'
import { disposeMusicEngine, startMusicEngine, stopPlayedNotes, updateFingerNotes, updatePinchNote } from '../lib/musicEngine.js'

const cameraConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

function PerformanceView() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const controlModeRef = useRef('piano')
  const particleCanvasRef = useRef(null)
  const activeFingerIdsRef = useRef(new Set())
  const pinchWasActiveRef = useRef(false)
  const [cameraState, setCameraState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [audioError, setAudioError] = useState('')
  const [activeNotes, setActiveNotes] = useState([])
  const [controlMode, setControlMode] = useState('piano')

  const handleTrackingError = useCallback((message) => {
    setTrackingError(message)
  }, [])

  const handleHandResults = useCallback(({ landmarks, handedness }) => {
    if (controlModeRef.current === 'pinch') {
      const rightHand = getRightHand(landmarks, handedness)
      const pinching = rightHand ? isPinching(rightHand) : false
      const note = rightHand ? mapRightHandToNote(rightHand) : undefined
      if (pinching && !pinchWasActiveRef.current) {
        particleCanvasRef.current?.spawnBurst({ note, position: rightHand[8] })
      }
      pinchWasActiveRef.current = pinching
      const nextActiveNotes = updatePinchNote({
        note,
        pinching,
      })
      setActiveNotes((currentNotes) => (
        currentNotes.join('|') === nextActiveNotes.join('|') ? currentNotes : nextActiveNotes
      ))
      return
    }

    const curledFingerNotes = getCurledFingerNotes(landmarks, handedness)
    const nextFingerIds = new Set(curledFingerNotes.map(({ id }) => id))
    curledFingerNotes.forEach((finger) => {
      if (!activeFingerIdsRef.current.has(finger.id)) {
        particleCanvasRef.current?.spawnBurst(finger)
      }
    })
    activeFingerIdsRef.current = nextFingerIds
    const nextActiveNotes = updateFingerNotes(curledFingerNotes)
    setActiveNotes((currentNotes) => (
      currentNotes.join('|') === nextActiveNotes.join('|') ? currentNotes : nextActiveNotes
    ))
  }, [])

  useEffect(() => {
    controlModeRef.current = controlMode
    stopPlayedNotes()
    activeFingerIdsRef.current = new Set()
    pinchWasActiveRef.current = false
    setActiveNotes([])
  }, [controlMode])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      disposeMusicEngine()
    }
  }, [])

  async function requestCameraAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error')
      setErrorMessage('Camera access is not supported in this browser. Try a current version of Chrome, Edge, or Firefox.')
      return
    }

    setCameraState('requesting')
    setErrorMessage('')
    setTrackingError('')
    setAudioError('')

    try {
      await startMusicEngine()
    } catch (error) {
      setAudioError('Sound could not start. Check your browser audio permissions, then try again.')
      console.error('Aeria: failed to start the audio engine.', error)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraState('active')
    } catch (error) {
      setCameraState('error')
      setErrorMessage(getCameraErrorMessage(error))
    }
  }

  return (
    <main className="ae-performance">
      <section className="ae-performance__intro">
        <p className="ae-performance__eyebrow">Gesture-controlled music</p>
        <h1>Aeria</h1>
        <p className="ae-performance__description">
          Shape sound with your hands. Allow camera access to enter the performance space.
        </p>
        <div className="ae-control-mode" role="group" aria-label="Performance control mode">
          <button
            className={`ae-control-mode__button ${controlMode === 'piano' ? 'ae-control-mode__button--active' : ''}`}
            type="button"
            onClick={() => setControlMode('piano')}
            aria-pressed={controlMode === 'piano'}
          >
            Piano keys
          </button>
          <button
            className={`ae-control-mode__button ${controlMode === 'pinch' ? 'ae-control-mode__button--active' : ''}`}
            type="button"
            onClick={() => setControlMode('pinch')}
            aria-pressed={controlMode === 'pinch'}
          >
            Pinch melody
          </button>
        </div>
      </section>

      <section className="ae-camera" aria-live="polite">
        <video
          ref={videoRef}
          className="ae-camera__video"
          autoPlay
          muted
          playsInline
          aria-label="Live webcam feed"
        />
        {cameraState === 'active' && (
          <>
            <HandTracker videoRef={videoRef} onError={handleTrackingError} onResults={handleHandResults} />
            <ParticleCanvas ref={particleCanvasRef} videoRef={videoRef} />
            <p className="ae-active-notes">
              Active notes <strong>{activeNotes.length ? activeNotes.join(' · ') : '—'}</strong>
            </p>
          </>
        )}
        {cameraState !== 'active' && (
          <div className="ae-camera__prompt">
            <span className="ae-camera__icon" aria-hidden="true">◉</span>
            <h2>{cameraState === 'error' ? 'Camera unavailable' : 'Allow camera access'}</h2>
            <p>
              {cameraState === 'error'
                ? errorMessage
                : 'Aeria uses your webcam locally to see your hand gestures. No video is uploaded or recorded.'}
            </p>
            <button
              className="ae-button"
              type="button"
              onClick={requestCameraAccess}
              disabled={cameraState === 'requesting'}
            >
              {cameraState === 'requesting' ? 'Requesting access…' : cameraState === 'error' ? 'Try again' : 'Enable camera'}
            </button>
          </div>
        )}
        {trackingError && <p className="ae-camera__notice ae-camera__notice--error">{trackingError}</p>}
      </section>

      {cameraState === 'active' && (
        <p className="ae-status">
          <span aria-hidden="true">●</span>{' '}
          {controlMode === 'piano'
            ? 'Curl a finger toward your palm to play; use both hands for chords.'
            : 'Move your right hand up or down to choose a pentatonic note, then pinch to play it.'}
        </p>
      )}
      {audioError && <p className="ae-audio-error">{audioError}</p>}
    </main>
  )
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Camera permission was denied. Enable it in your browser settings, then try again.'
  }

  if (error?.name === 'NotFoundError') {
    return 'No camera was found. Connect a webcam, then try again.'
  }

  if (error?.name === 'NotReadableError') {
    return 'Your camera is being used by another application. Close it, then try again.'
  }

  return 'We could not start the camera. Check your camera connection and browser permissions, then try again.'
}

export default PerformanceView
