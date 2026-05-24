import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AdminChatView from "./AdminChatView";
import { adminApi } from "./adminApi";

export default function ChatMessagesPage() {
  const { chatId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const location = useLocation();
  const navigate = useNavigate();

  const [chat, setChat] = useState(location.state?.chat || null);
  const [viewUser, setViewUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.chat) {
      setChat(location.state.chat);
    }
  }, [location.state?.chat]);

  useEffect(() => {
    if (!userId) {
      setViewUser({ id: 0, name: "Админ" });
      return undefined;
    }

    let cancelled = false;
    adminApi
      .getUser(userId)
      .then((data) => {
        if (!cancelled) setViewUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setViewUser({ id: Number(userId), name: `Пользователь #${userId}` });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || chat) return undefined;

    let cancelled = false;
    adminApi
      .listUserChats(userId)
      .then((data) => {
        if (cancelled) return;
        const found = (data.items || []).find((item) => String(item.id) === String(chatId));
        if (found) setChat(found);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId, chatId, chat]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApi
      .listChatMessages(chatId)
      .then((data) => {
        if (!cancelled) setMessages(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить сообщения");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  function handleBack() {
    if (userId) {
      navigate(`/users/${userId}/chats`);
      return;
    }
    navigate("/users");
  }

  return (
    <AdminChatView
      chat={chat}
      currentUser={viewUser}
      messages={messages}
      loading={loading}
      error={error}
      onBack={handleBack}
    />
  );
}
