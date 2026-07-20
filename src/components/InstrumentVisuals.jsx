import { memo } from 'react'

const LEFT_HAND_SCALE = ['C4', 'D4', 'E4', 'F4', 'G4']
const RIGHT_HAND_SCALE = ['A4', 'B4', 'C5']
const RIGHT_HAND_COLOR = '#a791ff'
const LEFT_HAND_COLOR = '#5be6b3'
const FIELD_WAVES = Array.from({ length: 7 }, (_, index) => index)
const FIELD_PARTICLES = Array.from({ length: 18 }, (_, index) => index)

function InstrumentVisuals({ activeInstrument, activeNotes, handOctaves, mode, thereminState, triggerEvents }) {
  if (mode === 'theremin') return <ThereminField state={thereminState} />
  if (activeInstrument === 'Pad') return <PadRipples events={triggerEvents} />

  const keyboardNotes = getKeyboardNotes(handOctaves)
  if (activeInstrument === 'Bells') return <BellRow notes={keyboardNotes} activeNotes={activeNotes} />
  return <PianoKeys notes={keyboardNotes} activeNotes={activeNotes} />
}

function PianoKeys({ notes, activeNotes }) {
  return (
    <div className="ae-instrument-visual ae-piano-keys" aria-hidden="true">
      {notes.map(({ color, id, note }) => (
        <span key={id} className={activeNotes.includes(note) ? 'ae-piano-key ae-piano-key--active' : 'ae-piano-key'} style={{ '--ae-key-color': color }}>
          <small>{note}</small>
        </span>
      ))}
    </div>
  )
}

function BellRow({ notes, activeNotes }) {
  return (
    <div className="ae-instrument-visual ae-bell-row" aria-hidden="true">
      {notes.map(({ color, id, note }) => (
        <span key={id} className={activeNotes.includes(note) ? 'ae-bell ae-bell--active' : 'ae-bell'} style={{ '--ae-key-color': color }}>
          <i><span className="ae-bell__rim" /></i>
          <small>{note}</small>
        </span>
      ))}
    </div>
  )
}

function PadRipples({ events }) {
  return (
    <div className="ae-pad-ripples" aria-hidden="true">
      {events.slice(-10).map(({ color, id, position }) => (
        <span
          key={id}
          className="ae-pad-ripple"
          style={{ '--ae-ripple-color': color ?? '#7C6FFF', left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
        />
      ))}
    </div>
  )
}

function ThereminField({ state }) {
  const intensity = state?.intensity ?? 0.18
  const pitch = state?.pitch ?? 0.5
  const flowSpeed = state?.flowSpeed ?? 0.75
  const hue = 225 - pitch * 182
  const particleCount = 6 + Math.round((state?.volume ?? 0.1) * 12)

  return (
    <div
      className="ae-theremin-field"
      style={{
        '--ae-field-flow-duration': `${(2.2 / flowSpeed).toFixed(2)}s`,
        '--ae-field-hue': hue,
        '--ae-field-intensity': intensity,
        '--ae-field-pitch': pitch,
        '--ae-field-particle-duration': `${(3.5 / flowSpeed).toFixed(2)}s`,
      }}
      aria-hidden="true"
    >
      <span className="ae-theremin-antenna ae-theremin-antenna--left" />
      <span className="ae-theremin-antenna ae-theremin-antenna--right" />
      <span className="ae-theremin-field__glow" />
      <span className="ae-theremin-field__core" />
      <span className="ae-theremin-field__waves">
        {FIELD_WAVES.map((index) => (
          <i key={index} style={{ '--ae-wave-delay': `${-index * .23}s`, '--ae-wave-height': `${8 + index * 5}%`, '--ae-wave-top': `${34 + index * 4}%` }} />
        ))}
      </span>
      <span className="ae-theremin-field__particles">
        {FIELD_PARTICLES.slice(0, particleCount).map((index) => (
          <i key={index} style={{ '--ae-particle-delay': `${-index * .22}s`, '--ae-particle-size': `${2 + index % 3}px`, '--ae-particle-top': `${22 + (index * 19) % 58}%` }} />
        ))}
      </span>
    </div>
  )
}

function getKeyboardNotes(handOctaves) {
  const rightHand = handOctaves.find(({ id, side }) => id === 'right' || side?.toLowerCase() === 'right')
  const leftHand = handOctaves.find(({ id, side }) => id === 'left' || side?.toLowerCase() === 'left')

  return [
    ...createScaleKeys(LEFT_HAND_SCALE, leftHand, 'left', LEFT_HAND_COLOR),
    ...createScaleKeys(RIGHT_HAND_SCALE, rightHand, 'right', RIGHT_HAND_COLOR),
  ]
}

function createScaleKeys(notes, hand, side, fallbackColor) {
  const shift = hand?.shift ?? 0
  const color = hand?.color ?? fallbackColor

  return notes.map((note) => ({
    color,
    id: `${side}-${note}`,
    note: shiftNoteByOctave(note, shift),
  }))
}

function shiftNoteByOctave(note, shift) {
  return note.replace(/(\d+)$/, (octave) => String(Number(octave) + shift))
}

export default memo(InstrumentVisuals)
