import { FiChevronLeft, FiLock } from "react-icons/fi";
import Avatar from "./Avatar";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../utils/chats";

export default function ChatHeader({
  chat,
  activeTyping,
  loading,
  securityState,
  onOpenE2EE,
  onOpenProfile,
  onBack,
}) {
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
              <FiChevronLeft />
            </button>
          )}

          <button type="button" className="chat-header-trigger" onClick={onOpenProfile}>
            <Avatar user={getChatAvatar(chat)} />
            <div className="chat-title-block">
              <h3>{getChatTitle(chat)}</h3>
              <p>{activeTyping ? "печатает..." : getChatSubtitle(chat)}</p>
            </div>
          </button>
        </div>

        <div className="chat-header-side">
          <button
            type="button"
            className="status-pill e2ee-trigger"
            onClick={onOpenE2EE}
            aria-label="Настройки сквозного шифрования"
            title={securityState?.headerLabel || "E2EE"}
          >
            <FiLock />
            <span>{securityState?.headerLabel || "E2EE"}</span>
          </button>
          <span className="status-pill">
            {chat?.kind === "group" ? "групповой чат" : "личный диалог"}
          </span>
          {loading && <span className="status-pill">обновление...</span>}
        </div>
      </div>
    </header>
  );
}
