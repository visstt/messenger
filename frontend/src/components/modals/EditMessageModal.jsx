export default function EditMessageModal({ open, value, onClose, onChange, onSubmit }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card edit-message-modal" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-modal-copy">
          <h3>Редактировать сообщение</h3>
          <p>Изменения сразу появятся в текущем диалоге.</p>
        </div>
        <textarea
          className="edit-message-input"
          rows="5"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Введите новый текст"
        />
        <div className="confirm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="primary-button" onClick={onSubmit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
