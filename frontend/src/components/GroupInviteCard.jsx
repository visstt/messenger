import { FiLink, FiUsers } from "react-icons/fi";
import { Button } from "../ui";

export default function GroupInviteCard({ token, joining, onJoin }) {
  if (!token) return null;

  return (
    <div className="group-invite-card" onClick={(event) => event.stopPropagation()}>
      <div className="group-invite-card__icon" aria-hidden>
        <FiUsers />
      </div>
      <div className="group-invite-card__copy">
        <span className="group-invite-card__eyebrow">
          <FiLink />
          Приглашение
        </span>
        <strong className="group-invite-card__title">Вступить в группу</strong>
        <p className="group-invite-card__hint">
          Это ссылка из мессенджера. Нажмите, чтобы открыть чат и присоединиться.
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        className="group-invite-card__action"
        disabled={joining}
        onClick={() => onJoin?.(token)}
      >
        {joining ? "Подключаем..." : "Вступить"}
      </Button>
    </div>
  );
}
