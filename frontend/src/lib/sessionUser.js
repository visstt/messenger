export function unwrapUser(payload) {
  if (!payload) return null;
  if (payload.user && typeof payload.user === "object") return payload.user;
  if (payload.id) return payload;
  return null;
}
