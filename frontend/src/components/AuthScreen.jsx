import { Button, Input, SectionTitle } from "../ui";

export default function AuthScreen({
  authMode,
  error,
  info,
  onModeChange,
  onSubmit,
}) {
  const title = authMode === "login" ? "Вход" : "Регистрация";

  return (
    <div className="tg-auth">
      <div className="tg-auth-card">
        <SectionTitle eyebrow="Signal" title={title} />

        <div className="tg-auth-tabs" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            className={`tg-auth-tab ${authMode === "login" ? "active" : ""}`}
            onClick={() => onModeChange("login")}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "register"}
            className={`tg-auth-tab ${authMode === "register" ? "active" : ""}`}
            onClick={() => onModeChange("register")}
          >
            Регистрация
          </button>
        </div>

        <form className="tg-auth-form" onSubmit={onSubmit}>
          {authMode === "register" && (
            <>
              <Input name="name" placeholder="Имя" required />
              <Input
                name="username"
                placeholder="Имя пользователя"
                autoComplete="username"
                required
              />
              <Input name="email" type="email" placeholder="Почта" required autoComplete="email" />
            </>
          )}
          {authMode === "login" && (
            <Input
              name="identifier"
              placeholder="Имя пользователя или почта"
              required
              autoComplete="username"
            />
          )}
          <Input
            name="password"
            type="password"
            placeholder="Пароль"
            required
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
          />
          <Button type="submit">{authMode === "login" ? "Войти" : "Создать аккаунт"}</Button>
        </form>

        {info && <div className="tg-auth-info">{info}</div>}
        {error && <div className="tg-auth-error">{error}</div>}
      </div>
    </div>
  );
}
