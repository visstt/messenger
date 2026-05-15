import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

export default function ImageViewerModal({ viewer, onClose, onPrev, onNext }) {
  if (!viewer) return null;

  const currentItem = viewer.items[viewer.index];

  return (
    <div className="modal-backdrop image-viewer-backdrop" onClick={onClose}>
      <div className="image-viewer-panel" onClick={(event) => event.stopPropagation()}>
        {viewer.items.length > 1 && (
          <button
            type="button"
            className="ghost-button image-viewer-nav image-viewer-nav-left"
            onClick={onPrev}
            aria-label="Предыдущее фото"
          >
            <FiChevronLeft />
          </button>
        )}
        <button
          type="button"
          className="ghost-button image-viewer-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <FiX />
        </button>
        <div className="image-viewer-scroll">
          <img src={currentItem?.src} alt={currentItem?.alt} className="image-viewer-media" />
        </div>
        {viewer.items.length > 1 && (
          <>
            <button
              type="button"
              className="ghost-button image-viewer-nav image-viewer-nav-right"
              onClick={onNext}
              aria-label="Следующее фото"
            >
              <FiChevronRight />
            </button>
            <div className="image-viewer-counter">
              {viewer.index + 1} / {viewer.items.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
