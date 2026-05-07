import Avatar from "../Avatar";

export default function SearchModal({
  open,
  query,
  results,
  onClose,
  onQueryChange,
  onStartChat,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Выберите собеседника</h3>
          <button className="ghost-button" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <input
          className="modal-search"
          autoFocus
          placeholder="Поиск по имени, username или почте"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="search-results">
          {results.map((user) => (
            <button key={user.id} className="search-row" onClick={() => onStartChat(user.id)}>
              <Avatar user={user} />
              <div>
                <strong>{user.name}</strong>
                <p>@{user.username}</p>
              </div>
            </button>
          ))}
          {query && results.length === 0 && (
            <div className="empty-card compact">
              <h3>Ничего не найдено</h3>
              <p>Попробуйте `alice`, `bob` или зарегистрируйте второй аккаунт.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
