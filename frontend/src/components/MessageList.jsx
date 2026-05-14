import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VoiceVisualizer, useVoiceVisualizer } from "react-voice-visualizer";
import {
  FiCornerUpLeft,
  FiDownload,
  FiEdit3,
  FiFile,
  FiBookmark,
  FiPause,
  FiPlay,
  FiShare2,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import VideoCircle from "./VideoCircle";
import { normalizeMediaUrl } from "../utils/mediaUrls";
import {
  formatClock,
  groupMessages,
  parseAttachmentItems,
  parseImageItems,
  renderPreview,
  translateStatus,
} from "../utils/messages";

export default function MessageList({
  chatId,
  currentUser,
  messages,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onTogglePin,
  onOpenImage,
  forceScroll,
}) {
  const bottomRef = useRef(null);
  const stayPinnedRef = useRef(true);
  const previousChatIdRef = useRef(chatId);
  const longPressTimerRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const displayMessages = useMemo(() => groupMessages(messages), [messages]);
  const pinnedMessage = useMemo(
    () =>
      [...messages]
        .filter((message) => message.pinnedAt && !message.deletedAt && message.kind !== "system")
        .sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime())[0],
    [messages]
  );
  const replyIndex = useMemo(
    () => new Map(messages.map((message) => [Number(message.id), message])),
    [messages]
  );

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

  useEffect(() => {
    function closeMenu(event) {
      if (event.button === 2) return;
      setContextMenu(null);
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("resize", closeMenu);
      clearLongPressTimer();
    };
  }, []);

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function openMessageMenu(message, event) {
    if (message.deletedAt || message.e2eeState === "locked") return;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    const rawX = event.clientX || rect?.left || window.innerWidth / 2;
    const rawY = event.clientY || rect?.top || window.innerHeight / 2;
    const x = Math.min(rawX, window.innerWidth - 220);
    const y = Math.min(rawY, window.innerHeight - 280);
    setContextMenu({ message, x, y });
  }

  function runMenuAction(action) {
    if (!contextMenu?.message || typeof action !== "function") return;
    action(contextMenu.message);
    setContextMenu(null);
  }

  return (
    <section
      className="message-list"
      onScroll={(event) => {
        const node = event.currentTarget;
        const offset = node.scrollHeight - node.scrollTop - node.clientHeight;
        stayPinnedRef.current = offset < 96;
      }}
    >
      {pinnedMessage && (
        <button
          type="button"
          className="pinned-message-bar"
          onClick={() => {
            document
              .querySelector(`[data-message-id="${pinnedMessage.id}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <FiBookmark />
          <span>
            <strong>Закреплено</strong>
            <small>{renderPreview(pinnedMessage)}</small>
          </span>
        </button>
      )}
      {displayMessages.map((message) => {
        if (message.kind === "system") {
          return (
            <div key={message.key} className="system-message-row" aria-label="System message">
              <div className="system-message-badge">{message.text}</div>
            </div>
          );
        }

        const own = message.senderId === currentUser.id;
        const replyTargetId = message.replyToMessageId ?? message.replyToMessage;
        const replyMessage = replyTargetId
          ? replyIndex.get(Number(replyTargetId))
          : null;

        return (
          <article key={message.key} className={`bubble-row ${own ? "own" : ""}`}>
            <div
              className={`bubble ${own ? "own" : ""} ${message.pinnedAt ? "is-pinned" : ""}`}
              data-message-id={message.id}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openMessageMenu(message, event);
              }}
              onMouseDown={(event) => {
                if (event.button !== 2) return;
                event.preventDefault();
                event.stopPropagation();
                openMessageMenu(message, event);
              }}
              onPointerDown={(event) => {
                if (event.pointerType === "mouse") {
                  if (event.button !== 2) return;
                  event.preventDefault();
                  event.stopPropagation();
                  openMessageMenu(message, event);
                  return;
                }
                clearLongPressTimer();
                longPressTimerRef.current = window.setTimeout(() => {
                  openMessageMenu(message, event);
                }, 520);
              }}
              onPointerMove={clearLongPressTimer}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
            >
              {!own && <span className="bubble-author">{message.sender.name}</span>}
              {message.forwardedFromName && !message.deletedAt && (
                <div className="forward-chip">
                  <strong>Пересланное сообщение</strong>
                  <span>{`От: ${message.forwardedFromName}`}</span>
                </div>
              )}
              {replyMessage && !message.deletedAt && (
                <div className="reply-chip">
                  <strong>{replyMessage.sender?.name || "Message"}</strong>
                  <span>{renderPreview(replyMessage)}</span>
                </div>
              )}
              {message.deletedAt ? (
                <p className="deleted-text">
                  {message.deletedGroup ? "Группа фото удалена" : "Сообщение удалено"}
                </p>
              ) : message.e2eeState === "locked" ? (
                <p className="deleted-text">
                  Не удалось расшифровать сообщение на этом устройстве.
                </p>
              ) : isEncryptedMessagePending(message) ? (
                <p className="deleted-text">Расшифровываем сообщение...</p>
              ) : (
                <>
                  {message.kind === "text" && <p>{message.text}</p>}
                  {message.kind === "image" && (
                    <ImageMessage message={message} onOpenImage={onOpenImage} />
                  )}
                  {message.kind === "video" && <VideoMessage message={message} />}
                  {message.kind === "video_note" && <VideoNoteMessage message={message} />}
                  {message.kind === "file" && <FileMessage message={message} />}
                  {message.kind === "voice" && <VoiceMessage message={message} />}
                  {message.kind !== "text" && message.text && (
                    <p className="media-caption">{message.text}</p>
                  )}
                </>
              )}
              <footer className="bubble-meta">
                <span>{formatClock(message.createdAt)}</span>
                {message.pinnedAt && <span>закреплено</span>}
                {message.editedAt && <span>изменено</span>}
                {message.grouped && <span>{`фото: ${message.items.length}`}</span>}
                {own && <span>{translateStatus(message.status)}</span>}
              </footer>
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
      {contextMenu &&
        createPortal(
          <div
            className="message-context-menu"
            style={{
              left: `${Math.max(8, contextMenu.x)}px`,
              top: `${Math.max(8, contextMenu.y)}px`,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => runMenuAction(onReply)}>
              <FiCornerUpLeft />
              <span>Ответить</span>
            </button>
            <button type="button" onClick={() => runMenuAction(onForward)}>
              <FiShare2 />
              <span>Переслать</span>
            </button>
            <button type="button" onClick={() => runMenuAction(onTogglePin)}>
              <FiBookmark />
              <span>{contextMenu.message.pinnedAt ? "Открепить" : "Закрепить"}</span>
            </button>
            {contextMenu.message.senderId === currentUser.id && contextMenu.message.kind === "text" && (
              <button type="button" onClick={() => runMenuAction(onEdit)}>
                <FiEdit3 />
                <span>Редактировать</span>
              </button>
            )}
            {contextMenu.message.senderId === currentUser.id && (
              <button type="button" className="danger-menu-item" onClick={() => runMenuAction(onDelete)}>
                <FiTrash2 />
                <span>Удалить</span>
              </button>
            )}
            <button type="button" onClick={() => setContextMenu(null)}>
              <FiX />
              <span>Закрыть</span>
            </button>
          </div>,
          document.body
        )}
    </section>
  );
}

function isEncryptedMessagePending(message) {
  return Boolean(message?.encryptedPayload) && message.e2eeState !== "ready";
}

function VoiceMessage({ message }) {
  const [loaded, setLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(message.durationSec || 0);
  const audioRef = useRef(null);
  const loadedUrlRef = useRef("");
  const controls = useVoiceVisualizer({ shouldHandleBeforeUnload: false });
  const {
    isProcessingRecordedAudio,
    formattedDuration,
    setPreloadedAudioBlob,
  } = controls;
  const [item] = parseAttachmentItems(message);

  useEffect(() => {
    if (!item?.src || loadedUrlRef.current === item.src) return undefined;

    let cancelled = false;

    async function loadVoice() {
      setLoaded(false);
      setIsPlayingAudio(false);
      setAudioTime(0);
      setAudioUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return "";
      });
      const response = await fetch(normalizeMediaUrl(item.src), { credentials: "omit" });
      if (!response.ok) throw new Error("Failed to load voice message");
      const blob = await response.blob();
      const detectedMimeType = await getVoiceMimeType(blob, item);
      const preparedBlob = new Blob([blob], { type: detectedMimeType });
      if (cancelled) return;
      loadedUrlRef.current = item.src;
      setPreloadedAudioBlob(preparedBlob);
      setAudioUrl(URL.createObjectURL(preparedBlob));
      setLoaded(true);
    }

    loadVoice().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [item?.src, setPreloadedAudioBlob]);

  useEffect(
    () => () => {
      if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  const ready = loaded && Boolean(audioUrl);
  const playing = ready && isPlayingAudio;
  const durationLabel =
    formatAudioTime(audioDuration || message.durationSec) || formattedDuration || "00:00";
  const currentLabel = formatAudioTime(audioTime) || "00:00";

  return (
    <div className={`voice-message voice-note document ${playing ? "is-playing" : ""}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration)) setAudioDuration(duration);
        }}
        onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlayingAudio(true)}
        onPause={() => setIsPlayingAudio(false)}
        onEnded={() => {
          setIsPlayingAudio(false);
          setAudioTime(0);
        }}
      />
      <button
        type="button"
        className="voice-play-button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={async (event) => {
          event.stopPropagation();
          const audio = audioRef.current;
          if (!audio) return;
          if (playing) {
            audio.pause();
            return;
          }
          if (audio.ended) audio.currentTime = 0;
          audio.load();
          await audio.play().catch(() => {
            setIsPlayingAudio(false);
          });
        }}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        disabled={!ready}
      >
        {playing ? <FiPause /> : <FiPlay />}
      </button>
      <div className="voice-wave-shell voice-note-content">
        <VoiceVisualizer
          controls={controls}
          height={44}
          width="100%"
          barWidth={4}
          gap={2}
          rounded={6}
          speed={2}
          mainBarColor="var(--voice-note-wave-main)"
          secondaryBarColor="var(--voice-note-wave-secondary)"
          backgroundColor="transparent"
          isControlPanelShown={false}
          isDefaultUIShown={false}
          isAudioProcessingTextShown={false}
          isProgressIndicatorTimeShown={false}
          isProgressIndicatorTimeOnHoverShown={false}
        />
        <div className="voice-time-row voice-note-meta">
          <span>{currentLabel}</span>
          <span>{durationLabel}</span>
        </div>
      </div>
    </div>
  );
}

