function OnboardingOverlay({ onStart }) {
  return (
    <section className="ae-onboarding" aria-labelledby="ae-onboarding-title">
      <p className="ae-onboarding__eyebrow">Welcome to Aeria</p>
      <h2 id="ae-onboarding-title">Play with your hands</h2>
      <div className="ae-onboarding__gestures">
        <p><span aria-hidden="true">☝</span><strong>Curl a finger</strong> to play a note or chord.</p>
        <p><span aria-hidden="true">✊</span><strong>Make two fists</strong> and hold to switch instruments.</p>
        <p><span aria-hidden="true">↕</span><strong>Move your left hand</strong> to shape volume and reverb.</p>
      </div>
      <button className="ae-button" type="button" onClick={onStart}>Start playing</button>
    </section>
  )
}

export default OnboardingOverlay
