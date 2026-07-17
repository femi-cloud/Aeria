import { useCallback, useEffect, useRef, useState } from 'react'
import HandTracker from '../components/HandTracker.jsx'
import InstrumentBadge from '../components/InstrumentBadge.jsx'
import OnboardingOverlay from '../components/OnboardingOverlay.jsx'
import ParticleCanvas from '../components/ParticleCanvas.jsx'
import RecordingControls from '../components/RecordingControls.jsx'
import WaveformBar from '../components/WaveformBar.jsx'
import { areBothHandsClosedFists, getCurledFingerChords, getCurledFingerNotes, getOpenPalms, getPeaceSigns, getRightHand, isPinching, mapRightHandToNote } from '../lib/gestureMapping.js'
import { activateSustain, cycleInstrument, disposeMusicEngine, playPentatonicArpeggio, startAudioRecording, startMusicEngine, stopAudioRecording, stopPlayedNotes, updateChordNotes, updateFingerNotes, updatePinchNote } from '../lib/musicEngine.js'
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
const MAX_RECORDING_DURATION_MS = 60000
const OPEN_PALM_HOLD_DURATION_MS = 500
const PEACE_SIGN_HOLD_DURATION_MS = 350

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
  const recordingTimeoutRef = useRef(null)
  const savedConfirmationTimeoutRef = useRef(null)
  const sustainTimeoutRef = useRef(null)
  const openPalmStartedAtRef = useRef(new Map())
  const openPalmTriggeredRef = useRef(new Set())
  const peaceSignStartedAtRef = useRef(new Map())
  const peaceSignTriggeredRef = useRef(new Set())
  const [cameraState, setCameraState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [audioError, setAudioError] = useState('')
  const [activeNotes, setActiveNotes] = useState([])
  const [activeNoteDetails, setActiveNoteDetails] = useState([])
  const [controlMode, setControlMode] = useState('piano')
  const [playMode, setPlayMode] = useState('notes')
  const [activeInstrument, setActiveInstrument] = useState('Piano')
  const [instrumentPulseId, setInstrumentPulseId] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isVideoHidden, setIsVideoHidden] = useState(false)
  const [trackingRetryKey, setTrackingRetryKey] = useState(0)
  const [detectedBpm, setDetectedBpm] = useState(null)
  const [isTempoPulseActive, setIsTempoPulseActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [recordingSaved, setRecordingSaved] = useState(false)
  const [isSustainActive, setIsSustainActive] = useState(false)

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

  const triggerSustain = useCallback(() => {
    activateSustain()
    setIsSustainActive(true)
    window.clearTimeout(sustainTimeoutRef.current)
    sustainTimeoutRef.current = window.setTimeout(() => setIsSustainActive(false), 3200)
  }, [])

  const handleHandResults = useCallback(({ landmarks, handedness, identities }) => {
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
      setActiveNoteDetails((currentNotes) => (currentNotes.length ? [] : currentNotes))
      return
    }

    fistStartedAtRef.current = null
    fistSwitchTriggeredRef.current = false

    processHeldGesture(getOpenPalms(landmarks, identities), openPalmStartedAtRef, openPalmTriggeredRef, OPEN_PALM_HOLD_DURATION_MS, triggerSustain)
    const peaceSigns = getPeaceSigns(landmarks, identities)
    processHeldGesture(peaceSigns, peaceSignStartedAtRef, peaceSignTriggeredRef, PEACE_SIGN_HOLD_DURATION_MS, (peaceSign) => {
      playPentatonicArpeggio()
      ;['C4', 'D4', 'E4', 'G4', 'A4'].forEach((note) => (
        particleCanvasRef.current?.spawnBurst({ note, position: peaceSign.position })
      ))
      registerNoteOnset()
    })

    if (peaceSigns.length) {
      activeFingerIdsRef.current = new Set()
      pinchWasActiveRef.current = false
      stopPlayedNotes()
      setActiveNotes((currentNotes) => (currentNotes.length ? [] : currentNotes))
      setActiveNoteDetails((currentNotes) => (currentNotes.length ? [] : currentNotes))
      return
    }

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
      const handIndex = landmarks.indexOf(rightHand)
      const handColor = identities[handIndex]?.color
      setActiveNoteDetails((currentNotes) => (
        currentNotes.length === nextActiveNotes.length && currentNotes[0]?.note === nextActiveNotes[0] && currentNotes[0]?.color === handColor
          ? currentNotes
          : nextActiveNotes.map((activeNote) => ({ color: handColor, id: `pinch-${activeNote}`, note: activeNote }))
      ))
      return
    }

    const triggeredItems = playModeRef.current === 'chords'
      ? getCurledFingerChords(landmarks, handedness, identities)
      : getCurledFingerNotes(landmarks, handedness, identities)
    const nextFingerIds = new Set(triggeredItems.map(({ id }) => id))
    let didTriggerNote = false
    triggeredItems.forEach((item) => {
      if (!activeFingerIdsRef.current.has(item.id)) {
        didTriggerNote = true
        if (item.notes) {
          item.notes.forEach((note) => particleCanvasRef.current?.spawnBurst({ handColor: item.handColor, note, position: item.position }))
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
    const nextNoteDetails = triggeredItems.flatMap((item) => (item.notes ?? [item.note]).map((note) => ({
      color: item.handColor,
      id: `${item.id}-${note}`,
      note,
    })))
    setActiveNoteDetails((currentNotes) => (
      currentNotes.map(({ id }) => id).join('|') === nextNoteDetails.map(({ id }) => id).join('|')
        ? currentNotes
        : nextNoteDetails
    ))
  }, [registerNoteOnset, triggerSustain])

  useEffect(() => {
    controlModeRef.current = controlMode
    stopPlayedNotes()
    activeFingerIdsRef.current = new Set()
    pinchWasActiveRef.current = false
    setActiveNotes([])
    setActiveNoteDetails([])
  }, [controlMode])

  useEffect(() => {
    playModeRef.current = playMode
    activeFingerIdsRef.current = new Set()
    stopPlayedNotes()
    setActiveNotes([])
    setActiveNoteDetails([])
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
      window.clearTimeout(recordingTimeoutRef.current)
      window.clearTimeout(savedConfirmationTimeoutRef.current)
      window.clearTimeout(sustainTimeoutRef.current)
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

  async function toggleRecording() {
    if (isRecording) {
      await finishRecording()
      return
    }

    try {
      await startAudioRecording()
      setRecordingBlob(null)
      setRecordingSaved(false)
      setIsRecording(true)
      recordingTimeoutRef.current = window.setTimeout(() => finishRecording(), MAX_RECORDING_DURATION_MS)
    } catch (error) {
      setAudioError('Recording is not supported in this browser. Try Chrome or Firefox.')
      console.error('Aeria: failed to start audio recording.', error)
    }
  }

  async function finishRecording() {
    window.clearTimeout(recordingTimeoutRef.current)

    try {
      const recording = await stopAudioRecording()
      if (recording) setRecordingBlob(recording)
    } catch (error) {
      setAudioError('We could not finish the recording. Please try again.')
      console.error('Aeria: failed to stop audio recording.', error)
    } finally {
      setIsRecording(false)
    }
  }

  function downloadRecording() {
    if (!recordingBlob) return

    const recordingUrl = URL.createObjectURL(recordingBlob)
    const anchor = document.createElement('a')
    anchor.download = `aeria-recording-${Date.now()}.webm`
    anchor.href = recordingUrl
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(recordingUrl), 0)
    setRecordingSaved(true)
    window.clearTimeout(savedConfirmationTimeoutRef.current)
    savedConfirmationTimeoutRef.current = window.setTimeout(() => setRecordingSaved(false), 2400)
  }

  return (
    <main
      className={`ae-performance ${isTempoPulseActive ? 'ae-performance--tempo-active' : ''}`}
      style={{ '--ae-tempo-duration': `${60 / (detectedBpm ?? 120)}s` }}
    >
      <header className="ae-performance__intro ae-header">
        <p className="ae-performance__eyebrow">Gesture-controlled music</p>
        <h1>Aeria</h1>
        <p className="ae-performance__description">Shape sound with your hands.</p>
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
        <WaveformBar bpm={detectedBpm} isActive={activeNotes.length > 0 || isTempoPulseActive} />
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
            {isSustainActive && <p className="ae-sustain-indicator">Sustain active</p>}
            <p className="ae-active-notes">
              Active notes <strong>{activeNoteDetails.length
                ? activeNoteDetails.map(({ color, id, note }) => (
                  <span key={id} className="ae-active-notes__note" style={{ color }}>{note}</span>
                ))
                : activeNotes.length ? activeNotes.join(' · ') : '—'}</strong>
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

      <section className="ae-console" aria-label="Performance controls">
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
        <RecordingControls
          hasRecording={Boolean(recordingBlob)}
          isRecording={isRecording}
          onDownload={downloadRecording}
          onToggleRecording={toggleRecording}
          recordingSaved={recordingSaved}
        />
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

function processHeldGesture(gestures, startedAtRef, triggeredRef, holdDuration, onTrigger) {
  const activeGestureIds = new Set(gestures.map(({ id }) => id))
  const now = performance.now()

  gestures.forEach((gesture) => {
    if (!startedAtRef.current.has(gesture.id)) startedAtRef.current.set(gesture.id, now)
    if (!triggeredRef.current.has(gesture.id) && now - startedAtRef.current.get(gesture.id) >= holdDuration) {
      triggeredRef.current.add(gesture.id)
      onTrigger(gesture)
    }
  })

  startedAtRef.current.forEach((_, id) => {
    if (!activeGestureIds.has(id)) {
      startedAtRef.current.delete(id)
      triggeredRef.current.delete(id)
    }
  })
}

export default PerformanceView
