import { useState } from "react";
import { Button, Input, PasswordInput, SectionTitle } from "../ui";

export default function AuthScreen({
  authMode,
  error,
  info,
  verifyEmail,
  verifyStep,
  resetEmail,
  onModeChange,
  onSubmit,
  onSendVerifyCode,
}) {
  const [sending, setSending] = useState(false);
  const [sendInfo, setSendInfo] = useState("");

  const titleByMode = {
    login: "Вход",
    register: "Регистрация",
    verify: "Подтверждение почты",
    forgot: "Восстановление пароля",
    reset: "Новый пароль",
  };
  const title = titleByMode[authMode] || "Вход";

  const showAuthTabs = authMode === "login" || authMode === "register";
  const verifyCodeStep = verifyStep === "code";

  async function handleSendCode(event) {
    event.preventDefault();
    if (!onSendVerifyCode || sending) return;
    const form = event.currentTarget.closest("form");
    const emailInput = form?.querySelector('input[name="email"]');
    const email = String(emailInput?.value || verifyEmail || "").trim();
    if (!email) {
      setSendInfo("Укажите почту");
      return;
    }
    setSendInfo("");
    setSending(true);
    try {
      await onSendVerifyCode(email);
    } catch (err) {
      setSendInfo(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="tg-auth">
      <div className="tg-auth-card">
        <SectionTitle eyebrow="Signal" title={title} />

        {showAuthTabs && (
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

        <form className="tg-auth-form" onSubmit={onSubmit}>
          {authMode === "verify" && (
            <>
              <Input
                name="email"
                type="email"
                placeholder="Почта"
                required
                autoComplete="email"
                defaultValue={verifyEmail || ""}
                readOnly={verifyCodeStep && Boolean(verifyEmail)}
              />
              {!verifyCodeStep ? (
                <Button type="button" disabled={sending} onClick={handleSendCode}>
                  {sending ? "Отправляем…" : "Подтвердить почту"}
                </Button>
              ) : (
                <>
                  <Input
                    name="code"
                    placeholder="Код из письма"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <Button type="submit">Войти с кодом</Button>
                  <Button type="button" variant="ghost" disabled={sending} onClick={handleSendCode}>
                    {sending ? "Отправляем…" : "Отправить код повторно"}
                  </Button>
                </>
              )}
            </>
          )}

          {authMode === "forgot" && (
            <>
              <Input
                name="email"
                type="email"
                placeholder="Почта"
                required
                autoComplete="email"
                defaultValue={resetEmail || ""}
              />
              <Button type="submit">Отправить код</Button>
              <Button type="button" variant="ghost" onClick={() => onModeChange("login")}>
                Назад ко входу
              </Button>
            </>
          )}

          {authMode === "reset" && (
            <>
              <Input
                name="email"
                type="email"
                placeholder="Почта"
                required
                autoComplete="email"
                defaultValue={resetEmail || ""}
                readOnly={Boolean(resetEmail)}
              />
              <Input name="code" placeholder="Код из письма" required inputMode="numeric" />
              <Input
                name="newPassword"
                type="password"
                placeholder="Новый пароль"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Input
                name="confirmPassword"
                type="password"
                placeholder="Повторите пароль"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Button type="submit">Сохранить пароль</Button>
              <Button type="button" variant="ghost" onClick={() => onModeChange("login")}>
                Назад ко входу
              </Button>
            </>
          )}

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
            <>
              <Input
                name="identifier"
                placeholder="Имя пользователя или почта"
                required
                autoComplete="username"
              />
              <PasswordInput
                name="password"
                placeholder="Пароль"
                required
                autoComplete="current-password"
              />
              <Button type="submit">Войти</Button>
              <Button type="button" variant="ghost" onClick={() => onModeChange("forgot")}>
                Забыли пароль?
              </Button>
            </>
          )}

          {authMode === "register" && (
            <>
              <PasswordInput
                name="password"
                placeholder="Пароль"
                required
                autoComplete="new-password"
              />
              <Button type="submit">Создать аккаунт</Button>
            </>
          )}
        </form>

        {authMode === "verify" && !verifyCodeStep && (
          <div className="tg-auth-info">
            <p style={{ margin: 0 }}>
              Укажите почту и нажмите «Подтвердить почту» — мы отправим код для завершения
              регистрации.
            </p>
            <Button type="button" variant="ghost" onClick={() => onModeChange("login")}>
              Уже подтвердили? Войти
            </Button>
          </div>
        )}

        {authMode === "verify" && verifyCodeStep && (
          <div className="tg-auth-info">
            <p style={{ margin: 0 }}>Введите 6-значный код из письма.</p>
            <Button type="button" variant="ghost" onClick={() => onModeChange("login")}>
              Уже подтвердили? Войти
            </Button>
          </div>
        )}

        {authMode === "forgot" && (
          <div className="tg-auth-info">
            <p style={{ margin: 0 }}>
              Введите почту аккаунта — мы отправим код для сброса пароля, если такой адрес
              зарегистрирован.
            </p>
          </div>
        )}

        {sendInfo && <div className="tg-auth-error">{sendInfo}</div>}
        {info && <div className="tg-auth-info">{info}</div>}
        {error && <div className="tg-auth-error">{error}</div>}
      </div>
    </div>
  );
}
