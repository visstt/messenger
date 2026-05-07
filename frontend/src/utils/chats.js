export function getChatTitle(chat) {
  if (!chat) return "";
  if (chat.kind === "group") return chat.title || "Групповой чат";
  return chat.peer?.name || "Чат";
}

export function getChatSubtitle(chat) {
  if (!chat) return "";
  if (chat.kind === "group") {
    const count = chat.participants?.length || 0;
    return `${count} участников`;
  }
  return chat.peer?.username ? `@${chat.peer.username}` : "личный диалог";
}

export function getChatAvatar(chat) {
  if (!chat) return { name: "Чат", avatarUrl: "" };
  if (chat.kind === "group") {
    return {
      name: chat.title || "Группа",
      avatarUrl: chat.avatarUrl || "",
    };
  }
  return chat.peer || { name: "Чат", avatarUrl: "" };
}
