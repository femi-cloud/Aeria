function FingerCurlDebugPanel({ hands }) {
  if (!hands.length) return null

  return (
    <aside className="ae-debug-panel" aria-label="Development finger curl diagnostics">
      <p className="ae-debug-panel__title">DEV · Finger curl diagnostics</p>
      <p className="ae-debug-panel__legend">distance / on / off · N/A = no key assigned</p>
      {hands.map((hand) => (
        <section key={hand.id} className="ae-debug-panel__hand" style={{ '--ae-debug-color': hand.color ?? '#7C6FFF' }}>
          <strong>{hand.id} hand</strong>
          {hand.fingers.map((finger) => (
            <div key={finger.name} className="ae-debug-panel__row">
              <span>{finger.name}{finger.note ? ` · ${finger.note}` : ''}</span>
              <code>{formatValue(finger.distance)} / {formatValue(finger.noteOnThreshold)} / {formatValue(finger.noteOffThreshold)}</code>
              <b className={finger.triggered ? 'ae-debug-panel__state ae-debug-panel__state--on' : 'ae-debug-panel__state'}>
                {finger.note ? (finger.triggered ? 'ON' : 'off') : 'N/A'}
              </b>
            </div>
          ))}
        </section>
      ))}
    </aside>
  )
}

function formatValue(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—'
}

export default FingerCurlDebugPanel
