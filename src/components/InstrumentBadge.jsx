function InstrumentBadge({ instrumentName, pulseId }) {
  return (
    <p key={pulseId} className="ae-instrument-badge">
      Instrument <strong>{instrumentName}</strong>
    </p>
  )
}

export default InstrumentBadge
