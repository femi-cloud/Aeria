function PerformanceDebugOverlay({ metrics }) {
  return (
    <aside className="ae-performance-debug" aria-label="Development performance diagnostics">
      <p className="ae-performance-debug__title">DEV · Performance</p>
      <dl>
        <div><dt>FPS</dt><dd>{format(metrics.fps, 1)}</dd></div>
        <div><dt>Input</dt><dd>{metrics.inputResolution}</dd></div>
        <div><dt>MediaPipe</dt><dd>{format(metrics.detectionMs)} ms</dd></div>
        <div><dt>Canvas paint</dt><dd>{format(metrics.canvasMs)} ms</dd></div>
        <div><dt>Skeleton</dt><dd>{format(metrics.skeletonMs)} ms</dd></div>
        <div><dt>Particles</dt><dd>{format(metrics.particleMs)} ms · {metrics.activeParticles}/150</dd></div>
        <div><dt>Gesture logic</dt><dd>{format(metrics.gestureMs)} ms</dd></div>
      </dl>
      <p className="ae-performance-debug__note">Instrument visuals and waveform are CSS/compositor animated.</p>
    </aside>
  )
}

function format(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export default PerformanceDebugOverlay
