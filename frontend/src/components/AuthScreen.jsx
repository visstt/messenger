import { Button, Input, SectionTitle } from "../ui";

export default function AuthScreen({
  authMode,
  authStep,
  pendingEmail,
  resetToken,
  error,
  info,
  onModeChange,
  onStepChange,
  onSubmit,
  onVerify,
  onResendCode,
  onForgotPassword,
  onResetPassword,
}) {
  const isVerify = authStep === "verify";
  const isForgot = authStep === "forgot";
  const isReset = authStep === "reset";

  const title = isVerify
    ? "Подтверждение почты"
    : isForgot
      ? "Восстановление пароля"
      : isReset
        ? "Новый пароль"
        : authMode === "login"
          ? "Вход"
          : "Регистрация";

  return (
    <div className="tg-auth">
      <div className="tg-auth-card">
        <SectionTitle eyebrow="Signal" title={title} />

        {!isVerify && !isForgot && !isReset && (
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
        )}

        {isVerify && (
          <div className="tg-auth-hint">
            <p>
              Мы отправили код на <strong>{pendingEmail}</strong>
            </p>
            <p>Введите 6 цифр из письма, чтобы завершить регистрацию.</p>
          </div>
        )}

        {isForgot && (
          <div className="tg-auth-hint">
            <p>Укажите почту аккаунта — мы отправим ссылку для сброса пароля.</p>
          </div>
        )}

        {isReset && (
          <div className="tg-auth-hint">
            <p>Придумайте новый пароль (не менее 8 символов).</p>
          </div>
        )}

        {isVerify ? (
          <form
            className="tg-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              onVerify?.({
                email: pendingEmail,
                code: formData.get("code"),
              });
            }}
          >
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Код из письма"
              maxLength={6}
              required
            />
            <Button type="submit">Подтвердить</Button>
            <Button type="button" variant="ghost" onClick={() => onResendCode?.(pendingEmail)}>
              Отправить код снова
            </Button>
            <Button type="button" variant="ghost" onClick={() => onStepChange("form")}>
              Назад
            </Button>
          </form>
        ) : isForgot ? (
          <form
            className="tg-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              onForgotPassword?.({ email: formData.get("email") });
            }}
          >
            <Input name="email" type="email" placeholder="Почта" required autoComplete="email" />
            <Button type="submit">Отправить ссылку</Button>
            <Button type="button" variant="ghost" onClick={() => onStepChange("form")}>
              Назад ко входу
            </Button>
          </form>
        ) : isReset ? (
          <form
            className="tg-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              onResetPassword?.({
                token: resetToken,
                password: formData.get("password"),
                passwordConfirm: formData.get("passwordConfirm"),
              });
            }}
          >
            <Input name="password" type="password" placeholder="Новый пароль" required minLength={8} />
            <Input
              name="passwordConfirm"
              type="password"
              placeholder="Повторите пароль"
              required
              minLength={8}
            />
            <Button type="submit">Сохранить пароль</Button>
            <Button type="button" variant="ghost" onClick={() => onStepChange("form")}>
              Назад ко входу
            </Button>
          </form>
        ) : (
          <form className="tg-auth-form" onSubmit={onSubmit}>
            {authMode === "register" && (
              <>
                <Input name="name" placeholder="Имя" required />
                <Input
                  name="username"
                  placeholder="Имя пользователя (латиница, цифры, _)"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_]{3,32}"
                  title="3–32 символа: латинские буквы, цифры, подчёркивание, без пробелов"
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
            {authMode === "login" && (
              <button type="button" className="tg-auth-link" onClick={() => onStepChange("forgot")}>
                Забыли пароль?
              </button>
            )}
            <Button type="submit">{authMode === "login" ? "Войти" : "Создать аккаунт"}</Button>
          </form>
        )}

        {info && <div className="tg-auth-info">{info}</div>}
        {error && <div className="tg-auth-error">{error}</div>}
      </div>
    </div>
  );
}
