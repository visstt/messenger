import { useState } from "react";
import { FiDownload, FiMoon, FiShare2, FiSun } from "react-icons/fi";
import { Button, Modal } from "../../ui";
import { copyMessengerInvite } from "../../utils/messengerInvite";

const DESKTOP_INSTALLER_URL = "/downloads/Signal-Desktop-Setup.exe";

function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.messengerDesktop?.isDesktop);
}

export default function SettingsModal({ open, theme, onClose, onToggleTheme, onInviteCopied }) {
  const [inviteCopying, setInviteCopying] = useState(false);

  if (!open) return null;

  const isDark = theme === "dark";

  async function handleCopyMessengerInvite() {
    if (inviteCopying) return;
    setInviteCopying(true);
    try {
      await copyMessengerInvite();
      onInviteCopied?.();
    } catch {
      onInviteCopied?.("Не удалось скопировать приглашение");
    } finally {
      setInviteCopying(false);
    }
  }

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
        <div className="tg-settings__section-title">Пригласить</div>
        <div className="tg-settings__desktop-card">
          <div className="tg-settings__desktop-icon" aria-hidden>
            <img src="/pwa-192.svg" alt="" width={48} height={48} />
          </div>
          <div className="tg-settings__desktop-copy">
            <strong>Пригласить в Signal</strong>
            <p>
              Скопируйте готовое сообщение со ссылкой и отправьте друзьям в любой чат или соцсеть.
            </p>
          </div>
          <button
            type="button"
            className="tg-settings__download-btn"
            disabled={inviteCopying}
            onClick={handleCopyMessengerInvite}
          >
            <FiShare2 />
            <span>{inviteCopying ? "Копируем..." : "Скопировать приглашение"}</span>
          </button>
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
