const DEFAULT_TITLE = "Signal";
let baseFaviconHref = null;

export async function registerNotificationServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) return registration;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/**
 * Подписывается на Web Push уведомления и регистрирует подписку на сервере.
 * Вызывать после получения разрешения на уведомления.
 * @returns {Promise<boolean>} true если подписка успешно создана
 */
export async function subscribeToPushNotifications() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    // Получаем VAPID публичный ключ с сервера
    const res = await fetch("/api/push/vapid-key", { credentials: "include" });
    if (!res.ok) return false;
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    const registration = await registerNotificationServiceWorker();
    if (!registration) return false;

    // Проверяем — нет ли уже активной подписки
    const existing = await registration.pushManager.getSubscription();
    let subscription = existing;

    // Если ключ сервера изменился — переподписываемся
    const existingKey = existing
      ? btoa(String.fromCharCode(...new Uint8Array(existing.options?.applicationServerKey ?? [])))
      : null;
    if (!existing || existingKey !== publicKey) {
      if (existing) await existing.unsubscribe();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Отправляем подписку на сервер
    const subJson = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh ?? "",
          auth: subJson.keys?.auth ?? "",
        },
      }),
    });

    return true;
  } catch (err) {
    console.warn("[push] subscribe failed:", err);
    return false;
  }
}

/** Конвертирует VAPID публичный ключ из base64url в Uint8Array (требуется для subscribe). */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function requestNotificationPermission() {
  if (!canUseNotifications()) return "unsupported";
  if (Notification.permission === "granted") {
    await registerNotificationServiceWorker();
    return "granted";
  }
  if (Notification.permission !== "default") return Notification.permission;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerNotificationServiceWorker();
    }
    return permission;
  } catch {
    return Notification.permission;
  }
}

function getDesktopApi() {
  if (typeof window === "undefined") return null;
  return window.messengerDesktop?.isDesktop ? window.messengerDesktop : null;
}

export async function showMessageNotification({ title, body, tag, onClick, chatId }) {
  const desktop = getDesktopApi();
  if (desktop) {
    const resolvedChatId =
      chatId ?? (tag && /signal-chat-(\d+)/.exec(tag)?.[1]
        ? Number(/signal-chat-(\d+)/.exec(tag)[1])
        : null);

    desktop.showMessageNotification({
      title,
      body,
      tag,
      chatId: resolvedChatId,
    });

    if (resolvedChatId && typeof onClick === "function") {
      registerDesktopNotificationClick(resolvedChatId, onClick);
    }
    return null;
  }

  if (!canUseNotifications() || Notification.permission !== "granted") return null;

  const options = {
    body,
    tag,
    icon: "/signal-notification.svg",
    badge: "/signal-notification.svg",
    silent: false,
    data: {
      url: window.location.href,
    },
  };

  const registration = await registerNotificationServiceWorker();
  if (registration?.showNotification) {
    try {
      await registration.showNotification(title || DEFAULT_TITLE, options);
      return null;
    } catch {
      // Fall through to the page-level Notification API.
    }
  }

  let notification;
  try {
    notification = new Notification(title || DEFAULT_TITLE, options);
  } catch {
    return null;
  }

  notification.onclick = () => {
    window.focus();
    onClick?.();
    notification.close();
  };

  return notification;
}

/** @param {boolean} isActiveChat — сообщение в открытом сейчас чате */
export async function shouldNotifyForIncomingMessage(isActiveChat) {
  const desktop = getDesktopApi();

  if (desktop) {
    try {
      const enabled = await desktop.getNotificationsEnabled?.();
      if (enabled === false) return false;
    } catch {
      // ignore
    }
    if (!isActiveChat) return true;
    try {
      return await desktop.shouldNotify();
    } catch {
      return true;
    }
  }

  if (!canUseNotifications() || Notification.permission !== "granted") {
    return false;
  }
  if (!isActiveChat) return true;
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible" || !document.hasFocus();
}

/** @deprecated use shouldNotifyForIncomingMessage */
export async function shouldNotifyWhenMessageArrives() {
  return shouldNotifyForIncomingMessage(false);
}

const desktopClickHandlers = new Map();
let desktopClickListenerReady = false;

function registerDesktopNotificationClick(chatId, onClick) {
  if (!chatId || typeof onClick !== "function") return;
  desktopClickHandlers.set(Number(chatId), onClick);

  if (desktopClickListenerReady) return;
  const desktop = getDesktopApi();
  if (!desktop?.onNotificationClick) return;

  desktop.onNotificationClick((clickedChatId) => {
    const handler = desktopClickHandlers.get(Number(clickedChatId));
    handler?.();
  });
  desktopClickListenerReady = true;
}

export function setUnreadTitle(count) {
  if (typeof document === "undefined") return;
  document.title = count > 0 ? `(${count}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  setFaviconBadge(count);
  void setAppBadge(count);
  sendBadgeToServiceWorker(count);
}

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function setFaviconBadge(count) {
  const link = getFaviconLink();
  if (!link) return;

  if (!baseFaviconHref) {
    baseFaviconHref = link.href || "";
  }

  if (count <= 0) {
    link.href = baseFaviconHref || createSignalFavicon();
    return;
  }

  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#50a2e9";
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S", 32, 34);

  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.arc(47, 17, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px Segoe UI, Arial, sans-serif";
  ctx.fillText(count > 9 ? "9+" : String(count), 47, 18);

  link.href = canvas.toDataURL("image/png");
}

async function setAppBadge(count) {
  if (typeof navigator === "undefined") return;

  try {
    if (count > 0 && "setAppBadge" in navigator) {
      await navigator.setAppBadge(count > 99 ? 99 : count);
      return;
    }
    if (count <= 0 && "clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch {
    // Ignore unsupported platform/runtime errors.
  }
}

function sendBadgeToServiceWorker(count) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({
    type: "badge:update",
    count,
  });
}

function getFaviconLink() {
  if (typeof document === "undefined") return null;

  let link = document.querySelector('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.href = createSignalFavicon();
    document.head.appendChild(link);
  }
  return link;
}

function createSignalFavicon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#50a2e9"/><text x="32" y="41" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="white">S</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

