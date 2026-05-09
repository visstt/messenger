export function renderPreview(message) {
  if (!message) return "Сообщений пока нет";
  if (message.deletedAt) return "Сообщение удалено";
  if (message.kind === "system") return message.text || "Системное сообщение";
  if (message.e2eeState === "locked") return "Зашифрованное сообщение";
  if (message.kind === "image") {
    const items = parseImageItems(message);
    if (message.text) return message.text;
    return items.length > 1 ? `Фото · ${items.length}` : "Фото";
  }
  if (message.kind === "video") return message.text || "Видео";
  if (message.kind === "video_note") return "Видеосообщение";
  if (message.kind === "file") {
    const [item] = parseAttachmentItems(message);
    return message.text || item?.name || "Файл";
  }
  if (message.kind === "voice") return `Голосовое · ${message.durationSec || 0}с`;
  return message.text || "Зашифрованное сообщение";
}

export function translateStatus(status) {
  if (status === "read") return "прочитано";
  if (status === "sent") return "отправлено";
  if (status === "received") return "получено";
  return status;
}

export function formatClock(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseImageItems(message) {
  const attachments = message?.decryptedAttachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    return attachments.map((item, index) => ({
      src: item.src,
      alt: item.name || `Фото ${index + 1}`,
    }));
  }

  const urls = parseMaybeArray(message.fileUrl);
  const names = parseMaybeArray(message.fileName);
  return urls.map((src, index) => ({
    src,
    alt: names[index] || `Фото ${index + 1}`,
  }));
}

export function parseAttachmentItems(message) {
  const attachments = message?.decryptedAttachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    return attachments.map((item) => ({
      src: item.src,
      name: item.name || "Файл",
      extension: extensionFromName(item.name),
      mimeType: item.mimeType || guessMimeTypeFromName(item.name),
    }));
  }

  const urls = parseMaybeArray(message.fileUrl);
  const names = parseMaybeArray(message.fileName);
  return urls.map((src, index) => {
    const name = names[index] || src.split("/").pop() || "Файл";
    return {
      src,
      name,
      extension: extensionFromName(name),
      mimeType: guessMimeTypeFromName(name),
    };
  });
}

export function parseMaybeArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [value];
  }
  return [value];
}

export function groupMessages(messages) {
  const grouped = [];

  for (const message of messages) {
    const previous = grouped[grouped.length - 1];

    if (canMergeIntoPrevious(previous, message)) {
      previous.items.push(message);
      previous.decryptedAttachments = [
        ...(previous.decryptedAttachments || []),
        ...message.decryptedAttachments,
      ];
      previous.status = message.status;
      previous.createdAt = message.createdAt;
      previous.id = message.id;
      previous.key = `group-${previous.items.map((item) => item.id).join("-")}`;
      previous.grouped = true;
      previous.deletedGroup = previous.deletedAt ? true : previous.deletedGroup;
      continue;
    }

    grouped.push({
      ...message,
      key: `message-${message.id}`,
      grouped: false,
      items: [message],
      deletedGroup: Boolean(message.deletedAt && message.kind === "image"),
    });
  }

  return grouped;
}

function canMergeIntoPrevious(previous, next) {
  if (!previous) return false;
  if (previous.senderId !== next.senderId) return false;
  if (previous.kind === "system" || next.kind === "system") return false;
  if (previous.kind !== "image" || next.kind !== "image") return false;
  if (previous.e2eeState === "locked" || next.e2eeState === "locked") return false;

  if (previous.deletedAt && next.deletedAt) {
    const previousTimeDeleted = new Date(previous.createdAt).getTime();
    const nextTimeDeleted = new Date(next.createdAt).getTime();
    return Math.abs(nextTimeDeleted - previousTimeDeleted) <= 5000;
  }

  if (previous.deletedAt || next.deletedAt) return false;
  if (parseImageItems(next).length !== 1) return false;
  if (parseImageItems(previous).length !== previous.items.length) return false;

  const previousTime = new Date(previous.createdAt).getTime();
  const nextTime = new Date(next.createdAt).getTime();
  return Math.abs(nextTime - previousTime) <= 5000;
}

function extensionFromName(name) {
  if (!name || !name.includes(".")) return "";
  return name.split(".").pop().toUpperCase();
}

function guessMimeTypeFromName(name = "") {
  const lower = name.toLowerCase();

  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".ogv")) return "video/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}
