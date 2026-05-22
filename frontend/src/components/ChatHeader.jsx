import { useEffect, useState } from "react";
import { FiChevronLeft, FiPhone, FiVideo } from "react-icons/fi";
import Avatar from "./Avatar";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../utils/chats";

export default function ChatHeader({
  chat,
  activeTyping,
  loading,
  onOpenProfile,
  onStartCall,
  onBack,
}) {
  const showPresenceTick = chat?.kind === "private" && chat?.peer?.id && !activeTyping;
  const [, setPresenceTick] = useState(0);

  useEffect(() => {
    if (!showPresenceTick) return undefined;
    const timer = window.setInterval(() => setPresenceTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, [showPresenceTick, chat?.peer?.online, chat?.peer?.lastSeenAt]);

  const subtitle = activeTyping ? "печатает..." : getChatSubtitle(chat);
  const peerOnline = chat?.kind === "private" && Boolean(chat?.peer?.online);

  return (
    <header className="chat-header">
      <div className="chat-header-shell">
        <div className="chat-header-main">
          {onBack && (
            <button
              type="button"
              className="ghost-button chat-back-button"
              onClick={onBack}
              aria-label="Назад к списку чатов"
            >
              <FiChevronLeft aria-hidden />
            </button>
          )}

          <button type="button" className="chat-header-trigger" onClick={onOpenProfile}>
            <Avatar user={getChatAvatar(chat)} showOnline={peerOnline} />
            <div className="chat-title-block">
              <h3>{getChatTitle(chat)}</h3>
              <p className={peerOnline ? "chat-presence chat-presence--online" : "chat-presence"}>
                {subtitle}
              </p>
            </div>
          </button>
        </div>

        <div className="chat-header-side">
          <button
            type="button"
            className="header-action-button"
            onClick={() => onStartCall?.("audio")}
            aria-label="Начать аудиозвонок"
            title="Аудиозвонок"
          >
            <FiPhone />
          </button>
          <button
            type="button"
            className="header-action-button"
            onClick={() => onStartCall?.("video")}
            aria-label="Начать видеозвонок"
            title="Видеозвонок"
          >
            <FiVideo />
          </button>
          {loading && <span className="status-pill">обновление...</span>}
        </div>
      </div>
    </header>
  );
}
