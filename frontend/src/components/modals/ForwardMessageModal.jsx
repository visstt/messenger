import { useMemo, useState } from "react";
import Avatar from "../Avatar";
import { getChatSubtitle, getChatTitle } from "../../utils/chats";

export default function ForwardMessageModal({
  open,
  chats,
  activeChatId,
  onClose,
  onForward,
}) {
  const [query, setQuery] = useState("");

  const filteredChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = chats.filter((chat) => chat.id !== activeChatId);

    if (!normalized) return source;

    return source.filter((chat) => {
      const haystack = [
        getChatTitle(chat),
        getChatSubtitle(chat),
        chat.peer?.name,
        chat.peer?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [activeChatId, chats, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Переслать сообщение</h3>
          <button className="ghost-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <input
          className="modal-search"
          autoFocus
          placeholder="Найти чат"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="search-results">
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              className="search-row"
              type="button"
              onClick={() => onForward(chat.id)}
            >
              <Avatar
                user={
                  chat.peer?.id
                    ? chat.peer
                    : { name: getChatTitle(chat), avatarUrl: chat.avatarUrl }
                }
              />
              <div>
                <strong>{getChatTitle(chat)}</strong>
                <p>{getChatSubtitle(chat)}</p>
              </div>
            </button>
          ))}
          {filteredChats.length === 0 && (
            <div className="empty-card compact">
              <h3>Чаты не найдены</h3>
              <p>Выберите другой запрос или сначала создайте нужный диалог.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
