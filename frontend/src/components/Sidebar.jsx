import Avatar from "./Avatar";
import { getChatAvatar, getChatTitle } from "../utils/chats";
import { renderPreview } from "../utils/messages";
import { Button, IconButton, Input, SectionTitle } from "../ui";
import { FiSearch, FiUsers } from "react-icons/fi";

export default function Sidebar({
  currentUser,
  chats,
  activeChatId,
  error,
  onOpenProfile,
  onOpenSearch,
  onOpenGroup,
  onOpenChat,
}) {
  return (
    <aside className="tg-sidebar">
      <div className="tg-sidebar__top">
        <SectionTitle
          eyebrow="Signal"
          title="Чаты"
          right={
            <div className="tg-sidebar__top-actions">
              <IconButton aria-label="Поиск" title="Найти" onClick={onOpenSearch}>
                <FiSearch />
              </IconButton>
              <IconButton aria-label="Новая группа" title="Новая группа" onClick={onOpenGroup}>
                <FiUsers />
              </IconButton>
            </div>
          }
        />
        <div className="tg-sidebar__me">
          <Avatar user={currentUser} />
          <div className="tg-sidebar__me-copy">
            <div className="tg-sidebar__me-name">{currentUser.name}</div>
            <div className="tg-sidebar__me-handle">@{currentUser.username}</div>
          </div>
          <Button className="tg-sidebar__profile" variant="ghost" size="sm" onClick={onOpenProfile}>
            Профиль
          </Button>
        </div>
        <div className="tg-sidebar__search">
          <Input placeholder="Поиск" aria-label="Поиск" />
        </div>
      </div>

      <>
        {error && <div className="tg-inline-error">{error}</div>}
        <div className="tg-dialogs">
          {chats.length === 0 && (
            <div className="tg-empty">
              <div className="tg-empty__title">Чатов пока нет</div>
              <div className="tg-empty__text">
                Нажмите “Новый чат” или “Группа”, чтобы начать переписку.
              </div>
            </div>
          )}
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`tg-dialog ${activeChatId === chat.id ? "active" : ""}`}
              onClick={() => onOpenChat(chat.id)}
              type="button"
            >
              <Avatar user={getChatAvatar(chat)} />
              <div className="tg-dialog__body">
                <div className="tg-dialog__row">
                  <div className="tg-dialog__title">{getChatTitle(chat)}</div>
                  <div className="tg-dialog__time">
                    {new Date(chat.lastMessage?.createdAt || chat.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="tg-dialog__row tg-dialog__row-sub">
                  <div className="tg-dialog__preview">{renderPreview(chat.lastMessage)}</div>
                  {chat.unreadCount > 0 && <div className="tg-badge">{chat.unreadCount}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </>
    </aside>
  );
}
