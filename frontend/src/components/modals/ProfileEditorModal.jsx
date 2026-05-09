import { FiUpload, FiX } from "react-icons/fi";
import Avatar from "../Avatar";

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
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card profile-editor"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Редактирование профиля</h3>
          <button className="ghost-button" type="button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="avatar-upload-row">
          <Avatar user={draft} />
          <label className="ghost-button avatar-upload-button">
            <FiUpload />
            Загрузить аватар
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

        <input
          placeholder="Имя"
          value={draft.name}
          onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          placeholder="Имя пользователя"
          value={draft.username}
          onChange={(event) => onChange((prev) => ({ ...prev, username: event.target.value }))}
        />
        <textarea
          rows="4"
          placeholder="О себе"
          value={draft.bio}
          onChange={(event) => onChange((prev) => ({ ...prev, bio: event.target.value }))}
        />
        <button className="primary-button" type="submit">
          Сохранить
        </button>
      </form>
    </div>
  );
}
