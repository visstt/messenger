function pluralMinutes(value) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "минуту";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "минуты";
  return "минут";
}

function pluralHours(value) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "час";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "часа";
  return "часов";
}

export function mergeUserPresence(user, patch = {}) {
  if (!user?.id) return user;
  return {
    ...user,
    online: patch.online ?? user.online,
    lastSeenAt: patch.lastSeenAt !== undefined ? patch.lastSeenAt : user.lastSeenAt,
  };
}

export function formatPresenceLabel(user) {
  if (!user) return "";
  if (user.online) return "в сети";

  const raw = user.lastSeenAt;
  if (!raw) return "";

  const seenAt = new Date(raw);
  const ts = seenAt.getTime();
  if (!Number.isFinite(ts)) return "";

  const diffMs = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "был в сети только что";
  if (minutes < 60) {
    return `был в сети ${minutes} ${pluralMinutes(minutes)} назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `был в сети ${hours} ${pluralHours(hours)} назад`;
  }

  const now = new Date();
  const sameDay =
    seenAt.getFullYear() === now.getFullYear() &&
    seenAt.getMonth() === now.getMonth() &&
    seenAt.getDate() === now.getDate();
  const timeLabel = seenAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `был в сети сегодня в ${timeLabel}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    seenAt.getFullYear() === yesterday.getFullYear() &&
    seenAt.getMonth() === yesterday.getMonth() &&
    seenAt.getDate() === yesterday.getDate();
  if (wasYesterday) return `был в сети вчера в ${timeLabel}`;

  return `был в сети ${seenAt.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })}`;
}

export function getPrivateChatPresenceLabel(chat) {
  if (!chat || chat.kind !== "private" || !chat.peer?.id) return "";
  return formatPresenceLabel(chat.peer);
}
