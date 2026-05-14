const S3_ENDPOINT_HOST = "s3.ru1.storage.beget.cloud";
const S3_BUCKET_NAME = "c15b4d655f70-medvito-data";

export function normalizeMediaUrl(src = "") {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return src;

  try {
    const url = new URL(src, window.location.origin);
    if (url.hostname !== S3_ENDPOINT_HOST) return src;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return src;

    const objectKeyParts = parts[0] === S3_BUCKET_NAME ? parts.slice(1) : parts;
    if (objectKeyParts.length === 0) return src;

    return `/uploads/${objectKeyParts.map(encodeURIComponent).join("/")}`;
  } catch {
    return src;
  }
}
