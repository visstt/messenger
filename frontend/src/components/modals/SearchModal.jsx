import Avatar from "../Avatar";
import { Button, Input, Modal } from "../../ui";

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
    <Modal open={open} onClose={onClose} title="Выберите собеседника" contentClassName="tg-contact-picker">
      <div className="tg-contact-picker__form">
        <Input
          autoFocus
          placeholder="Поиск по имени, username или почте"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />

        <div className="tg-contact-picker__results">
          {results.map((user) => (
            <button
              key={user.id}
              className="tg-contact-picker__row"
              type="button"
              onClick={() => onStartChat(user.id)}
            >
              <Avatar user={user} />
              <div className="tg-contact-picker__copy">
                <strong>{user.name}</strong>
                <span>@{user.username}</span>
              </div>
            </button>
          ))}
          {query && results.length === 0 && (
            <div className="tg-contact-picker__empty">
              <strong>Ничего не найдено</strong>
              <span>Попробуйте другой username, имя или почту.</span>
            </div>
          )}
        </div>

        <Button type="button" variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  );
}
