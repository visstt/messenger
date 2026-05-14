import { useState } from "react";
import { FiDownload, FiLock, FiUpload } from "react-icons/fi";
import QRCode from "qrcode";
import { Button, Input, Textarea } from "../../ui";
import clsx from "../../ui/utils/clsx.js";

export default function E2EEModal({
  open,
  mode,
  onClose,
  onConfirm,
  onDisable,
  onExportKey,
  onImportKey,
}) {
  const [exportPassword, setExportPassword] = useState("");
  const [exportedKey, setExportedKey] = useState("");
  const [exportedQr, setExportedQr] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("");
  const [busyAction, setBusyAction] = useState("");

  if (!open) return null;

  const isEnabled = mode === "enabled";
  const isPending = mode === "pending";
  const isDeviceError = mode === "device-error";

  async function handleExport() {
    setStatus("");
    setStatusTone("");
    setBusyAction("export");
    try {
      const payload = await onExportKey(exportPassword);
      const qr = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 220,
      });
      setExportedKey(payload);
      setExportedQr(qr);
      setStatus("Ключ экспортирован. Используйте этот текст на другом устройстве вместе с паролем.");
      setStatusTone("ok");
    } catch (error) {
      setStatus(error.message);
      setStatusTone("error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleImport() {
    setStatus("");
    setStatusTone("");
    setBusyAction("import");
    try {
      await onImportKey(importPassword, importPayload);
      setImportPassword("");
      setImportPayload("");
      setStatus("Ключ импортирован на это устройство.");
      setStatusTone("ok");
    } catch (error) {
      setStatus(error.message);
      setStatusTone("error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDisable() {
    setStatus("");
    setStatusTone("");
    setBusyAction("disable");
    try {
      await onDisable();
      setStatus("E2EE выключено для этого чата.");
      setStatusTone("ok");
    } catch (error) {
      setStatus(error.message);
      setStatusTone("error");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="modal-backdrop tg-e2ee-backdrop" onClick={onClose}>
      <div className="modal-card e2ee-modal tg-e2ee-modal" onClick={(event) => event.stopPropagation()}>
        <div className="e2ee-modal-hero">
          <span className="e2ee-modal-lock" aria-hidden="true">
            <FiLock />
          </span>
          <div className="e2ee-modal-hero-copy">
            <div className="tg-eyebrow">Сквозное шифрование</div>
            <h3 className="e2ee-modal-title">
              {isEnabled ? "Защита включена" : "Включить защиту?"}
            </h3>
            <p className="e2ee-modal-lead">
              {isEnabled
                ? "Сообщения в этом чате шифруются на устройстве отправителя и доступны только участникам диалога."
                : "После включения защищённые сообщения шифруются на ваших устройствах. Вы и собеседник должны иметь ключи — они создаются автоматически после входа."}
            </p>
          </div>
        </div>

        <div className="e2ee-modal-facts">
          <div className="e2ee-fact">
            <strong>Что изменится</strong>
            <span>Новые защищённые сообщения недоступны серверу и третьим лицам.</span>
          </div>
          <div className="e2ee-fact">
            <strong>Если ключей пока нет</strong>
            <span>Обычные сообщения остаются доступны; защита включится, когда оба участника будут готовы.</span>
          </div>
          {isPending && (
            <div className="e2ee-fact e2ee-fact--accent">
              <strong>Сейчас</strong>
              <span>Защита запрошена для чата. Ждём ключи у всех участников.</span>
            </div>
          )}
          {isDeviceError && (
            <div className="e2ee-fact e2ee-fact--warn">
              <strong>Внимание</strong>
              <span>На этом устройстве нет локального ключа или он не совпадает с ключом аккаунта. Используйте импорт ниже.</span>
            </div>
          )}
        </div>

        <div className="e2ee-key-tools">
          <div className="e2ee-key-panel">
            <div className="e2ee-key-panel__head">
              <span className="e2ee-key-panel__icon">
                <FiDownload />
              </span>
              <div>
                <div className="e2ee-key-panel__label">Экспорт ключа</div>
                <p className="e2ee-key-panel__hint">
                  Задайте пароль, получите зашифрованный текст и перенесите его на другое устройство (или отсканируйте QR).
                </p>
              </div>
            </div>
            <Input
              type="password"
              placeholder="Пароль для экспорта (не короче 8 символов)"
              value={exportPassword}
              onChange={(event) => setExportPassword(event.target.value)}
              autoComplete="new-password"
            />
            <div className="e2ee-key-panel__actions">
              <Button type="button" variant="primary" size="sm" onClick={handleExport} disabled={busyAction === "export"}>
                Экспортировать
              </Button>
            </div>
            {exportedKey && (
              <div className="e2ee-key-export-result">
                <div className="e2ee-key-qr">
                  <img src={exportedQr} alt="QR-код экспортированного ключа" />
                </div>
                <Textarea
                  className="e2ee-key-payload"
                  value={exportedKey}
                  readOnly
                  rows={5}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            )}
          </div>

          <div className="e2ee-key-panel">
            <div className="e2ee-key-panel__head">
              <span className="e2ee-key-panel__icon">
                <FiUpload />
              </span>
              <div>
                <div className="e2ee-key-panel__label">Импорт ключа</div>
                <p className="e2ee-key-panel__hint">
                  Вставьте экспортированный текст и пароль, чтобы читать защищённые чаты на этом устройстве.
                </p>
              </div>
            </div>
            <Textarea
              className="e2ee-key-payload"
              placeholder="Вставьте JSON экспорта ключа"
              value={importPayload}
              onChange={(event) => setImportPayload(event.target.value)}
              rows={4}
            />
            <Input
              type="password"
              placeholder="Пароль от экспорта"
              value={importPassword}
              onChange={(event) => setImportPassword(event.target.value)}
              autoComplete="new-password"
            />
            <div className="e2ee-key-panel__actions">
              <Button type="button" variant="ghost" size="sm" onClick={handleImport} disabled={busyAction === "import"}>
                Импортировать
              </Button>
            </div>
          </div>
        </div>

        {status ? (
          <p
            className={clsx(
              "e2ee-modal-status",
              statusTone === "error" && "e2ee-modal-status--error",
              statusTone === "ok" && "e2ee-modal-status--ok"
            )}
          >
            {status}
          </p>
        ) : null}

        <div className="e2ee-modal-footer">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
          <div className="e2ee-modal-footer__primary">
            {isEnabled ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDisable}
                disabled={busyAction === "disable"}
              >
                Выключить E2EE
              </Button>
            ) : (
              <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
                Включить E2EE
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
