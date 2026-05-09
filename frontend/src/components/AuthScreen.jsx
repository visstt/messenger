export default function AuthScreen({ authMode, error, onModeChange, onSubmit }) {
  return (
    <div className="auth-shell">
      <div className="auth-ambient auth-ambient-left" />
      <div className="auth-ambient auth-ambient-right" />
      <div className="auth-card">
        <h1>Чат</h1>
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
      </div>
    </div>
  );
}
