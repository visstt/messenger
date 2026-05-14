import { FiCheck, FiUsers, FiX } from "react-icons/fi";
import Avatar from "../Avatar";
import { Button, Input, Modal } from "../../ui";

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
    <Modal open={open} onClose={onClose} title="Новая группа" contentClassName="tg-group-modal">
      <div className="tg-group-modal__form">
        <label className="tg-field">
          <span>Название</span>
          <Input
            autoFocus
            placeholder="Например: Команда проекта"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>

        <label className="tg-field">
          <span>Участники</span>
          <Input
            placeholder="Поиск по имени, username или почте"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        {selectedUsers.length > 0 && (
          <div className="tg-selected-users">
            {selectedUsers.map((user) => (
              <button
                type="button"
                className="tg-selected-user"
                key={user.id}
                onClick={() => onToggleUser(user)}
              >
                <Avatar user={user} />
                <span>{user.name}</span>
                <FiX />
              </button>
            ))}
          </div>
        )}

        <div className="tg-group-results">
          {results.map((user) => {
            const selected = selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                type="button"
                className={`tg-group-user ${selected ? "selected" : ""}`}
                onClick={() => onToggleUser(user)}
              >
                <Avatar user={user} />
                <div className="tg-group-user__copy">
                  <strong>{user.name}</strong>
                  <span>@{user.username}</span>
                </div>
                <span className="tg-group-user__check">
                  {selected ? <FiCheck /> : <FiUsers />}
                </span>
              </button>
            );
          })}
        </div>

        <Button type="button" onClick={onCreate}>
          Создать группу
        </Button>
      </div>
    </Modal>
  );
}