async function getVoiceMimeType(blob, item) {
  const sniffedType = await sniffMediaMimeType(blob);
  if (sniffedType) return sniffedType;

  const sourceType = blob?.type || item?.mimeType || "";
  const name = item?.name || item?.src || "";

  if (sourceType.startsWith("audio/")) return sourceType;
  if (sourceType.includes("ogg") || name.toLowerCase().endsWith(".ogg")) return "audio/ogg";
  if (sourceType.includes("mpeg") || name.toLowerCase().endsWith(".mp3")) return "audio/mpeg";
  if (sourceType.includes("wav") || name.toLowerCase().endsWith(".wav")) return "audio/wav";
  if (sourceType.includes("mp4") || name.toLowerCase().endsWith(".m4a")) return "audio/mp4";
  return "audio/webm";
}

async function sniffMediaMimeType(blob) {
  if (!blob?.slice) return "";

  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...bytes);

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (text.startsWith("OggS")) return "audio/ogg";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return "audio/wav";
  if (text.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return "audio/mpeg";
  }
  if (text.slice(4, 8) === "ftyp") return "audio/mp4";
  return "";
}

function formatAudioTime(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  if (!Number.isFinite(total)) return "";
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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
          <video controls preload="metadata" className="inline-video-player" src={item.src} />
          <figcaption>{item.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function VideoNoteMessage({ message }) {
  const items = parseAttachmentItems(message);
  return (
    <div className="attachment-stack">
      {items.map((item) => (
        <figure className="video-message video-note-message" key={item.src}>
          <VideoCircle
            src={item.src}
            title={item.name}
            mimeType={item.mimeType}
            className="chat-video-circle"
          />
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
