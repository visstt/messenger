import { FiLock } from "react-icons/fi";

export default function E2EEModal({ open, mode, onClose, onConfirm }) {
  if (!open) return null;

  const isEnabled = mode === "enabled";
  const isPending = mode === "pending";
  const isDeviceError = mode === "device-error";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card e2ee-modal" onClick={(event) => event.stopPropagation()}>
        <div className="e2ee-modal-hero">
          <span className="e2ee-modal-lock">
            <FiLock />
          </span>
          <div className="confirm-modal-copy">
            <h3>{isEnabled ? "Сквозное шифрование включено" : "Включить сквозное шифрование?"}</h3>
            <p>
              {isEnabled
                ? "Сообщения в этом чате уже шифруются на устройстве отправителя и доступны только участникам диалога."
                : "После включения E2EE защищенные сообщения будут шифроваться на ваших устройствах. Чтобы это заработало для всех, вы и собеседник должны создать ключи. Это происходит автоматически после первого обычного входа и общения в приложении."}
            </p>
          </div>
        </div>

        <div className="e2ee-modal-facts">
          <div className="e2ee-fact">
            <strong>Что изменится</strong>
            <span>Новые защищенные сообщения будут недоступны серверу и третьим лицам.</span>
          </div>
          <div className="e2ee-fact">
            <strong>Если ключей пока нет</strong>
            <span>Обычные сообщения останутся доступны, а шифрование включится, как только оба участника будут готовы.</span>
          </div>
          {isPending && (
            <div className="e2ee-fact">
              <strong>Сейчас состояние</strong>
              <span>Шифрование уже запрошено для этого чата. Ждем, пока у всех участников появятся ключи.</span>
            </div>
          )}
          {isDeviceError && (
            <div className="e2ee-fact">
              <strong>Нужно внимание</strong>
              <span>На этом устройстве пока нет локального ключа или он не совпадает с ключом аккаунта.</span>
            </div>
          )}
        </div>

        <div className="confirm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Закрыть
          </button>
          {!isEnabled && (
            <button type="button" className="primary-button" onClick={onConfirm}>
              Включить E2EE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
