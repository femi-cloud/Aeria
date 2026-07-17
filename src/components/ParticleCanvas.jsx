import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const MAX_PARTICLES = 120
const PARTICLES_PER_BURST = 8
const MIN_LIFESPAN_MS = 1000
const MAX_LIFESPAN_MS = 1500
const PITCH_CLASSES = ['C', 'D', 'E', 'G', 'A']
const LOW_PITCH_COLOR = [72, 59, 196]
const HIGH_PITCH_COLOR = [255, 199, 73]

const ParticleCanvas = forwardRef(function ParticleCanvas({ videoRef }, ref) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])

  useImperativeHandle(ref, () => ({
    spawnBurst({ handColor, note, position }) {
      if (!position) return

      const color = getPitchColor(note)
      const newParticles = Array.from({ length: PARTICLES_PER_BURST }, () => createParticle(position, color, handColor))
      particlesRef.current = [...particlesRef.current, ...newParticles].slice(-MAX_PARTICLES)
    },
  }), [])

  useEffect(() => {
    let animationFrameId
    let previousTime = performance.now()

    function render(now) {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video?.videoWidth && video?.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const deltaSeconds = Math.min((now - previousTime) / 1000, 0.05)
        previousTime = now
        drawParticles(canvas, particlesRef, deltaSeconds, now)
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [videoRef])

  return <canvas ref={canvasRef} className="ae-particle-canvas" aria-hidden="true" />
})

function createParticle(position, color, handColor) {
  const lifespan = MIN_LIFESPAN_MS + Math.random() * (MAX_LIFESPAN_MS - MIN_LIFESPAN_MS)
  const angle = Math.random() * Math.PI * 2
  const speed = 0.025 + Math.random() * 0.06

  return {
    color,
    handColor,
    createdAt: performance.now(),
    lifespan,
    size: 3 + Math.random() * 4,
    x: position.x,
    y: position.y,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed - 0.08,
  }
}

function drawParticles(canvas, particlesRef, deltaSeconds, now) {
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)

  particlesRef.current = particlesRef.current.filter((particle) => now - particle.createdAt < particle.lifespan)

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
  const pitchClass = note.replace(/[0-9]/g, '')
  const index = Math.max(PITCH_CLASSES.indexOf(pitchClass), 0)
  const progress = index / (PITCH_CLASSES.length - 1)

  return LOW_PITCH_COLOR.map((channel, colorIndex) => (
    Math.round(channel + (HIGH_PITCH_COLOR[colorIndex] - channel) * progress)
  ))
}

export default ParticleCanvas
