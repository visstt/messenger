export default function AuthScreen({ authMode, error, onModeChange, onSubmit }) {
  return (
    <div className="auth-shell">
      <div className="auth-ambient auth-ambient-left" />
      <div className="auth-ambient auth-ambient-right" />
      <div className="auth-card">
        <p className="eyebrow">React + Go + Postgres MVP</p>
        <h1>Чат MVP</h1>
        <p className="auth-copy">
          Личные диалоги, обновления в реальном времени, поиск пользователей,
          медиа-сообщения и компактный интерфейс мессенджера.
        </p>
        <div className="auth-switcher">
          <button
            type="button"
            className={authMode === "login" ? "active" : ""}
            onClick={() => onModeChange("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className={authMode === "register" ? "active" : ""}
            onClick={() => onModeChange("register")}
          >
            Регистрация
          </button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {authMode === "register" && (
            <>
              <input name="name" placeholder="Имя" required />
              <input name="username" placeholder="Имя пользователя" required />
              <input name="email" type="email" placeholder="Почта" required />
            </>
          )}
          {authMode === "login" && (
            <input name="identifier" placeholder="Имя пользователя или почта" required />
          )}
          <input name="password" type="password" placeholder="Пароль" required />
          <button className="primary-button" type="submit">
            {authMode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        <div className="demo-box">
          <strong>Демо-аккаунты</strong>
          <span>`alice / alice12345`</span>
          <span>`bob / bob12345`</span>
        </div>
      </div>
    </div>
  );
}
