import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft } from "react-icons/fi";
import Avatar from "../components/Avatar";
import MessageList from "../components/MessageList";
import ImageViewerModal from "../components/modals/ImageViewerModal";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../utils/chats";
import { prepareAdminMessages } from "./prepareAdminMessages";
import chatStyles from "./AdminChatView.module.css";

function moveImageViewer(viewer, delta) {
  if (!viewer?.items?.length) return viewer;
  const nextIndex = (viewer.index + delta + viewer.items.length) % viewer.items.length;
  return { ...viewer, index: nextIndex };
}

export default function AdminChatView({
  chat,
  currentUser,
  messages,
  loading,
  error,
  onBack,
}) {
  const [imageViewer, setImageViewer] = useState(null);
  const displayMessages = useMemo(() => prepareAdminMessages(messages), [messages]);
  const chatId = chat?.id || "admin-chat";

  useEffect(() => {
    if (!imageViewer) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") setImageViewer(null);
      if (event.key === "ArrowLeft") setImageViewer((prev) => moveImageViewer(prev, -1));
      if (event.key === "ArrowRight") setImageViewer((prev) => moveImageViewer(prev, 1));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageViewer]);

  const title = chat ? getChatTitle(chat) : "Переписка";
  const subtitle = chat ? getChatSubtitle(chat) : "Просмотр переписки";

  return (
    <div className={chatStyles.viewport}>
      <section className={`tg-chat-area ${chatStyles.area}`}>
        <div className={`tg-chat-stack ${chatStyles.stack}`}>
          <header className="chat-header">
            <div className="chat-header-shell">
              <div className="chat-header-main">
                <button
                  type="button"
                  className="ghost-button chat-back-button"
                  onClick={onBack}
                  aria-label="Назад"
                >
                  <FiChevronLeft aria-hidden />
                </button>
                <div className={chatStyles.headerTrigger}>
                  <Avatar user={chat ? getChatAvatar(chat) : { name: title }} />
                  <div className="chat-title-block">
                    <h3>{title}</h3>
                    <p className="chat-presence">{subtitle}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {error ? <div className={chatStyles.error}>{error}</div> : null}

          {loading ? (
            <div className="tg-stage">
              <p className="tg-stage-text">Загрузка сообщений…</p>
            </div>
          ) : (
            <MessageList
              readOnly
              adminView
              chatId={chatId}
              currentUser={currentUser}
              messages={displayMessages}
              onOpenImage={(items, index) => setImageViewer({ items, index })}
              forceScroll
            />
          )}
        </div>
      </section>

      <ImageViewerModal
        viewer={imageViewer}
        onClose={() => setImageViewer(null)}
        onPrev={() => setImageViewer((prev) => moveImageViewer(prev, -1))}
        onNext={() => setImageViewer((prev) => moveImageViewer(prev, 1))}
      />
    </div>
  );
}
