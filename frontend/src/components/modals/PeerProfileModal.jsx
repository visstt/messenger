import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiFile, FiImage, FiMic, FiVideo } from "react-icons/fi";
import Avatar from "../Avatar";
import VideoCircle from "../VideoCircle";
import { formatClock, parseAttachmentItems, parseImageItems } from "../../utils/messages";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../../utils/chats";
import { Modal } from "../../ui";

const MEDIA_TABS = [
  { id: "photos", label: "Фото", icon: FiImage },
  { id: "videos", label: "Видео", icon: FiVideo },
  { id: "files", label: "Документы", icon: FiFile },
  { id: "voices", label: "Голосовые", icon: FiMic },
];

export default function PeerProfileModal({ open, chat, messages = [], onClose, onOpenImage }) {
  const [activeTab, setActiveTab] = useState("photos");
  const media = useMemo(() => buildMediaCollections(messages), [messages]);
  const isGroup = chat?.kind === "group";
  const totalMediaCount = MEDIA_TABS.reduce((count, tab) => count + media[tab.id].length, 0);

  useEffect(() => {
    if (open) setActiveTab("photos");
  }, [open, chat?.id]);

  if (!open || !chat) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isGroup ? "Профиль чата" : "Профиль пользователя"}
      contentClassName="tg-peer-media tg-peer-profile"
    >
      <div className="tg-peer-media__hero">
        <Avatar user={getChatAvatar(chat)} />
        <div className="tg-peer-media__hero-copy">
          <div className="tg-peer-media__title">{getChatTitle(chat)}</div>
          <div className="tg-peer-media__subtitle">{getChatSubtitle(chat)}</div>
          <div className="tg-peer-media__description">
            {isGroup
              ? "Общий чат и вся история вложений."
              : "Диалог, профиль и общие медиафайлы."}
          </div>
        </div>
      </div>

      <div className="tg-peer-profile__stats" aria-label="Статистика медиа">
        <div className="tg-peer-profile__stat">
          <strong>{messages.filter((message) => message.kind !== "system").length}</strong>
          <span>сообщений</span>
        </div>
        <div className="tg-peer-profile__stat">
          <strong>{totalMediaCount}</strong>
          <span>медиа</span>
        </div>
        <div className="tg-peer-profile__stat">
          <strong>{media.files.length}</strong>
          <span>документов</span>
        </div>
      </div>

      <div className="tg-peer-profile__section-title">Медиа</div>

      <div className="tg-peer-media__tabs" role="tablist" aria-label="Категории медиа">
        {MEDIA_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = media[tab.id].length;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tg-peer-media__tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon />
              <span>{tab.label}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="tg-peer-media__panel">
        {activeTab === "photos" && <PhotoSection items={media.photos} onOpenImage={onOpenImage} />}
        {activeTab === "videos" && <VideoSection items={media.videos} />}
        {activeTab === "files" && <FileSection items={media.files} />}
        {activeTab === "voices" && <VoiceSection items={media.voices} />}
      </div>
    </Modal>
  );
}

function PhotoSection({ items, onOpenImage }) {
  if (items.length === 0) return <EmptyMediaState label="Фото из этого диалога пока нет" />;

  const viewerItems = items.map((item) => ({ src: item.src, alt: item.name }));

  return (
    <div className="peer-media-grid">
      {items.map((item, index) => (
        <button
          key={`${item.src}-${index}`}
          type="button"
          className="peer-media-photo"
          onClick={() => onOpenImage?.(viewerItems, index)}
        >
          <img src={item.src} alt={item.name} />
          <span>{formatMediaMeta(item.createdAt)}</span>
        </button>
      ))}
    </div>
  );
}

function VideoSection({ items }) {
  if (items.length === 0) return <EmptyMediaState label="Видео из этого диалога пока нет" />;

  return (
    <div className="peer-media-list peer-media-video-grid">
      {items.map((item, index) => (
        <article className="peer-media-card" key={`${item.src}-${index}`}>
          {item.kind === "video_note" ? (
            <VideoCircle
              src={item.src}
              title={item.name}
              mimeType={item.mimeType}
              className="profile-video-circle"
            />
          ) : (
            <video controls preload="metadata" className="peer-inline-video-player" src={item.src} />
          )}
          <div className="peer-media-card-copy">
            <strong>{item.name}</strong>
            <span>{formatMediaMeta(item.createdAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function FileSection({ items }) {
  if (items.length === 0) return <EmptyMediaState label="Документов из этого диалога пока нет" />;

  return (
    <div className="peer-media-list compact">
      {items.map((item, index) => (
        <a
          className="peer-media-file"
          key={`${item.src}-${index}`}
          href={item.src}
          download={item.name}
        >
          <span className="peer-media-file-icon">
            <FiFile />
          </span>
          <span className="peer-media-file-copy">
            <strong>{item.name}</strong>
            <small>{formatMediaMeta(item.createdAt)}</small>
          </span>
          <FiDownload className="peer-media-file-download" />
        </a>
      ))}
    </div>
  );
}

function VoiceSection({ items }) {
  if (items.length === 0) {
    return <EmptyMediaState label="Голосовых сообщений из этого диалога пока нет" />;
  }

  return (
    <div className="peer-media-list compact">
      {items.map((item, index) => (
        <article className="peer-media-voice" key={`${item.src}-${index}`}>
          <div className="peer-media-voice-copy">
            <strong>{item.name}</strong>
            <small>{formatMediaMeta(item.createdAt)}</small>
          </div>
          <audio controls preload="metadata" src={item.src} />
        </article>
      ))}
    </div>
  );
}

function EmptyMediaState({ label }) {
  return (
    <div className="peer-media-empty">
      <p>{label}</p>
    </div>
  );
}

function buildMediaCollections(messages) {
  const collections = {
    photos: [],
    videos: [],
    files: [],
    voices: [],
  };

  const relevantMessages = [...messages]
    .filter((message) => message && !message.deletedAt && message.kind !== "system")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const message of relevantMessages) {
    if (message.e2eeState === "locked") continue;

    if (message.kind === "image") {
      const items = parseImageItems(message);
      items.forEach((item, index) => {
        collections.photos.push({
          src: item.src,
          name: item.alt || `Фото ${index + 1}`,
          createdAt: message.createdAt,
        });
      });
    }

    if (message.kind === "video" || message.kind === "video_note") {
      parseAttachmentItems(message).forEach((item) => {
        collections.videos.push({
          ...item,
          kind: message.kind,
          createdAt: message.createdAt,
        });
      });
    }

    if (message.kind === "file") {
      parseAttachmentItems(message).forEach((item) => {
        collections.files.push({
          ...item,
          createdAt: message.createdAt,
        });
      });
    }

    if (message.kind === "voice") {
      parseAttachmentItems(message).forEach((item) => {
        collections.voices.push({
          ...item,
          createdAt: message.createdAt,
        });
      });
    }
  }

  return collections;
}

function formatMediaMeta(value) {
  if (!value) return "";

  return `${new Date(value).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  })} · ${formatClock(value)}`;
}
