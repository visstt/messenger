import { useEffect } from "react";
import { FiPhoneCall, FiPhoneOff, FiVideo } from "react-icons/fi";
import { getChatTitle } from "../utils/chats";
import { startDialTone } from "../utils/callTone";

export default function IncomingCallModal({ call, onAccept, onDecline }) {
  useEffect(() => {
    if (!call) return undefined;
    return startDialTone();
  }, [call?.callId]);

  if (!call) return null;

  const isAudioOnly = call.kind === "audio";
  const callerName = call.from?.name || "Собеседник";

  return (
    <div className="incoming-call-backdrop" role="dialog" aria-modal="true" aria-label="Входящий звонок">
      <section className="incoming-call-card">
        <div className="incoming-call-pulse" aria-hidden="true">
          {isAudioOnly ? <FiPhoneCall /> : <FiVideo />}
        </div>

        <div className="incoming-call-copy">
          <span>{isAudioOnly ? "Входящий аудиозвонок" : "Входящий видеозвонок"}</span>
          <h3>{callerName}</h3>
          <p>{getChatTitle(call.chat)}</p>
        </div>

        <div className="incoming-call-actions">
          <button
            type="button"
            className="incoming-call-button decline"
            onClick={onDecline}
            aria-label="Отклонить звонок"
          >
            <FiPhoneOff />
          </button>
          <button
            type="button"
            className="incoming-call-button accept"
            onClick={onAccept}
            aria-label="Ответить на звонок"
          >
            <FiPhoneCall />
          </button>
        </div>
      </section>
    </div>
  );
}
