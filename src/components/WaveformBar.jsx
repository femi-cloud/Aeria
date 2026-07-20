import { memo } from 'react'

const BARS = Array.from({ length: 42 })

function WaveformBar({ bpm, isActive }) {
  return (
    <div
      className={`ae-waveform ${isActive ? 'ae-waveform--active' : ''}`}
      style={{ '--ae-wave-duration': `${60 / (bpm ?? 120)}s` }}
      aria-hidden="true"
    >
      {BARS.map((_, index) => <span key={index} style={{ '--ae-wave-delay': `${index * -0.037}s` }} />)}
    </div>
  )
}

export default memo(WaveformBar)
