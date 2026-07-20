function InstrumentBadge({ instrumentName, label = 'Instrument', pulseId }) {
  return (
    <p key={pulseId} className="ae-instrument-badge">
      {label} <strong>{instrumentName}</strong>
    </p>
  )
}

export default InstrumentBadge
