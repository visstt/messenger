import {
  FiAtSign,
  FiEdit3,
  FiLogOut,
  FiMail,
  FiMoon,
  FiSettings,
  FiSun,
  FiUser,
} from "react-icons/fi";
import Avatar from "../Avatar";
import { Button, IconButton, Modal } from "../../ui";

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
    <Modal
      open={open}
      onClose={onClose}
      title="Профиль"
      contentClassName="tg-profile"
    >
      <div className="tg-profile__hero">
        <Avatar user={user} />
        <div className="tg-profile__hero-copy">
          <div className="tg-profile__name">{user.name}</div>
          <div className="tg-profile__handle">@{user.username}</div>
          <div className="tg-profile__bio">
            {user.bio || "Добавьте короткое описание, чтобы профиль выглядел живее."}
          </div>
        </div>
        <IconButton aria-label="Настройки" title="Настройки" variant="ghost">
          <FiSettings />
        </IconButton>
      </div>

      <div className="tg-profile__actions">
        <Button variant="primary" onClick={onEdit}>
          Редактировать
        </Button>
        <Button variant="ghost" onClick={onToggleTheme}>
          {theme === "light" ? "Тёмная тема" : "Светлая тема"}
        </Button>
      </div>

      <div className="tg-profile__list" role="list">
        <div className="tg-profile__row" role="listitem">
          <div className="tg-profile__row-icon">
            <FiUser />
          </div>
          <div className="tg-profile__row-copy">
            <div className="tg-profile__row-label">Имя</div>
            <div className="tg-profile__row-value">{user.name}</div>
          </div>
        </div>
        <div className="tg-profile__row" role="listitem">
          <div className="tg-profile__row-icon">
            <FiAtSign />
          </div>
          <div className="tg-profile__row-copy">
            <div className="tg-profile__row-label">Username</div>
            <div className="tg-profile__row-value">@{user.username}</div>
          </div>
        </div>
        <div className="tg-profile__row" role="listitem">
          <div className="tg-profile__row-icon">
            <FiMail />
          </div>
          <div className="tg-profile__row-copy">
            <div className="tg-profile__row-label">Почта</div>
            <div className="tg-profile__row-value">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="tg-profile__footer">
        <Button variant="danger" onClick={onLogout}>
          Выйти
        </Button>
      </div>
    </Modal>
  );
}
