const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

function trimTrailingPunctuation(value) {
  const match = value.match(/^(.*?)([),.;!?]+)?$/);
  if (!match) return { url: value, suffix: "" };
  return {
    url: match[1] || value,
    suffix: match[2] || "",
  };
}

export function splitTextWithUrls(text) {
  if (!text) return [];

  const segments = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, URL_REGEX.flags);

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const raw = match[0];
    const { url, suffix } = trimTrailingPunctuation(raw);
    const href = url.startsWith("www.") ? `https://${url}` : url;

    segments.push({ type: "url", value: url, href });
    if (suffix) segments.push({ type: "text", value: suffix });

    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
