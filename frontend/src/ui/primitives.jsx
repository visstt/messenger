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
      <div className={clsx("tg-modal", contentClassName)} role="dialog" aria-modal="true">
        {title && <div className="tg-modal__title">{title}</div>}
        <div className="tg-modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

