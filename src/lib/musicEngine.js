import * as Tone from 'tone'

const INSTRUMENTS = ['Piano', 'Pad', 'Bells', 'Violin']

let activeInstrument
let activeInstrumentIndex = 0
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
  disposeActiveInstrument()
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

  return { synth, effects: [] }
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

  return { synth, effects: [chorus, reverb] }
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

  return { synth, effects: [] }
}

function createViolin() {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.08, decay: 0.2, release: 0.9, sustain: 0.72 },
  }).toDestination()
  synth.volume.value = -14

  return { synth, effects: [] }
}

function disposeActiveInstrument() {
  if (!activeInstrument) return

  activeInstrument.synth.dispose()
  activeInstrument.effects.forEach((effect) => effect.dispose())
  activeInstrument = undefined
}
