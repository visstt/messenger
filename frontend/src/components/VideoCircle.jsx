import { MediaPlayer, MediaProvider, PlayButton } from "@vidstack/react";
import { FiPlay } from "react-icons/fi";
import "@vidstack/react/player/styles/base.css";

export default function VideoCircle({
  src,
  title,
  mimeType,
  className = "",
  size = "180px",
  showPlayOverlay = true,
}) {
  return (
    <div
      className={`video-circle-shell ${className}`.trim()}
      style={{ "--video-circle-size": size }}
    >
      <MediaPlayer
        src={normalizeSource(src, mimeType)}
        title={title || "Video note"}
        playsInline
        className="video-circle-player"
      >
        <MediaProvider className="video-circle-provider" />
        {showPlayOverlay && (
          <div className="video-circle-overlay">
            <PlayButton className="video-circle-play">
              <FiPlay />
            </PlayButton>
          </div>
        )}
      </MediaPlayer>
    </div>
  );
}

function normalizeSource(src, mimeType) {
  if (!src) return "";

  return {
    src,
    type: mimeType || guessMimeType(src),
  };
}

function guessMimeType(src) {
  const clean = src.split("?")[0].toLowerCase();

  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".ogv")) return "video/ogg";
  return "video/mp4";
}
