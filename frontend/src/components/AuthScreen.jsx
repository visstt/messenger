import { Button, Input, SectionTitle } from "../ui";

export default function AuthScreen({ authMode, error, onModeChange, onSubmit }) {
  return (
    <div className="tg-auth">
      <div className="tg-auth-card">
        <SectionTitle eyebrow="Signal" title={authMode === "login" ? "Вход" : "Регистрация"} />
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
              <Input name="username" placeholder="Имя пользователя" required />
              <Input name="email" type="email" placeholder="Почта" required />
            </>
          )}
          {authMode === "login" && (
            <Input name="identifier" placeholder="Имя пользователя или почта" required />
          )}
          <Input name="password" type="password" placeholder="Пароль" required />
          <Button type="submit">{authMode === "login" ? "Войти" : "Создать аккаунт"}</Button>
        </form>
        {error && <div className="tg-auth-error">{error}</div>}
      </div>
    </div>
  );
}
