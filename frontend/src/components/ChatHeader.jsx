import Avatar from "./Avatar";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../utils/chats";

export default function ChatHeader({ chat, activeTyping, loading, onOpenProfile }) {
  return (
    <header className="chat-header">
      <div className="chat-header-shell">
        <button type="button" className="chat-header-trigger" onClick={onOpenProfile}>
          <Avatar user={getChatAvatar(chat)} />
          <div className="chat-title-block">
            <h3>{getChatTitle(chat)}</h3>
            <p>{activeTyping ? "печатает..." : getChatSubtitle(chat)}</p>
          </div>
        </button>

        <div className="chat-header-side">
          <span className="status-pill">
            {chat?.kind === "group" ? "групповой чат" : "личный диалог"}
          </span>
          {loading && <span className="status-pill">обновление...</span>}
        </div>
      </div>
    </header>
  );
}
