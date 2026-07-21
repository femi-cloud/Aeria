import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const MAX_PARTICLES = 150
const PARTICLES_PER_BURST = 16
const MIN_LIFESPAN_MS = 1000
const MAX_LIFESPAN_MS = 1500
const LOW_PITCH_COLOR = [72, 59, 196]
const HIGH_PITCH_COLOR = [255, 199, 73]
const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const ParticleCanvas = forwardRef(function ParticleCanvas({ onMetrics, videoRef }, ref) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const flashesRef = useRef([])
  const requestRenderRef = useRef(() => {})

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    spawnBurst({ chordSize = 1, handColor, includeFlash = true, note, position }) {
      if (!position) return

      const color = getPitchColor(note)
      const burstStrength = 1 + Math.min(Math.max(chordSize - 1, 0) * 0.24, 0.72)
      const particleCount = Math.round(PARTICLES_PER_BURST * burstStrength)
      const newParticles = Array.from({ length: particleCount }, () => createParticle(position, color, handColor, burstStrength))
      particlesRef.current = [...particlesRef.current, ...newParticles].slice(-MAX_PARTICLES)
      if (includeFlash) {
        flashesRef.current = [...flashesRef.current, createFlash(position, color, burstStrength)].slice(-10)
      }
      requestRenderRef.current()
    },
  }), [])

  useEffect(() => {
    let animationFrameId
    let previousTime = performance.now()

    function requestRender() {
      if (animationFrameId === undefined) animationFrameId = requestAnimationFrame(render)
    }

    function render(now) {
      animationFrameId = undefined
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video?.videoWidth && video?.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const deltaSeconds = Math.min((now - previousTime) / 1000, 0.05)
        previousTime = now
        const drawStartedAt = performance.now()
        drawParticles(canvas, particlesRef, flashesRef, deltaSeconds, now)
        onMetrics?.({
          activeParticles: particlesRef.current.length,
          particleMs: performance.now() - drawStartedAt,
        })
      }

      if (particlesRef.current.length || flashesRef.current.length) requestRender()
    }

    requestRenderRef.current = requestRender
    return () => {
      requestRenderRef.current = () => {}
      if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId)
    }
  }, [onMetrics, videoRef])

  return <canvas ref={canvasRef} className="ae-particle-canvas" aria-hidden="true" />
})

function createParticle(position, color, handColor, burstStrength) {
  const lifespan = MIN_LIFESPAN_MS + Math.random() * (MAX_LIFESPAN_MS - MIN_LIFESPAN_MS)
  const angle = Math.random() * Math.PI * 2
  const speed = 0.025 + Math.random() * 0.06

  return {
    color,
    handColor,
    createdAt: performance.now(),
    lifespan,
    size: 2.25 + Math.random() * 6.5 + (burstStrength - 1) * 2.5,
    x: position.x,
    y: position.y,
    velocityX: Math.cos(angle) * speed * burstStrength,
    velocityY: Math.sin(angle) * speed * burstStrength - 0.08,
  }
}

function createFlash(position, color, strength) {
  return {
    color,
    createdAt: performance.now(),
    lifespan: 280 + (strength - 1) * 140,
    position,
    radius: 18 + strength * 18,
  }
}

function drawParticles(canvas, particlesRef, flashesRef, deltaSeconds, now) {
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)

  particlesRef.current = particlesRef.current.filter((particle) => now - particle.createdAt < particle.lifespan)
  flashesRef.current = flashesRef.current.filter((flash) => now - flash.createdAt < flash.lifespan)

  flashesRef.current.forEach((flash) => {
    const progress = (now - flash.createdAt) / flash.lifespan
    const alpha = (1 - progress) ** 2
    const radius = flash.radius * (0.7 + progress * 1.9)
    const x = flash.position.x * canvas.width
    const y = flash.position.y * canvas.height
    const glow = context.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(${flash.color.join(', ')}, ${alpha * .8})`)
    glow.addColorStop(.35, `rgba(${flash.color.join(', ')}, ${alpha * .28})`)
    glow.addColorStop(1, `rgba(${flash.color.join(', ')}, 0)`)
    context.fillStyle = glow
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  })

  particlesRef.current.forEach((particle) => {
    // Positions are normalized to the video, so the trail stays aligned if the canvas resizes.
    particle.x += particle.velocityX * deltaSeconds
    particle.y += particle.velocityY * deltaSeconds
    particle.velocityY -= 0.02 * deltaSeconds

    const life = 1 - (now - particle.createdAt) / particle.lifespan
    context.fillStyle = `rgba(${particle.color.join(', ')}, ${life * 0.85})`
    context.strokeStyle = particle.handColor ?? context.fillStyle
    context.lineWidth = 1.25
    context.beginPath()
    context.arc(particle.x * canvas.width, particle.y * canvas.height, particle.size * life, 0, Math.PI * 2)
    context.fill()
    if (particle.handColor) context.stroke()
  })
}

function getPitchColor(note) {
  const [, pitchClass = 'C', octave = '4'] = note.match(/^([A-G])(?:#|b)?(\d+)$/) ?? []
  const midi = (Number(octave) + 1) * 12 + (NOTE_SEMITONES[pitchClass] ?? 0)
  const progress = Math.min(Math.max((midi - 60) / 12, 0), 1)

  return LOW_PITCH_COLOR.map((channel, colorIndex) => (
    Math.round(channel + (HIGH_PITCH_COLOR[colorIndex] - channel) * progress)
  ))
}

export default ParticleCanvas
