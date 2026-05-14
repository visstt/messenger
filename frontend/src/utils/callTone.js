export function startDialTone() {
  if (typeof window === "undefined") return () => {};

  const audio = new Audio("/iphone-11-pro.mp3");
  audio.loop = true;
  audio.volume = 0.72;

  audio.play().catch(() => null);

  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}

