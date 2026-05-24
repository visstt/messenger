const DEFAULT_MESSENGER_URL = "https://chat.5-35-88-205.sslip.io";

export function getMessengerInviteUrl() {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) {
      return origin.replace(/\/$/, "");
    }
  }
  return DEFAULT_MESSENGER_URL;
}

export function buildMessengerInviteMessage() {
  const url = getMessengerInviteUrl();
  return `Присоединяйся ко мне в Signal — удобный мессенджер для переписки, звонков и обмена файлами.

${url}`;
}

export async function copyMessengerInvite() {
  const text = buildMessengerInviteMessage();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return text;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("copy failed");
  return text;
}
