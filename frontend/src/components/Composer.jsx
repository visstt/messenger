import { useEffect, useRef, useState } from "react";
import { VoiceVisualizer, useVoiceVisualizer } from "react-voice-visualizer";
import {
  FiFile,
  FiMic,
  FiPaperclip,
  FiPause,
  FiPlay,
  FiSend,
  FiSquare,
  FiVideo,
  FiX,
} from "react-icons/fi";

const voiceRecorderOptions = { mimeType: "audio/webm" };

export default function Composer({
  chatId,
  isDisabled,
  inputPlaceholder,
  disabledTitle,
  onSendText,
  onSendAttachment,
  onSendVoice,
  onTyping,
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);
  const clearCanvasRef = useRef(null);
  const recorderControls = useVoiceVisualizer({
    shouldHandleBeforeUnload: false,
    mediaRecorderOptions: voiceRecorderOptions,
  });
  const {
    recordedBlob,
    formattedRecordingTime,
    formattedDuration,
    formattedRecordedAudioCurrentTime,
    isRecordingInProgress,
    isProcessingStartRecording,
    isProcessingRecordedAudio,
    isPausedRecordedAudio,
    isAvailableRecordedAudio,
    duration,
    startRecording,
    stopRecording,
    startAudioPlayback,
    stopAudioPlayback,
    clearCanvas,
  } = recorderControls;

  const hasVoiceDraft = Boolean(recordedBlob && isAvailableRecordedAudio);
  const showVoicePanel = isRecordingInProgress || hasVoiceDraft || isProcessingRecordedAudio;
  const isVoicePlaying = hasVoiceDraft && !isPausedRecordedAudio;
  const hasAttachments = attachments.length > 0;

  useEffect(() => {
    clearCanvasRef.current = clearCanvas;
  }, [clearCanvas]);

  useEffect(() => {
    setText("");
    clearAttachments();
    clearCanvasRef.current?.();
  }, [chatId]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    []
  );

  function addAttachments(files) {
    const nextItems = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      type: getAttachmentType(file),
      previewUrl: URL.createObjectURL(file),
    }));
    setAttachments((prev) => {
      const merged = [...prev, ...nextItems];
      attachmentsRef.current = merged;
      return merged;
    });
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((item) => item.id !== id);
      attachmentsRef.current = next;
      return next;
    });
  }

  function clearAttachments() {
    setAttachments((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      attachmentsRef.current = [];
      return [];
    });
  }

  async function sendVoiceDraft() {
    if (!recordedBlob || isSendingVoice || isDisabled) return;

    setIsSendingVoice(true);
    try {
      await onSendVoice(recordedBlob, Math.max(1, Math.round(duration || 0)));
      clearCanvas();
    } finally {
      setIsSendingVoice(false);
    }
  }

  return (
    <form
      ref={formRef}
      className={`composer ${showVoicePanel ? "has-voice-panel" : ""}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const nextText = text.trim();
        const nextAttachments = attachments.map((item) => item.file);
        if (isDisabled || (!nextText && nextAttachments.length === 0)) return;

        setText("");
        clearAttachments();
        if (nextAttachments.length > 0) {
          await onSendAttachment(nextAttachments, nextText);
        } else {
          await onSendText(nextText);
        }
        await onTyping(false);
      }}
    >
      {hasAttachments && (
        <div className="attachment-draft" aria-label="Выбранные файлы">
          <div className="attachment-draft-head">
            <span>{attachments.length === 1 ? "1 вложение" : `${attachments.length} вложений`}</span>
            <button type="button" onClick={clearAttachments}>
              Очистить
            </button>
          </div>
          <div className="attachment-draft-list">
            {attachments.map((item) => (
              <div className={`attachment-draft-item is-${item.type}`} key={item.id}>
                <AttachmentPreview item={item} />
                {item.type === "file" && (
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatFileSize(item.size)}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="attachment-draft-remove"
                  aria-label="Убрать вложение"
                  onClick={() => removeAttachment(item.id)}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="composer-row" title={disabledTitle || ""}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z"
          multiple
          hidden
          disabled={isDisabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const files = Array.from(event.target.files || []);
            if (files.length > 0) addAttachments(files);
            event.target.value = "";
          }}
        />
        <button
          className="attach-button"
          type="button"
          aria-label="Прикрепить файл"
          title={disabledTitle || "Прикрепить файл"}
          disabled={isDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <FiPaperclip />
        </button>

        <textarea
          placeholder={inputPlaceholder || "Напишите сообщение"}
          value={text}
          disabled={showVoicePanel || isDisabled}
          onChange={async (event) => {
            setText(event.target.value);
            await onTyping(event.target.value.trim().length > 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          rows="1"
        />

        <div className={`composer-voice-wave ${showVoicePanel ? "is-visible" : ""}`}>
          {hasVoiceDraft && (
            <button
              type="button"
              className="voice-mini-button"
              aria-label={isVoicePlaying ? "Пауза" : "Прослушать"}
              onClick={() => {
                if (isVoicePlaying) {
                  stopAudioPlayback();
                  return;
                }
                startAudioPlayback();
              }}
            >
              {isVoicePlaying ? <FiPause /> : <FiPlay />}
            </button>
          )}
          <VoiceVisualizer
            controls={recorderControls}
            height={46}
            width="100%"
            barWidth={3}
            gap={2}
            rounded={6}
            speed={2}
            mainBarColor="var(--text)"
            secondaryBarColor="var(--muted)"
            backgroundColor="transparent"
            isControlPanelShown={false}
            isDefaultUIShown={false}
            isAudioProcessingTextShown={false}
            isProgressIndicatorTimeShown={false}
            isProgressIndicatorTimeOnHoverShown={false}
          />
          <span>
            {isRecordingInProgress
              ? formattedRecordingTime || "00:00"
              : formattedRecordedAudioCurrentTime || formattedDuration || "00:00"}
          </span>
          {hasVoiceDraft && (
            <div className="voice-draft-actions">
              <button
                type="button"
                className="voice-mini-button"
                aria-label="Отменить голосовое"
                onClick={() => {
                  stopAudioPlayback();
                  clearCanvas();
                }}
              >
                <FiX />
              </button>
              <button
                type="button"
                className="voice-mini-button voice-mini-button-send"
                aria-label="Отправить голосовое"
                disabled={isSendingVoice || isDisabled}
                onClick={sendVoiceDraft}
              >
                <FiSend />
              </button>
            </div>
          )}
        </div>

        <button
          className={`ghost-button voice-toggle ${isRecordingInProgress ? "danger-button is-recording" : ""}`}
          type="button"
          aria-label={isRecordingInProgress ? "Остановить запись" : "Записать голосовое"}
          title={disabledTitle || (isRecordingInProgress ? "Остановить запись" : "Записать голосовое")}
          disabled={isProcessingStartRecording || hasVoiceDraft || isDisabled}
          onClick={() => {
            if (isRecordingInProgress) {
              stopRecording();
              return;
            }
            clearCanvas();
            startRecording();
          }}
        >
          {isRecordingInProgress ? <FiSquare /> : <FiMic />}
        </button>

        <button
          className="primary-button composer-send-button"
          type="submit"
          disabled={showVoicePanel || isDisabled}
          aria-label="Отправить сообщение"
          title={disabledTitle || "Отправить сообщение"}
        >
          <FiSend />
        </button>
      </div>
    </form>
  );
}

function AttachmentPreview({ item }) {
  if (item.type === "image") {
    return <img src={item.previewUrl} alt="" />;
  }
  if (item.type === "video") {
    return (
      <span className="attachment-draft-icon">
        <FiVideo />
      </span>
    );
  }
  return (
    <span className="attachment-draft-icon">
      <FiFile />
    </span>
  );
}

function getAttachmentType(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function formatFileSize(size) {
  if (!size) return "0 Б";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}
