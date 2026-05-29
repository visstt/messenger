import { useState } from "react";
import { FiDownload, FiMoon, FiShare2, FiSun } from "react-icons/fi";
import { Button, Modal } from "../../ui";
import { api } from "../../lib/api";
import { copyMessengerInvite } from "../../utils/messengerInvite";

const DESKTOP_INSTALLER_URL = "/downloads/Signal-Desktop-Setup.exe";

function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.messengerDesktop?.isDesktop);
}

export default function SettingsModal({ open, theme, onClose, onToggleTheme, onInviteCopied }) {
  const [inviteCopying, setInviteCopying] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordOk, setPasswordOk] = useState("");

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

  async function handlePasswordChange(event) {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordError("");
    setPasswordOk("");

    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Пароли не совпадают");
      return;
    }
    if ((newPassword || "").length < 8) {
      setPasswordError("Пароль должен быть не короче 8 символов");
      return;
    }

    setPasswordBusy(true);
    try {
      await api.updateMyPassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setPasswordOk("Пароль обновлён");
    } catch (err) {
      setPasswordError(err.message || "Не удалось обновить пароль");
    } finally {
      setPasswordBusy(false);
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
        <div className="tg-settings__section-title">Пароль</div>
        <form className="tg-settings__password" onSubmit={handlePasswordChange}>
          <input
            className="tg-input"
            type="password"
            placeholder="Текущий пароль"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            className="tg-input"
            type="password"
            placeholder="Новый пароль (мин. 8 символов)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
          <input
            className="tg-input"
            type="password"
            placeholder="Повторите новый пароль"
            autoComplete="new-password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            required
            minLength={8}
          />
          {passwordError ? <div className="tg-auth-error">{passwordError}</div> : null}
          {passwordOk ? <div className="tg-auth-info">{passwordOk}</div> : null}
          <div className="tg-settings__footer" style={{ padding: 0, marginTop: 10 }}>
            <Button variant="primary" type="submit" disabled={passwordBusy}>
              {passwordBusy ? "Сохраняем..." : "Обновить пароль"}
            </Button>
          </div>
        </form>
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
