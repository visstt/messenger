import { useEffect, useMemo } from "react";
import { FiCamera, FiCheck, FiUsers, FiX } from "react-icons/fi";
import Avatar from "../Avatar";
import { Button, Input, Modal } from "../../ui";

export default function GroupChatModal({
  open,
  title,
  query,
  results,
  selectedUsers,
  avatarFile,
  onClose,
  onTitleChange,
  onQueryChange,
  onAvatarChange,
  onToggleUser,
  onCreate,
}) {
  const selectedIds = new Set(selectedUsers.map((user) => user.id));
  const avatarPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile]
  );

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview]
  );

  if (!open) return null;

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
          <span>Аватар группы</span>
          <div className="tg-group-avatar-row">
            <div className="tg-group-avatar-preview" aria-hidden>
              {avatarFile ? (
                <img src={avatarPreview} alt="Предпросмотр аватара группы" />
              ) : (
                <FiUsers />
              )}
            </div>
            <label className="tg-group-avatar-picker">
              <FiCamera />
              <span>{avatarFile ? "Сменить фото" : "Загрузить фото"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onAvatarChange(event.target.files?.[0] || null)}
              />
            </label>
            {avatarFile && (
              <button
                type="button"
                className="tg-group-avatar-clear"
                onClick={() => onAvatarChange(null)}
              >
                Убрать
              </button>
            )}
          </div>
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
