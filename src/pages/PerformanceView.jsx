import { useCallback, useEffect, useRef, useState } from 'react'
import HandTracker from '../components/HandTracker.jsx'
import InstrumentBadge from '../components/InstrumentBadge.jsx'
import OnboardingOverlay from '../components/OnboardingOverlay.jsx'
import ParticleCanvas from '../components/ParticleCanvas.jsx'
import { areBothHandsClosedFists, getCurledFingerChords, getCurledFingerNotes, getRightHand, isPinching, mapRightHandToNote } from '../lib/gestureMapping.js'
import { cycleInstrument, disposeMusicEngine, startMusicEngine, stopPlayedNotes, updateChordNotes, updateFingerNotes, updatePinchNote } from '../lib/musicEngine.js'
import { createRhythmDetector } from '../lib/rhythmDetection.js'

const cameraConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

const FIST_HOLD_DURATION_MS = 400

function PerformanceView() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const controlModeRef = useRef('piano')
  const playModeRef = useRef('notes')
  const particleCanvasRef = useRef(null)
  const activeFingerIdsRef = useRef(new Set())
  const pinchWasActiveRef = useRef(false)
  const fistStartedAtRef = useRef(null)
  const fistSwitchTriggeredRef = useRef(false)
  const rhythmDetectorRef = useRef(createRhythmDetector())
  const rhythmTimeoutRef = useRef(null)
  const [cameraState, setCameraState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [audioError, setAudioError] = useState('')
  const [activeNotes, setActiveNotes] = useState([])
  const [controlMode, setControlMode] = useState('piano')
  const [playMode, setPlayMode] = useState('notes')
  const [activeInstrument, setActiveInstrument] = useState('Piano')
  const [instrumentPulseId, setInstrumentPulseId] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isVideoHidden, setIsVideoHidden] = useState(false)
  const [trackingRetryKey, setTrackingRetryKey] = useState(0)
  const [detectedBpm, setDetectedBpm] = useState(null)
  const [isTempoPulseActive, setIsTempoPulseActive] = useState(false)

  const handleTrackingError = useCallback((message) => {
    setTrackingError(message)
  }, [])

  const registerNoteOnset = useCallback(() => {
    const result = rhythmDetectorRef.current.recordNoteOnset()

    if (result.status === 'stable') {
      setDetectedBpm(result.bpm)
      setIsTempoPulseActive(true)
      window.clearTimeout(rhythmTimeoutRef.current)
      rhythmTimeoutRef.current = window.setTimeout(() => setIsTempoPulseActive(false), 3500)
    }

    if (result.status === 'irregular') setIsTempoPulseActive(false)
  }, [])

  const handleHandResults = useCallback(({ landmarks, handedness }) => {
    if (areBothHandsClosedFists(landmarks)) {
      if (!fistStartedAtRef.current) fistStartedAtRef.current = performance.now()

      if (!fistSwitchTriggeredRef.current && performance.now() - fistStartedAtRef.current >= FIST_HOLD_DURATION_MS) {
        const nextInstrument = cycleInstrument()
        fistSwitchTriggeredRef.current = true
        setActiveInstrument(nextInstrument)
        setInstrumentPulseId((pulseId) => pulseId + 1)
      }

      activeFingerIdsRef.current = new Set()
      pinchWasActiveRef.current = false
      stopPlayedNotes()
      setActiveNotes((currentNotes) => (currentNotes.length ? [] : currentNotes))
      return
    }

    fistStartedAtRef.current = null
    fistSwitchTriggeredRef.current = false

    if (controlModeRef.current === 'pinch') {
      const rightHand = getRightHand(landmarks, handedness)
      const pinching = rightHand ? isPinching(rightHand) : false
      const note = rightHand ? mapRightHandToNote(rightHand) : undefined
      if (pinching && !pinchWasActiveRef.current) {
        particleCanvasRef.current?.spawnBurst({ note, position: rightHand[8] })
        registerNoteOnset()
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

    const triggeredItems = playModeRef.current === 'chords'
      ? getCurledFingerChords(landmarks, handedness)
      : getCurledFingerNotes(landmarks, handedness)
    const nextFingerIds = new Set(triggeredItems.map(({ id }) => id))
    let didTriggerNote = false
    triggeredItems.forEach((item) => {
      if (!activeFingerIdsRef.current.has(item.id)) {
        didTriggerNote = true
        if (item.notes) {
          item.notes.forEach((note) => particleCanvasRef.current?.spawnBurst({ note, position: item.position }))
        } else {
          particleCanvasRef.current?.spawnBurst(item)
        }
      }
    })
    if (didTriggerNote) registerNoteOnset()
    activeFingerIdsRef.current = nextFingerIds
    const nextActiveNotes = playModeRef.current === 'chords'
      ? updateChordNotes(triggeredItems)
      : updateFingerNotes(triggeredItems)
    setActiveNotes((currentNotes) => (
      currentNotes.join('|') === nextActiveNotes.join('|') ? currentNotes : nextActiveNotes
    ))
  }, [registerNoteOnset])

  useEffect(() => {
    controlModeRef.current = controlMode
    stopPlayedNotes()
    activeFingerIdsRef.current = new Set()
    pinchWasActiveRef.current = false
    setActiveNotes([])
  }, [controlMode])

  useEffect(() => {
    playModeRef.current = playMode
    activeFingerIdsRef.current = new Set()
    stopPlayedNotes()
    setActiveNotes([])
  }, [playMode])

  useEffect(() => {
    if (cameraState === 'active') {
      setShowOnboarding(sessionStorage.getItem('aeria-onboarding-complete') !== 'true')
    }
  }, [cameraState])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      disposeMusicEngine()
      window.clearTimeout(rhythmTimeoutRef.current)
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
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setCameraState('error')
      setErrorMessage(getCameraErrorMessage(error))
    }
  }

  function startPerformance() {
    sessionStorage.setItem('aeria-onboarding-complete', 'true')
    setShowOnboarding(false)
  }

  function retryHandTracking() {
    setTrackingError('')
    setTrackingRetryKey((key) => key + 1)
  }

  return (
    <main
      className={`ae-performance ${isTempoPulseActive ? 'ae-performance--tempo-active' : ''}`}
      style={{ '--ae-tempo-duration': `${60 / (detectedBpm ?? 120)}s` }}
    >
      <header className="ae-performance__intro ae-header">
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
        {controlMode === 'piano' && (
          <div className="ae-control-mode" role="group" aria-label="Piano play mode">
            <button
              className={`ae-control-mode__button ${playMode === 'notes' ? 'ae-control-mode__button--active' : ''}`}
              type="button"
              onClick={() => setPlayMode('notes')}
              aria-pressed={playMode === 'notes'}
            >
              Notes
            </button>
            <button
              className={`ae-control-mode__button ${playMode === 'chords' ? 'ae-control-mode__button--active' : ''}`}
              type="button"
              onClick={() => setPlayMode('chords')}
              aria-pressed={playMode === 'chords'}
            >
              Chords
            </button>
          </div>
        )}
      </header>

      <section className="ae-camera" aria-live="polite">
        <video
          ref={videoRef}
          className={`ae-camera__video ${isVideoHidden ? 'ae-camera__video--hidden' : ''}`}
          autoPlay
          muted
          playsInline
          aria-label="Live webcam feed"
        />
        {cameraState === 'active' && !showOnboarding && (
          <>
            <HandTracker
              videoRef={videoRef}
              onError={handleTrackingError}
              onResults={handleHandResults}
              reloadKey={trackingRetryKey}
            />
            <ParticleCanvas ref={particleCanvasRef} videoRef={videoRef} />
            <InstrumentBadge instrumentName={activeInstrument} pulseId={instrumentPulseId} />
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
        {cameraState === 'active' && !showOnboarding && (
          <button
            className="ae-video-toggle"
            type="button"
            onClick={() => setIsVideoHidden((isHidden) => !isHidden)}
            aria-pressed={isVideoHidden}
          >
            {isVideoHidden ? 'Show camera' : 'Hide camera'}
          </button>
        )}
        {trackingError && (
          <div className="ae-camera__notice ae-camera__notice--error" role="alert">
            <p>{trackingError}</p>
            <button className="ae-camera__retry" type="button" onClick={retryHandTracking}>Retry hand tracking</button>
          </div>
        )}
        {cameraState === 'active' && showOnboarding && <OnboardingOverlay onStart={startPerformance} />}
      </section>

      {cameraState === 'active' && !showOnboarding && (
        <p className="ae-status">
          <span aria-hidden="true">●</span>{' '}
          {controlMode === 'piano'
            ? playMode === 'chords'
              ? 'Chord shapes: thumb + middle + pinky for C major; index + ring for A minor.'
              : 'Curl a finger toward your palm to play; use both hands for chords.'
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
