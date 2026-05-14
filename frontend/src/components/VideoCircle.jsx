import { useRef, useState } from "react";
import { FiPlay } from "react-icons/fi";

export default function VideoCircle({
  src,
  title,
  mimeType,
  className = "",
  size = "180px",
  showPlayOverlay = true,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      video.pause();
      return;
    }
    await video.play().catch(() => null);
  }

  return (
    <div
      className={`video-circle-shell ${className}`.trim()}
      style={{ "--video-circle-size": size }}
    >
      <video
        ref={videoRef}
        className="video-circle-native"
        src={src}
        title={title || "Video note"}
        playsInline
        preload="metadata"
        type={mimeType || guessMimeType(src)}
        onClick={togglePlayback}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {showPlayOverlay && (
        <div className={`video-circle-overlay ${playing ? "is-playing" : ""}`}>
          <button type="button" className="video-circle-play" onClick={togglePlayback} aria-label="Воспроизвести">
            <FiPlay />
          </button>
        </div>
      )}
    </div>
  );
}

function guessMimeType(src) {
  if (!src) return "video/mp4";
  const clean = src.split("?")[0].toLowerCase();

  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".ogv")) return "video/ogg";
  return "video/mp4";
}
