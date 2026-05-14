/**
 * getUserMedia / mediaDevices доступны только в «безопасном контексте»
 * (HTTPS, localhost и т.п.). На http://ваш-ip/ API часто отсутствует.
 */
export function assertMediaDevicesAvailable(featureLabel) {
  if (navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const needsHttps =
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";
  const hint = needsHttps
    ? " На сервере нужен HTTPS (например, Let’s Encrypt + certbot). Пока сайт открыт по HTTP, браузер не даст доступ к камере и микрофону."
    : "";
  throw new Error(`${featureLabel}${hint}`);
}
