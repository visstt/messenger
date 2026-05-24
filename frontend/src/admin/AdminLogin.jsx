import { useEffect, useState } from "react";
import { adminApi } from "./adminApi";
import loginStyles from "./AdminLogin.module.css";
import shared from "./shared.module.css";

export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then((data) => {
        if (!cancelled) onSuccess(data.admin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onSuccess]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await adminApi.login({ username, password });
      onSuccess(data.admin);
    } catch (err) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={loginStyles.screen}>
      <div className={loginStyles.card}>
        <h1 className={loginStyles.title}>Админ-панель</h1>
        <p className={loginStyles.subtitle}>Вход для администраторов мессенджера</p>
        {error ? <div className={shared.alertError}>{error}</div> : null}
        <form className={loginStyles.form} onSubmit={handleSubmit}>
          <div className={shared.field}>
            <label className={shared.label} htmlFor="admin-username">
              Логин
            </label>
            <input
              id="admin-username"
              className={shared.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className={shared.field}>
            <label className={shared.label} htmlFor="admin-password">
              Пароль
            </label>
            <input
              id="admin-password"
              type="password"
              className={shared.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className={`${shared.btnPrimary} ${loginStyles.submit}`}
            disabled={loading}
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
