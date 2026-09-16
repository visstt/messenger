import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiLifeBuoy, FiSend, FiUnlock, FiUser } from "react-icons/fi";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function conversationTitle(conversation) {
  if (conversation?.visitorName?.trim()) return conversation.visitorName.trim();
  return `Посетитель #${conversation?.id ?? ""}`.trim();
}

function conversationPreview(conversation) {
  const message = conversation?.lastMessage;
  if (typeof message === "string") return message;
  if (message?.text) return message.text;
  return "Новое обращение";
}

function normalizeMessages(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.messages)) return data.messages;
  return [];
}

function normalizeConversations(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.conversations)) return data.conversations;
  return [];
}

export default function SupportPanel({
  conversations,
  activeConversationId,
  messages,
  loadingConversations,
  loadingMessages,
  sending,
  error,
  currentUser,
  onOpenConversation,
  onSend,
  onUnassign,
  onBack,
}) {
  const [draft, setDraft] = useState("");
  const messagesRef = useRef(null);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (item) => Number(item.id) === Number(activeConversationId)
      ) || null,
    [conversations, activeConversationId]
  );

  // Определяем: занят ли диалог другим оператором
  const isAssignedToOther = useMemo(() => {
    if (!activeConversation?.assignedToUserId) return false;
    if (!currentUser?.id) return false;
    return Number(activeConversation.assignedToUserId) !== Number(currentUser.id);
  }, [activeConversation, currentUser]);

  // Текущий пользователь является оператором этого диалога
  const isAssignedToMe = useMemo(() => {
    if (!activeConversation?.assignedToUserId) return false;
    if (!currentUser?.id) return false;
    return Number(activeConversation.assignedToUserId) === Number(currentUser.id);
  }, [activeConversation, currentUser]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, activeConversationId]);

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversation || sending || isAssignedToOther) return;

    try {
      await onSend(activeConversation.id, text);
      setDraft("");
    } catch {
      // Ошибка уже показывается в родительском компоненте.
    }
  }

  return (
    <section className={`support-panel ${activeConversation ? "support-panel--conversation-open" : ""}`}>
      <div className="support-panel__sidebar">
        <div className="support-panel__sidebar-header">
          <div className="support-panel__title">
            <FiLifeBuoy />
            <div>
              <div className="support-panel__title-main">Поддержка</div>
              <div className="support-panel__title-sub">
                Обращения с сайта SD Медик
              </div>
            </div>
          </div>
        </div>

        {loadingConversations ? (
          <div className="support-panel__empty">Загрузка обращений…</div>
        ) : conversations.length === 0 ? (
          <div className="support-panel__empty">
            <strong>Обращений пока нет</strong>
            <span>Новое сообщение появится здесь автоматически.</span>
          </div>
        ) : (
          <div className="support-panel__conversations">
            {conversations.map((conversation) => {
              const isOccupied =
                conversation.assignedToUserId &&
                Number(conversation.assignedToUserId) !== Number(currentUser?.id);
              const isMine =
                conversation.assignedToUserId &&
                Number(conversation.assignedToUserId) === Number(currentUser?.id);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`support-conversation ${
                    Number(activeConversationId) === Number(conversation.id)
                      ? "active"
                      : ""
                  } ${isOccupied ? "support-conversation--occupied" : ""}`}
                  onClick={() => onOpenConversation(conversation.id)}
                >
                  <div className="support-conversation__avatar">
                    <FiLifeBuoy />
                  </div>
                  <div className="support-conversation__body">
                    <div className="support-conversation__top">
                      <strong>{conversationTitle(conversation)}</strong>
                      <span>{formatTime(conversation.updatedAt)}</span>
                    </div>
                    <div className="support-conversation__bottom">
                      <span>{conversationPreview(conversation)}</span>
                      {conversation.unreadCount > 0 && (
                        <b>{conversation.unreadCount}</b>
                      )}
                    </div>
                    {isOccupied && (
                      <div className="support-conversation__operator">
                        <FiUser size={10} />
                        {conversation.assignedToName || "Оператор"}
                      </div>
                    )}
                    {isMine && (
                      <div className="support-conversation__operator support-conversation__operator--mine">
                        <FiUser size={10} />
                        Вы
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="support-panel__conversation">
        {activeConversation ? (
          <>
            <header className="support-panel__header">
              <button
                type="button"
                className="support-panel__back"
                onClick={onBack}
                aria-label="Назад"
              >
                <FiArrowLeft />
              </button>

              <div className="support-panel__header-icon">
                <FiLifeBuoy />
              </div>

              <div className="support-panel__header-copy">
                <strong>{conversationTitle(activeConversation)}</strong>
                <span>
                  {activeConversation.visitorPhone ||
                    activeConversation.externalId ||
                    "Чат с сайта"}
                </span>
              </div>

              {/* Кнопка "Освободить" — только если диалог ведёт текущий оператор */}
              {isAssignedToMe && onUnassign && (
                <button
                  type="button"
                  className="support-panel__unassign"
                  title="Освободить диалог"
                  onClick={() => onUnassign(activeConversation.id)}
                >
                  <FiUnlock size={16} />
                  <span>Освободить</span>
                </button>
              )}
            </header>

            {/* Баннер "занято другим оператором" */}
            {isAssignedToOther && (
              <div className="support-panel__occupied-banner">
                <FiUser />
                <span>
                  Этот диалог ведёт{" "}
                  <strong>{activeConversation.assignedToName || "другой оператор"}</strong>
                </span>
              </div>
            )}

            <div className="support-panel__messages" ref={messagesRef}>
              {loadingMessages ? (
                <div className="support-panel__empty">Загрузка сообщений…</div>
              ) : messages.length === 0 ? (
                <div className="support-panel__empty">
                  Сообщений пока нет.
                </div>
              ) : (
                messages.map((message) => {
                  const isWorker = message.senderType === "worker";

                  return (
                    <div
                      key={message.id}
                      className={`support-message ${
                        isWorker ? "support-message--outgoing" : ""
                      }`}
                    >
                      <div className="support-message__bubble">
                        <div className="support-message__text">
                          {message.text}
                        </div>
                        <div className="support-message__time">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {error && <div className="support-panel__error">{error}</div>}

            {isAssignedToOther ? (
              <div className="support-panel__composer support-panel__composer--blocked">
                <span>Ответ недоступен — диалог ведёт другой оператор</span>
              </div>
            ) : (
              <form className="support-panel__composer" onSubmit={submit}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ответить посетителю…"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Отправить"
                >
                  <FiSend />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="support-panel__welcome">
            <FiLifeBuoy />
            <h2>Поддержка</h2>
            <p>Выберите обращение слева, чтобы ответить посетителю.</p>
          </div>
        )}
      </div>
    </section>
  );
}
