import { FiAtSign, FiEdit3, FiLogOut, FiMail, FiMoon, FiSun, FiUser, FiX } from "react-icons/fi";
import Avatar from "../Avatar";

export default function ProfileModal({
  open,
  user,
  theme,
  onClose,
  onToggleTheme,
  onLogout,
  onEdit,
}) {
  if (!open || !user) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card profile-showcase" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="ghost-button profile-close"
          onClick={onClose}
          aria-label="Закрыть профиль"
        >
          <FiX />
        </button>
        <div className="profile-hero">
          <div className="profile-hero-avatar">
            <Avatar user={user} />
          </div>
          <div className="profile-hero-copy">
            <p className="eyebrow">Ваш профиль</p>
            <h3>{user.name}</h3>
            <p>@{user.username}</p>
            <span>{user.bio || "Добавьте короткое описание, чтобы профиль выглядел живее."}</span>
          </div>
        </div>
        <div className="profile-facts">
          <div className="profile-fact">
            <FiUser />
            <div>
              <strong>Имя</strong>
              <span>{user.name}</span>
            </div>
          </div>
          <div className="profile-fact">
            <FiAtSign />
            <div>
              <strong>Username</strong>
              <span>@{user.username}</span>
            </div>
          </div>
          <div className="profile-fact">
            <FiMail />
            <div>
              <strong>Почта</strong>
              <span>{user.email}</span>
            </div>
          </div>
        </div>
        <div className="profile-showcase-actions">
          <div className="profile-utility-actions">
            <button
              className="ghost-button profile-icon-action"
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "light" ? "Включить темную тему" : "Включить светлую тему"}
              title={theme === "light" ? "Темная тема" : "Светлая тема"}
            >
              {theme === "light" ? <FiMoon /> : <FiSun />}
            </button>
            <button
              className="ghost-button profile-icon-action"
              type="button"
              onClick={onLogout}
              aria-label="Выйти"
              title="Выйти"
            >
              <FiLogOut />
            </button>
          </div>
          <button className="primary-button profile-edit-trigger" type="button" onClick={onEdit}>
            <FiEdit3 />
            <span>Редактировать</span>
          </button>
        </div>
      </div>
    </div>
  );
}
