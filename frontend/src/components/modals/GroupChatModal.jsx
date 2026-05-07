import { FiCheck, FiUsers, FiX } from "react-icons/fi";
import Avatar from "../Avatar";

export default function GroupChatModal({
  open,
  title,
  query,
  results,
  selectedUsers,
  onClose,
  onTitleChange,
  onQueryChange,
  onToggleUser,
  onCreate,
}) {
  if (!open) return null;

  const selectedIds = new Set(selectedUsers.map((user) => user.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card group-chat-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Новая группа</p>
            <h3>Соберите чат</h3>
          </div>
          <button className="ghost-button profile-close" type="button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <label className="group-field">
          <span>Название</span>
          <input
            autoFocus
            placeholder="Например: Команда проекта"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>

        <label className="group-field">
          <span>Участники</span>
          <input
            placeholder="Поиск по имени, username или почте"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        {selectedUsers.length > 0 && (
          <div className="selected-users">
            {selectedUsers.map((user) => (
              <button
                type="button"
                className="selected-user-chip"
                key={user.id}
                onClick={() => onToggleUser(user)}
              >
                {user.name}
                <FiX />
              </button>
            ))}
          </div>
        )}

        <div className="search-results group-results">
          {results.map((user) => {
            const selected = selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                type="button"
                className={`search-row ${selected ? "selected" : ""}`}
                onClick={() => onToggleUser(user)}
              >
                <Avatar user={user} />
                <div>
                  <strong>{user.name}</strong>
                  <p>@{user.username}</p>
                </div>
                <span className="group-select-indicator">
                  {selected ? <FiCheck /> : <FiUsers />}
                </span>
              </button>
            );
          })}
        </div>

        <button className="primary-button" type="button" onClick={onCreate}>
          Создать группу
        </button>
      </div>
    </div>
  );
}
