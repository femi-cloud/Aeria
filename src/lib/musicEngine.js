import * as Tone from 'tone'

const INSTRUMENTS = ['Piano', 'Pad', 'Bells', 'Violin']
const PENTATONIC_ARPEGGIO = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5']

let activeInstrument
let activeInstrumentIndex = 0
let recorder
let sustainTimeout
const activeFingerNotes = new Map()
const activeChordNotes = new Map()
let activePinchNote

export async function startMusicEngine() {
  await Tone.start()
  ensureActiveInstrument()
}

export function cycleInstrument() {
  stopPlayedNotes()
  disposeActiveInstrument()
  activeInstrumentIndex = (activeInstrumentIndex + 1) % INSTRUMENTS.length
  ensureActiveInstrument()

  return INSTRUMENTS[activeInstrumentIndex]
}

export async function startAudioRecording() {
  await Tone.start()

  if (!Tone.Recorder.supported) {
    throw new Error('This browser does not support audio recording.')
  }

  if (!recorder) {
    recorder = new Tone.Recorder()
    Tone.Destination.connect(recorder)
  }

  await recorder.start()
}

export async function stopAudioRecording() {
  if (!recorder || recorder.state !== 'started') return null
  return recorder.stop()
}

export function updateFingerNotes(nextFingerNotes) {
  const synth = activeInstrument?.synth
  if (!synth) return []

  const nextNotesByFinger = new Map(nextFingerNotes.map(({ id, note }) => [id, note]))

  activeFingerNotes.forEach((note, fingerId) => {
    if (!nextNotesByFinger.has(fingerId)) {
      synth.triggerRelease(note)
      activeFingerNotes.delete(fingerId)
    }
  })

  nextNotesByFinger.forEach((note, fingerId) => {
    if (!activeFingerNotes.has(fingerId)) {
      synth.triggerAttack(note)
      activeFingerNotes.set(fingerId, note)
    }
  })

  return [...activeFingerNotes.values()]
}

export function updatePinchNote({ note, pinching }) {
  const synth = activeInstrument?.synth
  if (!synth) return []

  if (pinching && note && !activePinchNote) {
    activePinchNote = note
    synth.triggerAttack(note)
  }

  if (!pinching && activePinchNote) {
    synth.triggerRelease(activePinchNote)
    activePinchNote = undefined
  }

  return activePinchNote ? [activePinchNote] : []
}

export function updateChordNotes(nextChords) {
  const synth = activeInstrument?.synth
  if (!synth) return []

  const nextChordsById = new Map(nextChords.map(({ id, notes }) => [id, notes]))

  activeChordNotes.forEach((notes, chordId) => {
    if (!nextChordsById.has(chordId)) {
      notes.forEach((note) => synth.triggerRelease(note))
      activeChordNotes.delete(chordId)
    }
  })

  nextChordsById.forEach((notes, chordId) => {
    if (!activeChordNotes.has(chordId)) {
      notes.forEach((note) => synth.triggerAttack(note))
      activeChordNotes.set(chordId, notes)
    }
  })

  return [...activeChordNotes.values()].flat()
}

export function activateSustain(durationMs = 3200) {
  const instrument = activeInstrument
  if (!instrument) return

  instrument.synth.set({ envelope: { release: Math.max(instrument.release * 3, 2.8) } })
  clearTimeout(sustainTimeout)
  sustainTimeout = setTimeout(() => {
    if (activeInstrument === instrument) {
      instrument.synth.set({ envelope: { release: instrument.release } })
    }
  }, durationMs)
}

export function playPentatonicArpeggio() {
  const synth = activeInstrument?.synth
  if (!synth) return

  const startTime = Tone.now()
  PENTATONIC_ARPEGGIO.forEach((note, index) => {
    synth.triggerAttackRelease(note, 0.16, startTime + index * 0.1)
  })
}

export function stopPlayedNotes() {
  const synth = activeInstrument?.synth
  if (!synth) return

  activeFingerNotes.forEach((note) => synth.triggerRelease(note))
  activeFingerNotes.clear()

  activeChordNotes.forEach((notes) => notes.forEach((note) => synth.triggerRelease(note)))
  activeChordNotes.clear()

  if (activePinchNote) {
    synth.triggerRelease(activePinchNote)
    activePinchNote = undefined
  }
}

export function disposeMusicEngine() {
  stopPlayedNotes()
  clearTimeout(sustainTimeout)
  disposeActiveInstrument()
  if (recorder) {
    Tone.Destination.disconnect(recorder)
    recorder.dispose()
  }
  recorder = undefined
}

function ensureActiveInstrument() {
  if (activeInstrument) return

  const instrumentName = INSTRUMENTS[activeInstrumentIndex]
  activeInstrument = createInstrument(instrumentName)
}

function createInstrument(instrumentName) {
  if (instrumentName === 'Pad') return createPad()
  if (instrumentName === 'Bells') return createBells()
  if (instrumentName === 'Violin') return createViolin()
  return createPiano()
}

function createPiano() {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.01, decay: 0.35, release: 0.7, sustain: 0.25 },
  }).toDestination()
  synth.volume.value = -10

  return { synth, effects: [], release: 0.7 }
}

function createPad() {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine4' },
    envelope: { attack: 0.45, decay: 0.5, release: 3.2, sustain: 0.7 },
  })
  const chorus = new Tone.Chorus(2.5, 1.8, 0.25).start()
  const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 })
  synth.chain(chorus, reverb, Tone.Destination)
  synth.volume.value = -13

  return { synth, effects: [chorus, reverb], release: 3.2 }
}

function createBells() {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.5,
    modulationIndex: 12,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.9, release: 0.7, sustain: 0 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.001, decay: 0.5, release: 0.4, sustain: 0 },
  }).toDestination()
  synth.volume.value = -12

  return { synth, effects: [], release: 0.7 }
}

function createViolin() {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.08, decay: 0.2, release: 0.9, sustain: 0.72 },
  }).toDestination()
  synth.volume.value = -14

  return { synth, effects: [], release: 0.9 }
}

function disposeActiveInstrument() {
  if (!activeInstrument) return

  activeInstrument.synth.dispose()
  activeInstrument.effects.forEach((effect) => effect.dispose())
  activeInstrument = undefined
}
