export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card confirm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-modal-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="confirm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
