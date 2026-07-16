const MAX_TIMESTAMPS = 10
const MIN_INTERVALS_FOR_TEMPO = 4
const TEMPO_TOLERANCE = 0.18
const MIN_INTERVAL_MS = 250
const MAX_INTERVAL_MS = 2000
const SIMULTANEOUS_ONSET_WINDOW_MS = 80

export function createRhythmDetector() {
  const timestamps = []

  return {
    recordNoteOnset(timestamp = performance.now()) {
      const lastTimestamp = timestamps.at(-1)
      if (lastTimestamp && timestamp - lastTimestamp < SIMULTANEOUS_ONSET_WINDOW_MS) return { status: 'collecting' }

      timestamps.push(timestamp)
      if (timestamps.length > MAX_TIMESTAMPS) timestamps.shift()

      const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index])
      if (intervals.length < MIN_INTERVALS_FOR_TEMPO) return { status: 'collecting' }

      const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      const isValidTempoRange = averageInterval >= MIN_INTERVAL_MS && averageInterval <= MAX_INTERVAL_MS
      const isConsistent = intervals.every((interval) => (
        Math.abs(interval - averageInterval) <= averageInterval * TEMPO_TOLERANCE
      ))

      return isValidTempoRange && isConsistent
        ? { bpm: Math.round(60000 / averageInterval), status: 'stable' }
        : { status: 'irregular' }
    },
  }
}
