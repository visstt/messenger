import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCamera,
  FiDownload,
  FiFile,
  FiImage,
  FiMessageSquare,
  FiMic,
  FiPhone,
  FiVideo,
} from "react-icons/fi";
import Avatar from "../Avatar";
import VideoCircle from "../VideoCircle";
import { formatClock, parseAttachmentItems, parseImageItems } from "../../utils/messages";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../../utils/chats";
import { Button, Modal } from "../../ui";

const MEDIA_TABS = [
  { id: "photos", label: "Фото", icon: FiImage },
  { id: "videos", label: "Видео", icon: FiVideo },
  { id: "files", label: "Документы", icon: FiFile },
  { id: "voices", label: "Голосовые", icon: FiMic },
];

export default function PeerProfileModal({
  open,
  chat,
  user,
  currentUserId,
  messages = [],
  onClose,
  onOpenImage,
  onUploadChatAvatar,
  onOpenUserProfile,
  onStartChat,
  onStartCall,
}) {
  const [activeTab, setActiveTab] = useState("photos");
  const [membersOpen, setMembersOpen] = useState(false);
  const uploadInputRef = useRef(null);
  const media = useMemo(() => buildMediaCollections(messages), [messages]);
  const isStandaloneUser = Boolean(user);
  const isGroup = chat?.kind === "group";
  const displayUser = user || (!isGroup ? chat?.peer : null);
  const isSelfProfile =
    displayUser && currentUserId ? Number(displayUser.id) === Number(currentUserId) : false;
  const canContact = Boolean(displayUser?.id) && !isSelfProfile;
  const memberCount = Array.isArray(chat?.participants) ? chat.participants.length : 0;
  const totalMediaCount = MEDIA_TABS.reduce((count, tab) => count + media[tab.id].length, 0);

  useEffect(() => {
    if (open) {
      setActiveTab("photos");
      setMembersOpen(false);
    }
  }, [open, chat?.id, user?.id]);

  if (!open || (!chat && !user)) return null;

  function handleToggleMembers() {
    if (!isGroup) return;
    setMembersOpen((prev) => !prev);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isGroup ? "Профиль чата" : "Профиль пользователя"}
      contentClassName="tg-peer-media tg-peer-profile"
    >
      <div className="tg-peer-media__hero">
        <Avatar user={isStandaloneUser ? displayUser : getChatAvatar(chat)} />
        <div className="tg-peer-media__hero-copy">
          <div className="tg-peer-media__title">
            {isStandaloneUser ? displayUser?.name : getChatTitle(chat)}
          </div>
          {isGroup ? (
            <button
              type="button"
              className={`tg-peer-media__subtitle-button ${membersOpen ? "active" : ""}`}
              onClick={handleToggleMembers}
            >
              {memberCount} участников
            </button>
          ) : (
            <div className="tg-peer-media__subtitle">
              {isStandaloneUser
                ? `@${displayUser?.username || ""}`
                : getChatSubtitle(chat)}
            </div>
          )}
          <div className="tg-peer-media__description">
            {isStandaloneUser
              ? displayUser?.bio || "Пользователь пока не добавил описание."
              : isGroup
              ? "Общий чат и вся история вложений."
              : "Диалог, профиль и общие медиафайлы."}
          </div>
        </div>
        {isGroup && (
          <button
            type="button"
            className="tg-peer-media__avatar-upload"
            onClick={() => uploadInputRef.current?.click()}
          >
            <FiCamera />
            <span>Аватар</span>
          </button>
        )}
        {isGroup && (
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const [file] = event.target.files || [];
              if (file) onUploadChatAvatar?.(file);
              event.target.value = "";
            }}
          />
        )}
      </div>

      {canContact && (
        <div className="tg-peer-profile__quick-actions">
          <Button variant="primary" onClick={() => onStartChat?.(displayUser.id)}>
            <FiMessageSquare />
            <span>Написать</span>
          </Button>
          <Button variant="ghost" onClick={() => onStartCall?.(displayUser.id, "audio")}>
            <FiPhone />
            <span>Аудио</span>
          </Button>
          <Button variant="ghost" onClick={() => onStartCall?.(displayUser.id, "video")}>
            <FiVideo />
            <span>Видео</span>
          </Button>
        </div>
      )}

      {isStandaloneUser && (
        <div className="tg-peer-user-fields" role="list" aria-label="Информация пользователя">
          <div className="tg-peer-user-fields__row" role="listitem">
            <span className="tg-peer-user-fields__label">Username</span>
            <strong className="tg-peer-user-fields__value">@{displayUser?.username || "-"}</strong>
          </div>
          <div className="tg-peer-user-fields__row" role="listitem">
            <span className="tg-peer-user-fields__label">Телефон</span>
            <strong className="tg-peer-user-fields__value">
              {displayUser?.phone || "Не указан"}
            </strong>
          </div>
        </div>
      )}

      {!isStandaloneUser && (
        <>
      <div className="tg-peer-profile__stats" aria-label="Статистика медиа">
        {isGroup && (
          <button
            type="button"
            className={`tg-peer-profile__stat ${membersOpen ? "active" : ""}`}
            onClick={handleToggleMembers}
          >
            <strong>{memberCount}</strong>
            <span>участников</span>
          </button>
        )}
        <button type="button" className="tg-peer-profile__stat" onClick={() => setActiveTab("photos")}>
          <strong>{messages.filter((message) => message.kind !== "system").length}</strong>
          <span>сообщений</span>
        </button>
        <button type="button" className="tg-peer-profile__stat" onClick={() => setActiveTab("photos")}>
          <strong>{totalMediaCount}</strong>
          <span>медиа</span>
        </button>
        <button type="button" className="tg-peer-profile__stat" onClick={() => setActiveTab("files")}>
          <strong>{media.files.length}</strong>
          <span>документов</span>
        </button>
      </div>

      {isGroup && membersOpen && (
        <div className="tg-peer-members" aria-label="Участники группы">
          {(chat.participants || []).length > 0 ? (
            chat.participants.map((member) => (
              <button
                key={member.id}
                type="button"
                className="tg-peer-members__item tg-peer-members__item--button"
                onClick={() => onOpenUserProfile?.(member)}
              >
                <Avatar user={member} />
                <div className="tg-peer-members__copy">
                  <strong>{member.name}</strong>
                  <span>@{member.username}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="tg-peer-members__empty">Список участников недоступен</div>
          )}
        </div>
      )}

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
        </>
      )}
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
          target="_blank"
          rel="noreferrer"
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
