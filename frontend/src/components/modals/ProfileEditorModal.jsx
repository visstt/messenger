import { FiUpload, FiX } from "react-icons/fi";
import Avatar from "../Avatar";
import { Button, Input, Modal, Textarea } from "../../ui";

export default function ProfileEditorModal({
  open,
  draft,
  onClose,
  onChange,
  onSubmit,
  onAvatarUpload,
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Редактирование профиля" contentClassName="tg-profile-editor">
      <form onSubmit={onSubmit} className="tg-profile-editor__form">
        <div className="tg-profile-editor__avatar">
          <Avatar user={draft} />
          <label className="tg-profile-editor__upload">
            <FiUpload />
            <span>Загрузить аватар</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatarUpload(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <Input
          placeholder="Имя"
          value={draft.name}
          onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
        />
        <Input
          placeholder="Имя пользователя"
          value={draft.username}
          onChange={(event) => onChange((prev) => ({ ...prev, username: event.target.value }))}
        />
        <Textarea
          rows="4"
          placeholder="О себе"
          value={draft.bio}
          onChange={(event) => onChange((prev) => ({ ...prev, bio: event.target.value }))}
        />

        <div className="tg-profile-editor__actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" type="submit">
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
