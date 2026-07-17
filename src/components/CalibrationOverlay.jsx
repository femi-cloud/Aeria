function CalibrationOverlay({ progress }) {
  const percent = Math.round(progress * 100)

  return (
    <section className="ae-calibration" aria-live="polite">
      <p className="ae-calibration__eyebrow">Quick calibration</p>
      <h2>Hold your hand naturally open</h2>
      <p>Keep your fingers relaxed and visible for two seconds. Aeria will tune curl sensitivity to your hand.</p>
      <div className="ae-calibration__meter" aria-label={`${percent}% complete`}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <small>{progress ? `${percent}%` : 'Waiting for a hand…'}</small>
    </section>
  )
}

export default CalibrationOverlay
