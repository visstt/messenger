import Avatar from "./Avatar";
import { getChatAvatar, getChatTitle } from "../utils/chats";
import { renderPreview } from "../utils/messages";

export default function Sidebar({
  currentUser,
  chats,
  activeChatId,
  activeTab,
  error,
  onTabChange,
  onOpenProfile,
  onOpenSearch,
  onOpenGroup,
  onOpenChat,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div>
          <p className="eyebrow">Вы вошли как</p>
          <h2>{currentUser.name}</h2>
          <p className="sidebar-handle">@{currentUser.username}</p>
        </div>
        <button className="ghost-button" onClick={onOpenProfile}>
          Профиль
        </button>
      </div>

      <div className="sidebar-tabs" role="tablist" aria-label="Разделы">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "chats"}
          className={`sidebar-tab ${activeTab === "chats" ? "active" : ""}`}
          onClick={() => onTabChange("chats")}
        >
          Чаты
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "calls"}
          className={`sidebar-tab ${activeTab === "calls" ? "active" : ""}`}
          onClick={() => onTabChange("calls")}
        >
          Звонки
        </button>
      </div>

      {activeTab === "chats" ? (
        <>
          <div className="sidebar-actions">
            <button className="primary-button" onClick={onOpenSearch}>
              Новый чат
            </button>
            <button className="ghost-button" onClick={onOpenGroup}>
              Группа
            </button>
          </div>

          {error && <div className="inline-error">{error}</div>}

          <div className="chat-list">
            {chats.length === 0 && (
              <div className="empty-card">
                <h3>Чатов пока нет</h3>
                <p>Откройте поиск пользователей и начните первый личный или групповой чат.</p>
              </div>
            )}

            {chats.map((chat) => (
              <button
                key={chat.id}
                className={`chat-card ${activeChatId === chat.id ? "active" : ""}`}
                onClick={() => onOpenChat(chat.id)}
              >
                <Avatar user={getChatAvatar(chat)} />
                <div className="chat-card-body">
                  <div className="chat-card-row">
                    <strong>{getChatTitle(chat)}</strong>
                    <span>
                      {new Date(chat.lastMessage?.createdAt || chat.updatedAt).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                  <div className="chat-card-row chat-card-preview">
                    <span>{renderPreview(chat.lastMessage)}</span>
                    {chat.unreadCount > 0 && <em>{chat.unreadCount}</em>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-card sidebar-placeholder">
          <h3>Звонки</h3>
          <p>Раздел подготовлен. Наполнение для звонков добавим позже.</p>
        </div>
      )}
    </aside>
  );
}
