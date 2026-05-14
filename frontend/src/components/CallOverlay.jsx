import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useLocalParticipant,
} from "@livekit/components-react";
import { useEffect } from "react";
import { FiMic, FiMicOff, FiMonitor, FiPhoneOff, FiVideo, FiVideoOff } from "react-icons/fi";
import Avatar from "./Avatar";
import { getChatAvatar, getChatTitle } from "../utils/chats";
import { startDialTone } from "../utils/callTone";

export default function CallOverlay({ call, onClose }) {
  useEffect(() => {
    if (call?.status !== "dialing") return undefined;
    return startDialTone();
  }, [call?.status, call?.callId]);

  if (!call) return null;

  const isAudioOnly = call.kind === "audio";
  const statusLabel =
    call.status === "dialing"
      ? "Дозвон..."
      : isAudioOnly
        ? "Аудиозвонок"
        : "Видеозвонок";

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Звонок">
      <LiveKitRoom
        token={call.token}
        serverUrl={call.serverUrl}
        connect
        audio
        video={!isAudioOnly}
        onDisconnected={onClose}
        className={`call-room ${isAudioOnly ? "is-audio-only" : ""}`}
      >
        <header className="call-header">
          <div>
            <span>{statusLabel}</span>
            <strong>{getChatTitle(call.chat)}</strong>
          </div>
          <button type="button" className="call-end-button" onClick={onClose} aria-label="Завершить звонок">
            <FiPhoneOff />
          </button>
        </header>

        {isAudioOnly ? (
          <div className={`tg-audio-call ${call.status === "dialing" ? "is-dialing" : ""}`}>
            <div className="tg-audio-call__avatar-wrap">
              <div className="tg-audio-call__pulse" aria-hidden="true" />
              <Avatar user={getChatAvatar(call.chat)} />
            </div>
            <div className="tg-audio-call__copy">
              <h2>{getChatTitle(call.chat)}</h2>
              <p>{statusLabel}</p>
            </div>
            <CallControls kind={call.kind} onClose={onClose} />
          </div>
        ) : (
          <div className="tg-video-call">
            <VideoConference />
            <CallControls kind={call.kind} onClose={onClose} />
          </div>
        )}

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

function CallControls({ kind, onClose }) {
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const isVideoCall = kind === "video";

  useEffect(() => {
    if (!isVideoCall) return;
    localParticipant.setCameraEnabled(true).catch(() => null);
  }, [isVideoCall, localParticipant]);

  return (
    <div className="tg-audio-call__actions">
      <button
        type="button"
        className={`tg-call-round-action ${!isMicrophoneEnabled ? "is-muted" : ""}`}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => null)}
        aria-label={isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
        title={isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
      >
        {isMicrophoneEnabled ? <FiMic /> : <FiMicOff />}
      </button>

      {isVideoCall && (
        <>
          <button
            type="button"
            className={`tg-call-round-action ${!isCameraEnabled ? "is-muted" : ""}`}
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => null)}
            aria-label={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
            title={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {isCameraEnabled ? <FiVideo /> : <FiVideoOff />}
          </button>
          <button
            type="button"
            className={`tg-call-round-action ${isScreenShareEnabled ? "is-active" : ""}`}
            onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled).catch(() => null)}
            aria-label={isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Показать экран"}
            title={isScreenShareEnabled ? "Остановить демонстрацию экрана" : "Показать экран"}
          >
            <FiMonitor />
          </button>
        </>
      )}

      <button type="button" className="tg-call-round-action is-end" onClick={onClose} aria-label="Завершить звонок">
        <FiPhoneOff />
      </button>
    </div>
  );
}
