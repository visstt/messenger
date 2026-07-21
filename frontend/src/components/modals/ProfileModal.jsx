import {
  FiAtSign,
  FiEdit3,
  FiLogOut,
  FiMail,
  FiPhone,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import Avatar from "../Avatar";
import { Button, IconButton, Modal } from "../../ui";
import { formatRuPhoneInput } from "../../utils/phoneMask";

export default function ProfileModal({
  open,
  user,
  onClose,
  onLogout,
  onEdit,
  onOpenSettings,
  onVerifyEmail,
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
        <IconButton
          aria-label="Настройки"
          title="Настройки"
          variant="ghost"
          onClick={onOpenSettings}
        >
          <FiSettings />
        </IconButton>
      </div>

      <div className="tg-profile__actions">
        <Button variant="primary" onClick={onEdit}>
          Редактировать
        </Button>
        <Button variant="ghost" onClick={onOpenSettings}>
          Настройки
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
            <div className="tg-profile__row-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{user.email}</span>
              <button
                type="button"
                onClick={onVerifyEmail}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.78rem",
                  borderRadius: "8px",
                  border: "1px solid var(--tg-theme-link-color, #2481cc)",
                  background: "transparent",
                  color: "var(--tg-theme-link-color, #2481cc)",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s ease",
                }}
                className="tg-profile__verify-btn"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
        <div className="tg-profile__row" role="listitem">
          <div className="tg-profile__row-icon">
            <FiPhone />
          </div>
          <div className="tg-profile__row-copy">
            <div className="tg-profile__row-label">Телефон</div>
            <div className="tg-profile__row-value">
              {user.phone ? formatRuPhoneInput(user.phone) : "Не указан"}
            </div>
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
