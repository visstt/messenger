import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "./adminApi";
import shared from "./shared.module.css";
import chatStyles from "./UserChatsPage.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chatTitle(chat) {
  if (chat.kind === "group") {
    return chat.title || `Группа #${chat.id}`;
  }
  const peer = chat.peer;
  if (peer?.name) return peer.name;
  if (peer?.username) return peer.username;
  return `Чат #${chat.id}`;
}

function lastMessagePreview(message) {
  if (!message) return "Нет сообщений";
  if (message.deletedAt && !message.text && !message.fileUrl) {
    return "Сообщение удалено";
  }
  if (message.encryptedPayload) return "Зашифрованное сообщение";
  if (message.text) return message.text;
  if (message.fileUrl) return message.fileName || "Вложение";
  return message.kind || "Сообщение";
}

export default function UserChatsPage() {
  const { userId } = useParams();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApi
      .listUserChats(userId)
      .then((data) => {
        if (!cancelled) setChats(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить переписки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className={shared.page}>
      <div className={shared.pageHeader}>
        <h1>Переписки</h1>
        <Link to={`/users/${userId}`} className={shared.btnSecondary}>
          К профилю
        </Link>
      </div>

      {error ? <div className={shared.alertError}>{error}</div> : null}

      {loading ? (
        <p className={shared.muted}>Загрузка…</p>
      ) : chats.length === 0 ? (
        <p className={shared.muted}>Переписки не найдены</p>
      ) : (
        <div className={chatStyles.list}>
          {chats.map((chat) => (
            <Link
              key={chat.id}
              to={`/chats/${chat.id}?userId=${userId}`}
              state={{ chat, userId }}
              className={chatStyles.item}
            >
              <div className={chatStyles.itemTitle}>{chatTitle(chat)}</div>
              <div className={chatStyles.itemMeta}>
                {chat.kind === "group" ? "Группа" : "Личный"} · обновлён{" "}
                {formatDate(chat.updatedAt)}
              </div>
              <div className={chatStyles.itemPreview}>
                {lastMessagePreview(chat.lastMessage)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
