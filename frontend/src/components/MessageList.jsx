import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceVisualizer, useVoiceVisualizer } from "react-voice-visualizer";
import { FiDownload, FiEdit3, FiFile, FiPause, FiPlay, FiTrash2 } from "react-icons/fi";
import {
  formatClock,
  groupMessages,
  parseAttachmentItems,
  parseImageItems,
  translateStatus,
} from "../utils/messages";

export default function MessageList({
  chatId,
  currentUser,
  messages,
  onEdit,
  onDelete,
  onOpenImage,
  forceScroll,
}) {
  const bottomRef = useRef(null);
  const stayPinnedRef = useRef(true);
  const previousChatIdRef = useRef(chatId);
  const displayMessages = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    if (previousChatIdRef.current !== chatId) {
      previousChatIdRef.current = chatId;
      stayPinnedRef.current = true;
    }
  }, [chatId]);

  useEffect(() => {
    if (forceScroll || stayPinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, forceScroll]);

  return (
    <section
      className="message-list"
      onScroll={(event) => {
        const node = event.currentTarget;
        const offset = node.scrollHeight - node.scrollTop - node.clientHeight;
        stayPinnedRef.current = offset < 96;
      }}
    >
      {displayMessages.map((message) => {
        if (message.kind === "system") {
          return (
            <div key={message.key} className="system-message-row" aria-label="Системное сообщение">
              <div className="system-message-badge">{message.text}</div>
            </div>
          );
        }

        const own = message.senderId === currentUser.id;
        return (
          <article key={message.key} className={`bubble-row ${own ? "own" : ""}`}>
            <div className={`bubble ${own ? "own" : ""}`}>
              {!own && <span className="bubble-author">{message.sender.name}</span>}
              {message.deletedAt ? (
                <p className="deleted-text">
                  {message.deletedGroup ? "Группа фото удалена" : "Сообщение удалено"}
                </p>
              ) : message.e2eeState === "locked" ? (
                <p className="deleted-text">Не удалось расшифровать сообщение на этом устройстве.</p>
              ) : (
                <>
                  {message.kind === "text" && <p>{message.text}</p>}
                  {message.kind === "image" && (
                    <ImageMessage message={message} onOpenImage={onOpenImage} />
                  )}
                  {message.kind === "video" && <VideoMessage message={message} />}
                  {message.kind === "file" && <FileMessage message={message} />}
                  {message.kind === "voice" && <VoiceMessage message={message} />}
                  {message.kind !== "text" && message.text && (
                    <p className="media-caption">{message.text}</p>
                  )}
                </>
              )}
              <footer className="bubble-meta">
                <span>{formatClock(message.createdAt)}</span>
                {message.editedAt && <span>изменено</span>}
                {message.grouped && <span>{`фото: ${message.items.length}`}</span>}
                {own && <span>{translateStatus(message.status)}</span>}
              </footer>
              {own && !message.deletedAt && message.e2eeState !== "locked" && (
                <div className="bubble-actions">
                  {message.kind === "text" && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onEdit(message)}
                      aria-label="Редактировать"
                    >
                      <FiEdit3 />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onDelete(message)}
                    aria-label="Удалить"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </section>
  );
}

function VoiceMessage({ message }) {
  const [loaded, setLoaded] = useState(false);
  const loadedUrlRef = useRef("");
  const controls = useVoiceVisualizer({ shouldHandleBeforeUnload: false });
  const {
    currentAudioTime,
    isAvailableRecordedAudio,
    isPausedRecordedAudio,
    isProcessingRecordedAudio,
    formattedDuration,
    formattedRecordedAudioCurrentTime,
    startAudioPlayback,
    stopAudioPlayback,
    setPreloadedAudioBlob,
  } = controls;
  const [item] = parseAttachmentItems(message);

  useEffect(() => {
    if (!item?.src || loadedUrlRef.current === item.src) return undefined;

    let cancelled = false;

    async function loadVoice() {
      setLoaded(false);
      const response = await fetch(item.src);
      const blob = await response.blob();
      if (cancelled) return;
      loadedUrlRef.current = item.src;
      setPreloadedAudioBlob(blob);
      setLoaded(true);
    }

    loadVoice().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [item?.src, setPreloadedAudioBlob]);

  const ready = loaded && isAvailableRecordedAudio && !isProcessingRecordedAudio;
  const playing = ready && !isPausedRecordedAudio && currentAudioTime > 0;
  const durationLabel =
    formattedDuration || (message.durationSec ? `${message.durationSec}с` : "00:00");
  const currentLabel = formattedRecordedAudioCurrentTime || "00:00";

  return (
    <div className="voice-message">
      <button
        type="button"
        className="voice-play-button"
        onClick={() => {
          if (playing) {
            stopAudioPlayback();
            return;
          }
          startAudioPlayback();
        }}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        disabled={!ready}
      >
        {playing ? <FiPause /> : <FiPlay />}
      </button>
      <div className="voice-wave-shell">
        <VoiceVisualizer
          controls={controls}
          height={54}
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
        <div className="voice-time-row">
          <span>{currentLabel}</span>
          <span>{durationLabel}</span>
        </div>
      </div>
    </div>
  );
}

function ImageMessage({ message, onOpenImage }) {
  const items = parseImageItems(message);

  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <button type="button" className="image-button" onClick={() => onOpenImage(items, 0)}>
        <img className="message-image" src={item.src} alt={item.alt} />
      </button>
    );
  }

  return (
    <div className={`image-grid image-grid-${Math.min(items.length, 4)}`}>
      {items.map((item, index) => (
        <button
          key={item.src}
          type="button"
          className="image-button"
          onClick={() => onOpenImage(items, index)}
        >
          <img className="message-image multi" src={item.src} alt={item.alt} />
        </button>
      ))}
    </div>
  );
}

function VideoMessage({ message }) {
  const items = parseAttachmentItems(message);
  return (
    <div className="attachment-stack">
      {items.map((item) => (
        <figure className="video-message" key={item.src}>
          <video controls preload="metadata" src={item.src} />
          <figcaption>{item.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function FileMessage({ message }) {
  const items = parseAttachmentItems(message);
  return (
    <div className="attachment-stack">
      {items.map((item) => (
        <a className="file-message" key={item.src} href={item.src} download={item.name}>
          <span className="file-message-icon">
            <FiFile />
          </span>
          <span className="file-message-copy">
            <strong>{item.name}</strong>
            <small>{item.extension || "файл"}</small>
          </span>
          <FiDownload className="file-message-download" />
        </a>
      ))}
    </div>
  );
}
