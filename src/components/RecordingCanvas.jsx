import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const LEFT_HAND_SCALE = ['C4', 'D4', 'E4', 'F4', 'G4']
const RIGHT_HAND_SCALE = ['A4', 'B4', 'C5']

const RecordingCanvas = forwardRef(function RecordingCanvas({ activeInstrument, activeNotes, handOctaves, isVideoHidden, mode, particleCanvasRef, thereminState, triggerEvents, videoRef, handCanvasRef }, ref) {
  const canvasRef = useRef(null)
  const visualStateRef = useRef({})

  useEffect(() => {
    visualStateRef.current = { activeInstrument, activeNotes, handOctaves, isVideoHidden, mode, thereminState, triggerEvents }
  }, [activeInstrument, activeNotes, handOctaves, isVideoHidden, mode, thereminState, triggerEvents])

  useImperativeHandle(ref, () => ({
    captureStream(frameRate = 30) {
      const canvas = canvasRef.current
      if (!canvas?.width || !canvas?.height || !canvas.captureStream) {
        throw new Error('The performance video stream is not ready yet.')
      }

      return canvas.captureStream(frameRate)
    },
  }), [])

  useEffect(() => {
    let animationFrameId

    function render(now) {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video?.videoWidth && video?.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const context = canvas.getContext('2d')
        drawPerformanceFrame(
          context,
          canvas.width,
          canvas.height,
          video,
          handCanvasRef.current?.getCanvas?.(),
          particleCanvasRef.current?.getCanvas?.(),
          visualStateRef.current,
          now,
        )
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [handCanvasRef, particleCanvasRef, videoRef])

  return <canvas ref={canvasRef} className="ae-recording-canvas" aria-hidden="true" />
})

function drawPerformanceFrame(context, width, height, video, handCanvas, particleCanvas, state, now) {
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#0B0B14'
  context.fillRect(0, 0, width, height)

  context.save()
  context.translate(width, 0)
  context.scale(-1, 1)
  if (!state.isVideoHidden) context.drawImage(video, 0, 0, width, height)
  drawCanvasLayer(context, handCanvas, width, height)
  drawCanvasLayer(context, particleCanvas, width, height)
  context.restore()

  drawInstrumentVisual(context, width, height, state)
  drawWaveform(context, width, height, Boolean(state.activeNotes?.length), now)
}

function drawCanvasLayer(context, source, width, height) {
  if (source?.width && source?.height) context.drawImage(source, 0, 0, width, height)
}

function drawInstrumentVisual(context, width, height, state) {
  if (state.mode === 'theremin') {
    drawTheremin(context, width, height, state.thereminState)
    return
  }

  if (state.activeInstrument === 'Pad') {
    drawPadRipples(context, width, height, state.triggerEvents)
    return
  }

  const keys = getScaleKeys(state.handOctaves)
  if (state.activeInstrument === 'Bells') drawBells(context, width, height, keys, state.activeNotes)
  else drawPianoKeys(context, width, height, keys, state.activeNotes)
}

function drawPianoKeys(context, width, height, keys, activeNotes = []) {
  const barHeight = Math.max(58, height * 0.12)
  const gap = Math.max(3, width * 0.004)
  const keyWidth = Math.min(58, (width * 0.76 - gap * (keys.length - 1)) / keys.length)
  const startX = (width - (keyWidth * keys.length + gap * (keys.length - 1))) / 2
  const baseY = height - Math.max(34, height * 0.075)

  keys.forEach(({ color, note }, index) => {
    const isActive = activeNotes.includes(note)
    const x = startX + index * (keyWidth + gap)
    const y = baseY - barHeight + (isActive ? 7 : 0)
    context.fillStyle = isActive ? color : '#f4f0ff'
    context.fillRect(x, y, keyWidth, barHeight - (isActive ? 7 : 0))
    context.fillStyle = isActive ? '#302767' : '#b6aec9'
    context.fillRect(x + keyWidth, y + 3, 5, barHeight - (isActive ? 7 : 0))
    context.fillStyle = isActive ? '#F2F0FA' : '#171227'
    context.font = `${Math.max(10, width * 0.018)}px monospace`
    context.textAlign = 'center'
    context.fillText(note, x + keyWidth / 2, baseY - 10)
  })
}

function drawBells(context, width, height, keys, activeNotes = []) {
  const spacing = Math.min(72, width * 0.09)
  const startX = width / 2 - (spacing * (keys.length - 1)) / 2
  const baseY = height - Math.max(50, height * 0.1)

  keys.forEach(({ color, note }, index) => {
    const isActive = activeNotes.includes(note)
    const x = startX + index * spacing
    const y = baseY - 36 + (isActive ? 3 : 0)
    context.save()
    context.translate(x, y)
    context.fillStyle = isActive ? color : '#F5C77E'
    context.beginPath()
    context.ellipse(0, 0, 16, 19, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#fff6c8'
    context.beginPath()
    context.ellipse(-5, -7, 4, 8, -.4, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#8b571f'
    context.fillRect(-18, 16, 36, 5)
    context.restore()
    context.fillStyle = '#F2F0FA'
    context.font = `${Math.max(10, width * 0.018)}px monospace`
    context.textAlign = 'center'
    context.fillText(note, x, baseY + 15)
  })
}

function drawPadRipples(context, width, height, events = []) {
  events.slice(-10).forEach(({ color = '#7C6FFF', position }, index) => {
    if (!position) return
    context.strokeStyle = color
    context.globalAlpha = Math.max(.12, 1 - index / 11)
    context.lineWidth = 2
    context.beginPath()
    context.ellipse(position.x * width, position.y * height, 14 + index * 10, 7 + index * 5, 0, 0, Math.PI * 2)
    context.stroke()
  })
  context.globalAlpha = 1
}

function drawTheremin(context, width, height, state = {}) {
  const intensity = state.intensity ?? .18
  const pitch = state.pitch ?? .5
  const glow = context.createRadialGradient(pitch * width, height * .55, 0, pitch * width, height * .55, width * .42)
  glow.addColorStop(0, `rgba(245, 199, 126, ${intensity * .5})`)
  glow.addColorStop(1, 'rgba(124, 111, 255, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  ;[width * .08, width * .92].forEach((x) => {
    context.strokeStyle = '#d8d2f4'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(x, height - 34)
    context.lineTo(x + (x < width / 2 ? -18 : 18), height * .36)
    context.stroke()
    context.strokeStyle = '#F5C77E'
    context.lineWidth = 3
    context.beginPath()
    context.arc(x + (x < width / 2 ? -18 : 18), height * .36, 12, 0, Math.PI * 2)
    context.stroke()
  })
}

function drawWaveform(context, width, height, isActive, now) {
  const barCount = 42
  const waveformHeight = Math.max(18, height * .045)
  context.fillStyle = '#0B0B14dd'
  context.fillRect(0, height - waveformHeight, width, waveformHeight)
  for (let index = 0; index < barCount; index += 1) {
    const phase = now / (isActive ? 120 : 900) + index * .55
    const barHeight = waveformHeight * (isActive ? .25 + (Math.sin(phase) + 1) * .3 : .18 + (Math.sin(phase) + 1) * .08)
    context.fillStyle = isActive ? '#F5C77E' : '#7C6FFF'
    context.fillRect(index * (width / barCount) + 2, height - barHeight - 3, Math.max(2, width / barCount - 4), barHeight)
  }
}

function getScaleKeys(handOctaves = []) {
  const rightHand = handOctaves.find(({ id, side }) => id === 'right' || side?.toLowerCase() === 'right')
  const leftHand = handOctaves.find(({ id, side }) => id === 'left' || side?.toLowerCase() === 'left')
  return [
    ...makeKeys(LEFT_HAND_SCALE, leftHand, '#5be6b3'),
    ...makeKeys(RIGHT_HAND_SCALE, rightHand, '#a791ff'),
  ]
}

function makeKeys(notes, hand, fallbackColor) {
  return notes.map((note) => ({
    color: hand?.color ?? fallbackColor,
    note: note.replace(/(\d+)$/, (octave) => String(Number(octave) + (hand?.shift ?? 0))),
  }))
}

export default RecordingCanvas
