import { useEffect, useRef } from "react";

const EDGE_PX = 32;
const COMMIT_PX = 72;
const MAX_DRAG_PX = 140;

/**
 * iOS-style edge swipe to go back (e.g. exit chat on mobile).
 */
export function useSwipeBack(enabled, onBack) {
  const ref = useRef(null);
  const gestureRef = useRef(null);

  useEffect(() => {
    if (!enabled || !onBack) return undefined;

    const node = ref.current;
    if (!node) return undefined;

    function resetTransform() {
      node.style.transition = "transform 180ms ease";
      node.style.transform = "";
      window.setTimeout(() => {
        node.style.transition = "";
      }, 200);
    }

    function onTouchStart(event) {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_PX) return;

      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        dragging: true,
      };
    }

    function onTouchMove(event) {
      const gesture = gestureRef.current;
      if (!gesture?.dragging || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (deltaY > 24 && Math.abs(deltaY) > Math.abs(deltaX)) {
        gestureRef.current = null;
        resetTransform();
        return;
      }

      if (deltaX < 8) return;

      const offset = Math.min(deltaX, MAX_DRAG_PX);
      node.style.transition = "";
      node.style.transform = `translate3d(${offset}px, 0, 0)`;
    }

    function onTouchEnd(event) {
      const gesture = gestureRef.current;
      if (!gesture?.dragging) return;

      gestureRef.current = null;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - gesture.startX;

      if (deltaX >= COMMIT_PX) {
        onBack();
      }

      resetTransform();
    }

    function onTouchCancel() {
      gestureRef.current = null;
      resetTransform();
    }

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchCancel);

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchCancel);
      node.style.transform = "";
      node.style.transition = "";
    };
  }, [enabled, onBack]);

  return ref;
}
