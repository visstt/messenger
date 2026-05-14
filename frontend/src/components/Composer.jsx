import { useEffect, useMemo, useRef, useState } from "react";
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

export default function Composer({
  chatId,
  isDisabled,
  inputPlaceholder,
  disabledTitle,
  replyMessage,
  replyPreview,
  onCancelReply,
  onSendText,
  onSendAttachment,
  onSendVoice,
  onSendVideoNote,
  onTyping,
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isMobileComposer, setIsMobileComposer] = useState(false);
  const [mobileRecorderMode, setMobileRecorderMode] = useState("voice");
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [isRecordingVideoNote, setIsRecordingVideoNote] = useState(false);
  const [isSendingVideoNote, setIsSendingVideoNote] = useState(false);
  const [videoNoteBlob, setVideoNoteBlob] = useState(null);
  const [videoNotePreviewUrl, setVideoNotePreviewUrl] = useState("");
  const [videoNoteDurationSec, setVideoNoteDurationSec] = useState(0);
  const [videoNoteElapsedSec, setVideoNoteElapsedSec] = useState(0);
  const [recorderError, setRecorderError] = useState("");
  const [voiceVisualizerMounted, setVoiceVisualizerMounted] = useState(false);
  const [isVoiceUiCleared, setIsVoiceUiCleared] = useState(false);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);
  const clearCanvasRef = useRef(null);
  const mobileRecorderPressTimerRef = useRef(null);
  const mobileRecorderHoldRef = useRef(false);
  const mobileRecorderPressedRef = useRef(false);
  const mobileRecorderPointerIdRef = useRef(null);
  const videoNoteRecorderRef = useRef(null);
  const videoNoteStreamRef = useRef(null);
  const videoNoteChunksRef = useRef([]);
  const videoNoteStartedAtRef = useRef(0);
  const videoNotePreviewRef = useRef(null);
  const voiceRecorderOptions = useMemo(() => pickVoiceRecorderOptions(), []);
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

  const hasVoiceDraft = Boolean(recordedBlob && isAvailableRecordedAudio && !isVoiceUiCleared);
  const showVoicePanel =
    !isVoiceUiCleared && (isRecordingInProgress || hasVoiceDraft || isProcessingRecordedAudio);
  const isVoicePlaying = hasVoiceDraft && !isPausedRecordedAudio;
  const hasAttachments = attachments.length > 0;
  const replyLabel = replyMessage?.sender?.name || "";
  const hasVideoNoteDraft = Boolean(videoNoteBlob && videoNotePreviewUrl);
  const showVideoNotePanel = isRecordingVideoNote || hasVideoNoteDraft;
  const voiceVisualizerKey = hasVoiceDraft
    ? "draft"
    : isRecordingInProgress
      ? "recording"
      : "idle";
  const isMobileRecorderBusy =
    isRecordingInProgress || isRecordingVideoNote || hasVoiceDraft || hasVideoNoteDraft;
  const showMobileRecorderToggle = isMobileComposer && !hasVoiceDraft && !hasVideoNoteDraft;

  useEffect(() => {
    clearCanvasRef.current = clearCanvas;
  }, [clearCanvas]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => setIsMobileComposer(media.matches);
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!isRecordingVideoNote) return undefined;

    const timer = window.setInterval(() => {
      setVideoNoteElapsedSec(
        Math.max(0, Math.floor((Date.now() - videoNoteStartedAtRef.current) / 1000))
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRecordingVideoNote]);

  useEffect(() => {
    if (!videoNotePreviewRef.current) return;

    if (isRecordingVideoNote && videoNoteStreamRef.current) {
      videoNotePreviewRef.current.srcObject = videoNoteStreamRef.current;
      videoNotePreviewRef.current.play().catch(() => null);
      return;
    }

    videoNotePreviewRef.current.srcObject = null;
    if (videoNotePreviewUrl) {
      videoNotePreviewRef.current.src = videoNotePreviewUrl;
      videoNotePreviewRef.current.play().catch(() => null);
    }
  }, [isRecordingVideoNote, videoNotePreviewUrl]);

  useEffect(() => {
    resetComposerState();
  }, [chatId]);

  useEffect(() => {
    if (!showVoicePanel) {
      setVoiceVisualizerMounted(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setVoiceVisualizerMounted(true);
      window.dispatchEvent(new Event("resize"));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [showVoicePanel, voiceVisualizerKey]);

  useEffect(
    () => () => {
      clearMobileRecorderPress();
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      stopVideoNoteStream();
      if (videoNotePreviewUrl) URL.revokeObjectURL(videoNotePreviewUrl);
    },
    [videoNotePreviewUrl]
  );

  function resetComposerState() {
    clearMobileRecorderPress();
    setRecorderError("");
    setText("");
    clearAttachments();
    clearCanvasRef.current?.();
    discardVideoNote();
  }

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
      setRecorderError("");
      await onSendVoice(recordedBlob, Math.max(1, Math.round(duration || 0)), replyMessage?.id);
      setIsVoiceUiCleared(true);
      setVoiceVisualizerMounted(false);
      clearCanvas();
    } finally {
      setIsSendingVoice(false);
    }
  }

  async function startVoiceCapture() {
    if (isDisabled || hasVoiceDraft || showVideoNotePanel) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Браузер не поддерживает доступ к микрофону.");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new Error("В этом браузере запись голосовых недоступна.");
    }

    clearCanvas();
    setIsVoiceUiCleared(false);
    await startRecording();
  }

  async function startVideoNoteRecording() {
    if (isDisabled || showVoicePanel || hasAttachments || showVideoNotePanel) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Браузер не поддерживает доступ к камере и микрофону.");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new Error("В этом браузере запись видеокружков недоступна.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    const mimeType = pickVideoNoteMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    videoNoteChunksRef.current = [];
    videoNoteStreamRef.current = stream;
    videoNoteRecorderRef.current = recorder;
    videoNoteStartedAtRef.current = Date.now();
    setVideoNoteElapsedSec(0);
    setIsRecordingVideoNote(true);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        videoNoteChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(videoNoteChunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      const nextUrl = URL.createObjectURL(blob);
      stopVideoNoteStream();
      setVideoNoteBlob(blob);
      setVideoNoteDurationSec(
        Math.max(1, Math.floor((Date.now() - videoNoteStartedAtRef.current) / 1000))
      );
      setVideoNotePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setIsRecordingVideoNote(false);
      setVideoNoteElapsedSec(0);
    };

    recorder.start();
  }

  function stopVideoNoteRecording() {
    if (!videoNoteRecorderRef.current || videoNoteRecorderRef.current.state === "inactive") return;
    videoNoteRecorderRef.current.stop();
  }

  function stopVideoNoteStream() {
    const stream = videoNoteStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoNoteStreamRef.current = null;
    }
  }

  function clearMobileRecorderPress() {
    if (mobileRecorderPressTimerRef.current) {
      window.clearTimeout(mobileRecorderPressTimerRef.current);
      mobileRecorderPressTimerRef.current = null;
    }
    mobileRecorderPressedRef.current = false;
    mobileRecorderHoldRef.current = false;
    mobileRecorderPointerIdRef.current = null;
    window.removeEventListener("pointerup", handleMobileRecorderWindowPointerUp);
    window.removeEventListener("pointercancel", handleMobileRecorderWindowPointerCancel);
    window.removeEventListener("blur", handleMobileRecorderWindowPointerCancel);
  }

  function toggleMobileRecorderMode() {
    if (isMobileRecorderBusy || hasAttachments || isDisabled) return;
    setMobileRecorderMode((prev) => (prev === "voice" ? "video" : "voice"));
  }

  function stopMobileRecorder() {
    if (mobileRecorderMode === "voice") {
      stopRecording();
      return;
    }
    stopVideoNoteRecording();
  }

  function finishMobileRecorderPress(shouldToggleMode = false) {
    if (mobileRecorderPressTimerRef.current) {
      window.clearTimeout(mobileRecorderPressTimerRef.current);
      mobileRecorderPressTimerRef.current = null;
      mobileRecorderPressedRef.current = false;
      mobileRecorderPointerIdRef.current = null;
      if (shouldToggleMode) toggleMobileRecorderMode();
      return;
    }

    mobileRecorderPressedRef.current = false;
    mobileRecorderPointerIdRef.current = null;

    if (mobileRecorderHoldRef.current) {
      mobileRecorderHoldRef.current = false;
      stopMobileRecorder();
    }
  }

  function handleMobileRecorderWindowPointerUp(event) {
    if (
      mobileRecorderPointerIdRef.current !== null &&
      event.pointerId !== mobileRecorderPointerIdRef.current
    ) {
      return;
    }
    finishMobileRecorderPress(true);
  }

  function handleMobileRecorderWindowPointerCancel() {
    finishMobileRecorderPress(false);
  }

  async function startMobileRecorder() {
    setRecorderError("");
    if (mobileRecorderMode === "voice") {
      await startVoiceCapture();
      return;
    }
    await startVideoNoteRecording();
  }

  function handleMobileRecorderPointerDown(event) {
    if (!isMobileComposer || hasAttachments || isDisabled || hasVoiceDraft || hasVideoNoteDraft) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mobileRecorderPressedRef.current = true;
    mobileRecorderHoldRef.current = false;
    mobileRecorderPointerIdRef.current = event.pointerId;
    window.addEventListener("pointerup", handleMobileRecorderWindowPointerUp);
    window.addEventListener("pointercancel", handleMobileRecorderWindowPointerCancel);
    window.addEventListener("blur", handleMobileRecorderWindowPointerCancel);

    mobileRecorderPressTimerRef.current = window.setTimeout(async () => {
      mobileRecorderPressTimerRef.current = null;
      if (!mobileRecorderPressedRef.current) return;
      mobileRecorderHoldRef.current = true;

      try {
        await startMobileRecorder();
        if (!mobileRecorderPressedRef.current) {
          mobileRecorderHoldRef.current = false;
          stopMobileRecorder();
        }
      } catch (error) {
        setRecorderError(
          getRecorderErrorMessage(error, mobileRecorderMode === "voice" ? "microphone" : "camera")
        );
        clearMobileRecorderPress();
      }
    }, 180);
  }

  function handleMobileRecorderPointerUp(event) {
    if (!isMobileComposer) return;
    event.preventDefault();
    if (
      mobileRecorderPointerIdRef.current !== null &&
      event.pointerId !== mobileRecorderPointerIdRef.current
    ) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    finishMobileRecorderPress(true);
  }

  function handleMobileRecorderPointerCancel() {
    if (!isMobileComposer) return;
    finishMobileRecorderPress(false);
  }

  function discardVideoNote() {
    clearMobileRecorderPress();
    if (videoNoteRecorderRef.current && videoNoteRecorderRef.current.state !== "inactive") {
      videoNoteRecorderRef.current.stop();
    } else {
      stopVideoNoteStream();
    }
    videoNoteRecorderRef.current = null;
    videoNoteChunksRef.current = [];
    setIsRecordingVideoNote(false);
    setVideoNoteBlob(null);
    setVideoNoteDurationSec(0);
    setVideoNoteElapsedSec(0);
    setVideoNotePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }

  async function sendVideoNoteDraft() {
    if (!videoNoteBlob || isSendingVideoNote || isDisabled) return;

    setIsSendingVideoNote(true);
    try {
      setRecorderError("");
      const file = new File([videoNoteBlob], `video-note-${Date.now()}.webm`, {
        type: videoNoteBlob.type || "video/webm",
      });
      await onSendVideoNote(file, replyMessage?.id, videoNoteDurationSec);
      discardVideoNote();
    } finally {
      setIsSendingVideoNote(false);
    }
  }

  return (
    <form
      ref={formRef}
      className={`composer tg-composer ${showVoicePanel || showVideoNotePanel ? "has-voice-panel" : ""}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const nextText = text.trim();
        const nextAttachments = attachments.map((item) => item.file);
        if (
          isDisabled ||
          showVoicePanel ||
          showVideoNotePanel ||
          (!nextText && nextAttachments.length === 0)
        ) {
          return;
        }

        setText("");
        clearAttachments();
        if (nextAttachments.length > 0) {
          await onSendAttachment(nextAttachments, nextText, replyMessage?.id);
        } else {
          await onSendText(nextText, replyMessage?.id);
        }
        await onTyping(false);
      }}
    >
      {replyMessage && (
        <div className="reply-draft tg-reply-draft" aria-label="Reply draft">
          <div className="reply-draft-copy tg-reply-draft__copy">
            <strong>{`Ответ: ${replyLabel}`}</strong>
            <span>{replyPreview}</span>
          </div>
          <button type="button" className="reply-draft-close tg-reply-draft__close" onClick={onCancelReply}>
            <FiX />
          </button>
        </div>
      )}

      {recorderError && <div className="inline-error tg-composer-error">{recorderError}</div>}

      {showVideoNotePanel && (
        <div className="video-note-draft" aria-label="Video note draft">
          <div className={`video-note-preview-shell ${isRecordingVideoNote ? "is-recording" : ""}`}>
            <video
              ref={videoNotePreviewRef}
              className="video-note-preview"
              muted
              playsInline
              autoPlay
              loop={!isRecordingVideoNote}
            />
          </div>
          <div className="video-note-draft-copy">
            <strong>{isRecordingVideoNote ? "Запись видеокружка" : "Видеокружок готов"}</strong>
            <span>{formatSeconds(isRecordingVideoNote ? videoNoteElapsedSec : videoNoteDurationSec)}</span>
          </div>
          <div className="video-note-draft-actions">
            {isRecordingVideoNote ? (
              <button
                type="button"
                className="video-note-action video-note-action-stop"
                onClick={stopVideoNoteRecording}
                aria-label="Остановить запись"
              >
                <FiSquare />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="video-note-action"
                  onClick={discardVideoNote}
                  aria-label="Отменить видеокружок"
                >
                  <FiX />
                </button>
                <button
                  type="button"
                  className="video-note-action video-note-action-send"
                  disabled={isSendingVideoNote || isDisabled}
                  onClick={sendVideoNoteDraft}
                  aria-label="Отправить видеокружок"
                >
                  <FiSend />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {hasAttachments && (
        <div className="attachment-draft tg-attachment-draft" aria-label="Selected attachments">
          <div className="attachment-draft-head tg-attachment-draft__head">
            <span>{attachments.length === 1 ? "1 вложение" : `${attachments.length} вложений`}</span>
            <button type="button" onClick={clearAttachments}>
              Очистить
            </button>
          </div>
          <div className="attachment-draft-list tg-attachment-draft__list">
            {attachments.map((item) => (
              <div className={`attachment-draft-item tg-attachment-draft__item is-${item.type}`} key={item.id}>
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

      <div className="composer-row tg-composer__row" title={disabledTitle || ""}>
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
          className="attach-button tg-composer__icon-button"
          type="button"
          aria-label="Прикрепить файл"
          title={disabledTitle || "Прикрепить файл"}
          disabled={isDisabled || showVideoNotePanel}
          onClick={() => fileInputRef.current?.click()}
        >
          <FiPaperclip />
        </button>

        {!isMobileComposer && (
          <button
            className={`ghost-button video-note-toggle tg-composer__icon-button ${isRecordingVideoNote ? "danger-button is-recording" : ""}`}
            type="button"
            aria-label={isRecordingVideoNote ? "Остановить видеокружок" : "Записать видеокружок"}
            title={disabledTitle || (isRecordingVideoNote ? "Остановить видеокружок" : "Записать видеокружок")}
            disabled={showVoicePanel || hasAttachments || (hasVideoNoteDraft && !isRecordingVideoNote) || isDisabled}
            onClick={async () => {
              if (isRecordingVideoNote) {
                stopVideoNoteRecording();
                return;
              }
              try {
                setRecorderError("");
                await startVideoNoteRecording();
              } catch (error) {
                setRecorderError(getRecorderErrorMessage(error, "camera"));
              }
            }}
          >
            <FiVideo />
          </button>
        )}

        <div className="composer-input-shell tg-composer__input-shell">
        <textarea
          className="tg-composer__input"
          placeholder={isMobileComposer ? "" : inputPlaceholder || "Напишите сообщение"}
          value={text}
          disabled={showVoicePanel || showVideoNotePanel || isDisabled}
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

        <div className={`composer-voice-wave ${showVoicePanel ? "is-visible" : ""} ${hasVoiceDraft ? "has-draft" : ""}`}>
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
          {voiceVisualizerMounted ? (
            <VoiceVisualizer
              key={voiceVisualizerKey}
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
          ) : (
            <div className="voice-visualizer-placeholder" aria-hidden="true" />
          )}
          <span>
            {isRecordingInProgress
              ? formattedRecordingTime || "00:00"
              : formattedRecordedAudioCurrentTime || formattedDuration || "00:00"}
          </span>
          {isRecordingInProgress && (
            <button
              type="button"
              className="voice-mini-button"
              aria-label="РћСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РїРёСЃСЊ"
              onClick={() => {
                clearMobileRecorderPress();
                stopRecording();
              }}
            >
              <FiSquare />
            </button>
          )}
          {hasVoiceDraft && (
            <div className="voice-draft-actions">
              <button
                type="button"
                className="voice-mini-button"
                aria-label="Отменить голосовое"
                onClick={() => {
                  stopAudioPlayback();
                  setIsVoiceUiCleared(true);
                  setVoiceVisualizerMounted(false);
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
        </div>

        {showMobileRecorderToggle ? (
          <button
            className={`ghost-button voice-toggle tg-composer__icon-button mobile-recorder-toggle ${
              isRecordingInProgress || isRecordingVideoNote ? "danger-button is-recording" : ""
            }`}
            type="button"
            aria-label={
              isRecordingInProgress || isRecordingVideoNote
                ? "Запись идет"
                : mobileRecorderMode === "voice"
                  ? "Микрофон: тап переключает, удержание записывает"
                  : "Видеокружок: тап переключает, удержание записывает"
            }
            title={
              disabledTitle ||
              (mobileRecorderMode === "voice"
                ? "Микрофон: тап переключает, удержание записывает"
                : "Видеокружок: тап переключает, удержание записывает")
            }
            disabled={isProcessingStartRecording || hasAttachments || isDisabled}
            onPointerDown={handleMobileRecorderPointerDown}
            onPointerUp={handleMobileRecorderPointerUp}
            onPointerLeave={handleMobileRecorderPointerCancel}
            onPointerCancel={handleMobileRecorderPointerCancel}
          >
            {isRecordingInProgress || isRecordingVideoNote ? (
              <FiSquare />
            ) : mobileRecorderMode === "voice" ? (
              <FiMic />
            ) : (
              <FiVideo />
            )}
          </button>
        ) : (
          <button
            className={`ghost-button voice-toggle tg-composer__icon-button ${isRecordingInProgress ? "danger-button is-recording" : ""}`}
            type="button"
            aria-label={isRecordingInProgress ? "Остановить запись" : "Записать голосовое"}
            title={disabledTitle || (isRecordingInProgress ? "Остановить запись" : "Записать голосовое")}
            disabled={isProcessingStartRecording || hasVoiceDraft || showVideoNotePanel || isDisabled}
            onClick={async () => {
              if (isRecordingInProgress) {
                stopRecording();
                return;
              }
              try {
                setRecorderError("");
                await startVoiceCapture();
              } catch (error) {
                setRecorderError(getRecorderErrorMessage(error, "microphone"));
              }
            }}
          >
            {isRecordingInProgress ? <FiSquare /> : <FiMic />}
          </button>
        )}

        <button
          className="primary-button composer-send-button tg-composer__send"
          type="submit"
          disabled={showVoicePanel || showVideoNotePanel || isDisabled}
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
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatSeconds(value) {
  const total = Math.max(0, Number(value || 0));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function pickVideoNoteMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function pickVoiceRecorderOptions() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
}

function getRecorderErrorMessage(error, device) {
  const message = error instanceof Error ? error.message : "";
  const lowered = message.toLowerCase();

  if (
    lowered.includes("permission") ||
    lowered.includes("denied") ||
    lowered.includes("notallowed")
  ) {
    return device === "camera"
      ? "Дайте доступ к камере и микрофону, чтобы записать видеокружок."
      : "Дайте доступ к микрофону, чтобы записать голосовое.";
  }

  if (lowered.includes("notfound") || lowered.includes("device not found")) {
    return device === "camera"
      ? "Камера или микрофон не найдены на этом устройстве."
      : "Микрофон не найден на этом устройстве.";
  }

  if (message) return message;

  return device === "camera"
    ? "Не удалось начать запись видеокружка."
    : "Не удалось начать запись голосового.";
}
