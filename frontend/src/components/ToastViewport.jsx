export default function ToastViewport({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-card">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
