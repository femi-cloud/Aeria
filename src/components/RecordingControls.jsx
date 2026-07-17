function RecordingControls({ disabled, hasRecording, isRecording, onToggleRecording, onDownload, recordingSaved }) {
  return (
    <div className="ae-recording-controls">
      <button
        className={`ae-record-button ${isRecording ? 'ae-record-button--active' : ''}`}
        type="button"
        onClick={onToggleRecording}
        disabled={disabled}
      >
        <span className="ae-record-button__dot" aria-hidden="true" />
        {isRecording ? 'Stop recording' : 'Record'}
      </button>
      {hasRecording && (
        <button className="ae-download-button" type="button" onClick={onDownload}>
          Download recording
        </button>
      )}
      {recordingSaved && <span className="ae-recording-saved" role="status">Recording saved</span>}
    </div>
  )
}

export default RecordingControls
