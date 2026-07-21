import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { createPortal } from "react-dom";
import clsx from "./utils/clsx.js";

export function Button({ variant = "primary", size = "md", className, ...props }) {
  return <button className={clsx("tg-btn", `tg-btn-${variant}`, `tg-btn-${size}`, className)} {...props} />;
}

export function IconButton({ variant = "ghost", size = "md", className, ...props }) {
  return (
    <button
      className={clsx("tg-icon-btn", `tg-icon-btn-${variant}`, `tg-icon-btn-${size}`, className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return <input className={clsx("tg-input", className)} {...props} />;
}

export function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="tg-password-field">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={clsx("tg-input tg-password-field__input", className)}
      />
      <button
        type="button"
        className="tg-password-field__toggle"
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={visible}
        onClick={() => setVisible((prev) => !prev)}
      >
        {visible ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={clsx("tg-input tg-textarea", className)} {...props} />;
}

export function SectionTitle({ eyebrow, title, right }) {
  return (
    <div className="tg-section-title">
      <div className="tg-section-title__copy">
        {eyebrow && <div className="tg-eyebrow">{eyebrow}</div>}
        {title && <div className="tg-title">{title}</div>}
      </div>
      {right && <div className="tg-section-title__right">{right}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, className, contentClassName }) {
  if (!open) return null;
  return createPortal(
    <div
      className={clsx("tg-modal-backdrop", className)}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={clsx("tg-modal", contentClassName)}
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight: "min(85vh, 680px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {title && (
          <div className="tg-modal__title" style={{ flexShrink: 0 }}>
            {title}
          </div>
        )}
        <div
          className="tg-modal__body"
          style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

