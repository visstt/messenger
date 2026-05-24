import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "./adminApi";
import { PhoneInput } from "../ui";
import { formatRuPhoneInput } from "../utils/phoneMask";
import shared from "./shared.module.css";
import styles from "./UserEditPage.module.css";

function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function UserEditPage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    bio: "",
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApi
      .getUser(userId)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setForm({
          name: data.user.name || "",
          username: data.user.username || "",
          email: data.user.email || "",
          phone: formatRuPhoneInput(data.user.phone || ""),
          bio: data.user.bio || "",
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить пользователя");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await adminApi.updateUser(userId, form);
      setUser(data.user);
      setSuccess("Изменения сохранены");
    } catch (err) {
      setError(err.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setPasswordSaving(true);
    setError("");
    setPasswordSuccess("");
    try {
      await adminApi.updateUserPassword(userId, password);
      setPassword("");
      setPasswordSuccess("Пароль обновлён");
    } catch (err) {
      setError(err.message || "Не удалось сменить пароль");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return <p className={shared.muted}>Загрузка…</p>;
  }

  if (!user) {
    return <div className={shared.alertError}>{error || "Пользователь не найден"}</div>;
  }

  return (
    <div className={`${shared.page} ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.profile}>
          <div className={styles.avatar} aria-hidden>
            {initials(user.name)}
          </div>
          <div className={styles.profileText}>
            <h1>{user.name}</h1>
            <p>@{user.username}</p>
          </div>
        </div>
        <Link to={`/users/${userId}/chats`} className={shared.btnSecondary}>
          Переписки
        </Link>
      </header>

      {error ? <div className={shared.alertError}>{error}</div> : null}
      {success ? <div className={shared.alertSuccess}>{success}</div> : null}

      <div className={styles.stack}>
        <form className={shared.card} onSubmit={handleSave}>
          <h2 className={shared.cardTitle}>Профиль</h2>
          <div className={styles.formGrid}>
            <div className={shared.field}>
              <label className={shared.label}>Имя</label>
              <input
                className={shared.input}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className={shared.field}>
              <label className={shared.label}>Логин</label>
              <input
                className={shared.input}
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
                required
              />
            </div>
            <div className={shared.field}>
              <label className={shared.label}>Email</label>
              <input
                type="email"
                className={shared.input}
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
            <div className={shared.field}>
              <label className={shared.label}>Телефон</label>
              <PhoneInput
                className={shared.input}
                value={form.phone}
                onValueChange={(phone) => updateField("phone", phone)}
              />
            </div>
            <div className={`${shared.field} ${styles.full}`}>
              <label className={shared.label}>О себе</label>
              <textarea
                className={shared.textarea}
                value={form.bio}
                onChange={(e) => updateField("bio", e.target.value)}
              />
            </div>
          </div>
          <div className={shared.formActions}>
            <button type="submit" className={shared.btnPrimary} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
            <Link to="/users" className={shared.btnSecondary}>
              Назад к списку
            </Link>
          </div>
        </form>

        <form className={shared.card} onSubmit={handlePasswordSave}>
          <h2 className={shared.cardTitle}>Смена пароля</h2>
          {passwordSuccess ? (
            <div className={shared.alertSuccess}>{passwordSuccess}</div>
          ) : null}
          <div className={shared.field}>
            <label className={shared.label}>Новый пароль (мин. 8 символов)</label>
            <input
              type="password"
              className={shared.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className={shared.formActions}>
            <button type="submit" className={shared.btnPrimary} disabled={passwordSaving}>
              {passwordSaving ? "Сохранение…" : "Обновить пароль"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
