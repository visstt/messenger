const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = payload?.error || "Request failed";
    throw new Error(message);
  }
  return payload;
}

export const adminApi = {
  me: () => request("/api/admin/auth/me"),
  login: (body) =>
    request("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () =>
    request("/api/admin/auth/logout", { method: "POST" }),
  listUsers: (query = "", limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) params.set("query", query.trim());
    return request(`/api/admin/users?${params}`);
  },
  getUser: (id) => request(`/api/admin/users/${id}`),
  updateUser: (id, body) =>
    request(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  updateUserPassword: (id, password) =>
    request(`/api/admin/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  listUserChats: (userId) => request(`/api/admin/users/${userId}/chats`),
  listChatMessages: (chatId, limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      includeDeleted: "true",
    });
    return request(`/api/admin/chats/${chatId}/messages?${params}`);
  },
};
