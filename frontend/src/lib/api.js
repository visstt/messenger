const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : jsonHeaders),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }
  return payload;
}

export const api = {
  me: () => request("/api/auth/me"),
  register: (body) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  updateProfile: (body) =>
    request("/api/users/me", { method: "PATCH", body: JSON.stringify(body) }),
  updatePublicKey: (publicKey) =>
    request("/api/users/me/keys", {
      method: "PUT",
      body: JSON.stringify({ publicKey }),
    }),
  uploadAvatar: (formData) =>
    request("/api/users/me/avatar", { method: "POST", body: formData }),
  searchUsers: (query) =>
    request(`/api/users/search?query=${encodeURIComponent(query)}`),
  listChats: () => request("/api/chats"),
  createPrivateChat: (userId) =>
    request("/api/chats/private", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  createGroupChat: (body) =>
    request("/api/chats/group", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  enableChatE2EE: (chatId) =>
    request(`/api/chats/${chatId}/e2ee/enable`, {
      method: "POST",
    }),
  listMessages: (chatId) => request(`/api/chats/${chatId}/messages`),
  sendTextMessage: (chatId, body) =>
    request(`/api/chats/${chatId}/messages/text`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  sendImageMessage: (chatId, formData) =>
    request(`/api/chats/${chatId}/messages/image`, {
      method: "POST",
      body: formData,
    }),
  sendVideoMessage: (chatId, formData) =>
    request(`/api/chats/${chatId}/messages/video`, {
      method: "POST",
      body: formData,
    }),
  sendVideoNoteMessage: (chatId, formData) =>
    request(`/api/chats/${chatId}/messages/video-note`, {
      method: "POST",
      body: formData,
    }),
  sendFileMessage: (chatId, formData) =>
    request(`/api/chats/${chatId}/messages/file`, {
      method: "POST",
      body: formData,
    }),
  sendVoiceMessage: (chatId, formData) =>
    request(`/api/chats/${chatId}/messages/voice`, {
      method: "POST",
      body: formData,
    }),
  markRead: (chatId) => request(`/api/chats/${chatId}/read`, { method: "POST" }),
  sendTyping: (chatId, typing) =>
    request(`/api/chats/${chatId}/typing`, {
      method: "POST",
      body: JSON.stringify({ typing }),
    }),
  editMessage: (messageId, body) =>
    request(`/api/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteMessage: (messageId) =>
    request(`/api/messages/${messageId}`, {
      method: "DELETE",
    }),
  pinMessage: (messageId) =>
    request(`/api/messages/${messageId}/pin`, {
      method: "POST",
    }),
  unpinMessage: (messageId) =>
    request(`/api/messages/${messageId}/pin`, {
      method: "DELETE",
    }),
};
