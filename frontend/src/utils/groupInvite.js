const PENDING_JOIN_KEY = "messenger_pending_join";

export function buildGroupInviteUrl(token) {
  if (!token || typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("join", token);
  return url.toString();
}

export function getJoinTokenFromUrl() {
  if (typeof window === "undefined") return null;
  const token = new URLSearchParams(window.location.search).get("join");
  return token?.trim() || null;
}

export function clearJoinTokenFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("join")) return;
  url.searchParams.delete("join");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function savePendingJoinToken(token) {
  if (!token || typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_JOIN_KEY, token);
}

export function readPendingJoinToken() {
  if (typeof window === "undefined") return null;
  const token = window.sessionStorage.getItem(PENDING_JOIN_KEY);
  return token?.trim() || null;
}

export function clearPendingJoinToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_JOIN_KEY);
}

export function rememberJoinTokenFromUrl() {
  const token = getJoinTokenFromUrl();
  if (token) savePendingJoinToken(token);
  return token;
}

export function parseInviteTokenFromUrl(urlString) {
  if (!urlString) return null;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(urlString, base);
    const token = url.searchParams.get("join")?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export function isGroupInviteUrl(urlString) {
  return Boolean(parseInviteTokenFromUrl(urlString));
}
