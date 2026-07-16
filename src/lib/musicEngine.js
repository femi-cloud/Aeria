import * as Tone from 'tone'

let pianoSynth
const activeFingerNotes = new Map()
let activePinchNote

export async function startMusicEngine() {
  await Tone.start()

  if (!pianoSynth) {
    pianoSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.01,
        decay: 0.35,
        release: 0.7,
        sustain: 0.25,
      },
    }).toDestination()
    pianoSynth.volume.value = -10
  }
}

export function updateFingerNotes(nextFingerNotes) {
  if (!pianoSynth) return []

  const nextNotesByFinger = new Map(nextFingerNotes.map(({ id, note }) => [id, note]))

  activeFingerNotes.forEach((note, fingerId) => {
    if (!nextNotesByFinger.has(fingerId)) {
      pianoSynth.triggerRelease(note)
      activeFingerNotes.delete(fingerId)
    }
  })

  nextNotesByFinger.forEach((note, fingerId) => {
    const activeNote = activeFingerNotes.get(fingerId)
    if (!activeNote) {
      pianoSynth.triggerAttack(note)
      activeFingerNotes.set(fingerId, note)
    }
  })

  return [...activeFingerNotes.values()]
}

export function updatePinchNote({ note, pinching }) {
  if (!pianoSynth) return []

  if (pinching && note && !activePinchNote) {
    activePinchNote = note
    pianoSynth.triggerAttack(note)
  }

  if (!pinching && activePinchNote) {
    pianoSynth.triggerRelease(activePinchNote)
    activePinchNote = undefined
  }

  return activePinchNote ? [activePinchNote] : []
}

export function stopPlayedNotes() {
  if (!pianoSynth) return

  activeFingerNotes.forEach((note) => pianoSynth.triggerRelease(note))
  activeFingerNotes.clear()

  if (activePinchNote) {
    pianoSynth.triggerRelease(activePinchNote)
    activePinchNote = undefined
  }
}

export function disposeMusicEngine() {
  stopPlayedNotes()
  pianoSynth?.dispose()
  pianoSynth = undefined
}
