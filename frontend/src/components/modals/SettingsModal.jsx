import { FiDownload, FiMoon, FiSun } from "react-icons/fi";
import { Button, Modal } from "../../ui";

const DESKTOP_INSTALLER_URL = "/downloads/Signal-Desktop-Setup.exe";

function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.messengerDesktop?.isDesktop);
}

export default function SettingsModal({
  open,
  theme,
  userEmail,
  onClose,
  onToggleTheme,
  onRequestPasswordReset,
}) {
  if (!open) return null;

  const isDark = theme === "dark";

  return (
    <Modal open={open} onClose={onClose} title="Настройки" contentClassName="tg-settings">
      <div className="tg-settings__section">
        <div className="tg-settings__section-title">Оформление</div>
        <div className="tg-settings__theme" role="group" aria-label="Тема приложения">
          <button
            type="button"
            className={`tg-settings__theme-btn ${!isDark ? "active" : ""}`}
            onClick={() => {
              if (isDark) onToggleTheme();
            }}
          >
            <FiSun />
            <span>Светлая</span>
          </button>
          <button
            type="button"
            className={`tg-settings__theme-btn ${isDark ? "active" : ""}`}
            onClick={() => {
              if (!isDark) onToggleTheme();
            }}
          >
            <FiMoon />
            <span>Тёмная</span>
          </button>
        </div>
      </div>

      <div className="tg-settings__section">
        <div className="tg-settings__section-title">Безопасность</div>
        <div className="tg-settings__security-card">
          <div className="tg-settings__security-copy">
            <strong>Восстановление пароля</strong>
            <p>
              {userEmail
                ? `Отправим ссылку для сброса пароля на ${userEmail}`
                : "Отправим ссылку для сброса пароля на почту аккаунта"}
            </p>
          </div>
          <Button type="button" variant="primary" onClick={onRequestPasswordReset}>
            Сбросить пароль
          </Button>
        </div>
      </div>

      {!isDesktopApp() && (
        <div className="tg-settings__section">
          <div className="tg-settings__section-title">Приложение</div>
          <div className="tg-settings__desktop-card">
            <div className="tg-settings__desktop-icon" aria-hidden>
              <img src="/pwa-192.svg" alt="" width={48} height={48} />
            </div>
            <div className="tg-settings__desktop-copy">
              <strong>Signal для Windows</strong>
              <p>Установите десктоп-клиент: трей, уведомления снизу экрана, быстрый доступ к чатам.</p>
            </div>
            <a
              className="tg-settings__download-btn"
              href={DESKTOP_INSTALLER_URL}
              download="Signal-Desktop-Setup.exe"
            >
              <FiDownload />
              <span>Скачать для ПК</span>
            </a>
          </div>
        </div>
      )}

      <div className="tg-settings__footer">
        <Button variant="ghost" type="button" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  );
}
