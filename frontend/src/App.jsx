import { useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatHeader from "./components/ChatHeader";
import Composer from "./components/Composer";
import MessageList from "./components/MessageList";
import Sidebar from "./components/Sidebar";
import ImageViewerModal from "./components/modals/ImageViewerModal";
import ConfirmModal from "./components/modals/ConfirmModal";
import EditMessageModal from "./components/modals/EditMessageModal";
import PeerProfileModal from "./components/modals/PeerProfileModal";
import ProfileEditorModal from "./components/modals/ProfileEditorModal";
import ProfileModal from "./components/modals/ProfileModal";
import GroupChatModal from "./components/modals/GroupChatModal";
import SearchModal from "./components/modals/SearchModal";
import E2EEModal from "./components/modals/E2EEModal";
import ToastViewport from "./components/ToastViewport";
import { api } from "./lib/api";
import {
  canEncryptForChat,
  decryptMessage,
  ensureDeviceKeys,
  encryptAttachmentMessage,
  encryptTextMessage,
  hasLocalPrivateKey,
} from "./lib/e2ee";

const emptyProfile = { name: "", username: "", bio: "", avatarUrl: "" };

export default function App() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 960px)").matches;
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("messenger-theme") || "light";
  });
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [mobileScreen, setMobileScreen] = useState("sidebar");
  const [messages, setMessages] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupResults, setGroupResults] = useState([]);
  const [groupSelectedUsers, setGroupSelectedUsers] = useState([]);
  const [typingState, setTypingState] = useState({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [peerProfileOpen, setPeerProfileOpen] = useState(false);
  const [imageViewer, setImageViewer] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editDialog, setEditDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [profileDraft, setProfileDraft] = useState(emptyProfile);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [e2eeError, setE2eeError] = useState("");
  const [e2eeModalOpen, setE2eeModalOpen] = useState(false);
  const socketRef = useRef(null);
  const activeChatIdRef = useRef(null);

  const activeTyping = activeChat ? typingState[activeChat.id] : false;
  const welcomeChat = useMemo(() => chats[0], [chats]);
  const activeChatSecurity = useMemo(
    () => getChatSecurityState(activeChat, currentUser, e2eeError),
    [activeChat, currentUser, e2eeError]
  );

  useEffect(() => {
    activeChatIdRef.current = activeChat?.id ?? null;
  }, [activeChat?.id]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("messenger-theme", theme);
  }, [theme]);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) {
        setMobileScreen("sidebar");
      } else if (!activeChat || sidebarTab !== "chats") {
        setMobileScreen("sidebar");
      }
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [activeChat, sidebarTab]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    let closedByEffect = false;
    let reconnectTimer = null;

    const connect = () => {
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onmessage = async (event) => {
        const payload = JSON.parse(event.data);
        const activeId = activeChatIdRef.current;

        if (payload.type === "message:upsert") {
          const message = await hydrateMessage(payload.data.message, { includeFiles: true });
          const eventChatId = Number(payload.data.chatId);
          const isActiveChatMessage = eventChatId === Number(activeId);

          if (isActiveChatMessage) {
            setMessages((prev) => upsertMessage(prev, message));
            if (message.senderId !== currentUser.id && message.kind !== "system") {
              api.markRead(eventChatId).catch(() => null);
            }
          }
          fetchChats(activeId, { syncActive: Boolean(activeId) }).catch(() => null);
        }

        if (payload.type === "chat:created") {
          fetchChats(activeId, { syncActive: Boolean(activeId) }).catch(() => null);
        }

        if (payload.type === "chat:e2ee") {
          const eventChatId = Number(payload.data.chatId);
          const nextChat = payload.data.chat;

          setChats((prev) =>
            prev.map((chat) => (Number(chat.id) === eventChatId ? { ...chat, ...nextChat } : chat))
          );

          if (eventChatId === Number(activeId)) {
            setActiveChat((prev) => (prev ? { ...prev, ...nextChat } : prev));
          }
        }

        if (payload.type === "chat:typing") {
          setTypingState((prev) => ({
            ...prev,
            [payload.data.chatId]: payload.data.isTyping,
          }));
        }

        if (payload.type === "chat:read") {
          const eventChatId = Number(payload.data.chatId);
          fetchChats(activeId, { syncActive: Boolean(activeId) }).catch(() => null);
          if (eventChatId === Number(activeId)) {
            setMessages((prev) =>
              prev.map((message) =>
                message.senderId === currentUser.id ? { ...message, status: "read" } : message
              )
            );
          }
        }
      };

      ws.onclose = () => {
        if (closedByEffect) return;
        reconnectTimer = window.setTimeout(connect, 1200);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        await fetchChats(activeChatIdRef.current, { syncActive: Boolean(activeChatIdRef.current) });
      } catch {
        return null;
      }
      return null;
    };

    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api.searchUsers(searchQuery.trim());
        setSearchResults(data.items || []);
      } catch (err) {
        setError(err.message);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    if (!groupOpen || groupQuery.trim().length < 1) {
      setGroupResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api.searchUsers(groupQuery.trim());
        setGroupResults(data.items || []);
      } catch (err) {
        setError(err.message);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [groupQuery, groupOpen]);

  useEffect(() => {
    if (!imageViewer) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setImageViewer(null);
      } else if (event.key === "ArrowLeft") {
        setImageViewer((prev) => moveImageViewer(prev, -1));
      } else if (event.key === "ArrowRight") {
        setImageViewer((prev) => moveImageViewer(prev, 1));
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [imageViewer]);

  useEffect(() => {
    if (toasts.length === 0) return undefined;

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 2600);

    return () => clearTimeout(timer);
  }, [toasts]);

  async function bootstrap() {
    try {
      const me = await api.me();
      await establishSecureSession(me.user);

      const nextChats = await fetchChats();
      if (!isMobile && nextChats[0]) {
        await openChat(nextChats[0].id, { markRead: true, forceScroll: true });
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setBooting(false);
    }
  }

  function applyUserSession(user) {
    setCurrentUser(user);
    setProfileDraft({
      name: user.name,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    });
  }

  async function establishSecureSession(user) {
    try {
      const secureUser = await ensureDeviceKeys(user, api);
      applyUserSession(secureUser);
      setE2eeError("");
      return secureUser;
    } catch (err) {
      applyUserSession(user);
      setE2eeError(err.message);
      return user;
    }
  }

  async function hydrateMessage(message, options = {}) {
    if (!message || !currentUser || message.kind === "system") return message;
    return decryptMessage(message, currentUser.id, options);
  }

  async function fetchChats(preferredChatId, options = {}) {
    const { syncActive = true } = options;
    const data = await api.listChats();
    const nextChats = await Promise.all(
      (data.items || []).map(async (chat) => ({
        ...chat,
        lastMessage: chat.lastMessage ? await hydrateMessage(chat.lastMessage) : chat.lastMessage,
      }))
    );
    setChats(nextChats);

    const targetId = preferredChatId ?? activeChatIdRef.current;
    if (syncActive && targetId) {
      const resolved = nextChats.find((item) => Number(item.id) === Number(targetId));
      if (resolved) {
        setActiveChat((prev) => ({
          ...(prev || {}),
          ...resolved,
        }));
      }
    }

    return nextChats;
  }

  async function openChat(chatId, options = {}) {
    const { markRead = true, forceScroll = false } = options;
    if (!chatId) return;

    activeChatIdRef.current = Number(chatId);
    setLoadingChatId(chatId);

    try {
      const data = await api.listMessages(chatId);
      const safeItems = (data.items || []).filter(
        (message) => Number(message.chatId) === Number(data.chat.id)
      );
      const hydratedItems = await Promise.all(
        safeItems.map((message) => hydrateMessage(message, { includeFiles: true }))
      );
      setActiveChat({
        ...data.chat,
        forceScroll,
      });
      if (isMobile) {
        setMobileScreen("chat");
      }
      activeChatIdRef.current = Number(data.chat.id);
      setMessages(hydratedItems);

      if (markRead) {
        await api.markRead(chatId);
        setChats((prev) =>
          prev.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat))
        );
      }
    } finally {
      setLoadingChatId(null);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const payload =
        authMode === "login"
          ? await api.login({
              identifier: formData.get("identifier"),
              password: formData.get("password"),
            })
          : await api.register({
              name: formData.get("name"),
              username: formData.get("username"),
              email: formData.get("email"),
              password: formData.get("password"),
            });

      await establishSecureSession(payload.user);

      const nextChats = await fetchChats();
      if (!isMobile && nextChats[0]) {
        await openChat(nextChats[0].id, { markRead: true, forceScroll: true });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    await api.logout();
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setActiveChat(null);
    setError("");
    setProfileOpen(false);
    setProfileEditorOpen(false);
    setPeerProfileOpen(false);
    setGroupOpen(false);
    setGroupSelectedUsers([]);
    setImageViewer(null);
    setMobileScreen("sidebar");
    setSidebarTab("chats");
    setE2eeError("");
    setE2eeModalOpen(false);
  }

  async function enableE2EEForActiveChat() {
    if (!activeChat?.id) return;
    try {
      const response = await api.enableChatE2EE(activeChat.id);
      setActiveChat((prev) => (prev ? { ...prev, ...response.chat } : prev));
      setChats((prev) =>
        prev.map((chat) =>
          Number(chat.id) === Number(response.chat.id) ? { ...chat, ...response.chat } : chat
        )
      );
      setE2eeModalOpen(false);
      if (response.changed) {
        pushToast("Сквозное шифрование включено");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function startChat(userId) {
    try {
      setError("");
      const data = await api.createPrivateChat(userId);
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      await fetchChats(data.chat.id);
      await openChat(data.chat.id, { markRead: true, forceScroll: true });
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleGroupUser(user) {
    setGroupSelectedUsers((prev) =>
      prev.some((item) => item.id === user.id)
        ? prev.filter((item) => item.id !== user.id)
        : [...prev, user]
    );
  }

  async function createGroupChat() {
    try {
      setError("");
      if (!groupTitle.trim()) {
        pushToast("Введите название группы");
        return;
      }
      if (groupSelectedUsers.length < 2) {
        pushToast("Выберите минимум двух собеседников");
        return;
      }

      const data = await api.createGroupChat({
        title: groupTitle.trim(),
        userIds: groupSelectedUsers.map((user) => user.id),
      });

      setGroupOpen(false);
      setGroupTitle("");
      setGroupQuery("");
      setGroupResults([]);
      setGroupSelectedUsers([]);
      await fetchChats(data.chat.id);
      await openChat(data.chat.id, { markRead: true, forceScroll: true });
      pushToast("Группа создана");
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendText(text, replyToMessageId) {
    if (!activeChat || !text.trim()) return;
    if (activeChatSecurity.mode !== "enabled") {
      await api.sendTextMessage(activeChat.id, { text: text.trim(), replyToMessageId });
      await refreshActiveChat({ forceScroll: true });
      return;
    }

    const encrypted = await encryptTextMessage({ text: text.trim(), chat: activeChat });
    await api.sendTextMessage(activeChat.id, { ...encrypted, replyToMessageId });
    await refreshActiveChat({ forceScroll: true });
  }

  async function sendAttachment(files, caption = "", replyToMessageId) {
    if (!activeChat || !files?.length) return;
    const trimmedCaption = caption.trim();
    let captionUsed = false;

    const images = files.filter((file) => file.type.startsWith("image/"));
    const videos = files.filter((file) => file.type.startsWith("video/"));
    const otherFiles = files.filter(
      (file) => !file.type.startsWith("image/") && !file.type.startsWith("video/")
    );

    if (activeChatSecurity.mode !== "enabled") {
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach((file) => formData.append("file", file));
        if (trimmedCaption) {
          formData.append("text", trimmedCaption);
          captionUsed = true;
        }
        if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
        await api.sendImageMessage(activeChat.id, formData);
      }

      for (const file of videos) {
        const formData = new FormData();
        formData.append("file", file);
        if (trimmedCaption && !captionUsed) {
          formData.append("text", trimmedCaption);
          captionUsed = true;
        }
        if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
        await api.sendVideoMessage(activeChat.id, formData);
      }

      for (const file of otherFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (trimmedCaption && !captionUsed) {
          formData.append("text", trimmedCaption);
          captionUsed = true;
        }
        if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
        await api.sendFileMessage(activeChat.id, formData);
      }

      await refreshActiveChat({ forceScroll: true });
      return;
    }

    if (images.length > 0) {
      const encrypted = await encryptAttachmentMessage({
        chat: activeChat,
        caption: trimmedCaption,
        files: images,
      });
      const formData = new FormData();
      encrypted.encryptedFiles.forEach((file) => formData.append("file", file));
      formData.append("encryptedPayload", encrypted.encryptedPayload);
      formData.append("encryptionMeta", encrypted.encryptionMeta);
      captionUsed = trimmedCaption.length > 0;
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendImageMessage(activeChat.id, formData);
    }

    for (const file of videos) {
      const encrypted = await encryptAttachmentMessage({
        chat: activeChat,
        caption: trimmedCaption && !captionUsed ? trimmedCaption : "",
        files: [file],
      });
      const formData = new FormData();
      formData.append("file", encrypted.encryptedFiles[0]);
      formData.append("encryptedPayload", encrypted.encryptedPayload);
      formData.append("encryptionMeta", encrypted.encryptionMeta);
      if (trimmedCaption && !captionUsed) captionUsed = true;
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendVideoMessage(activeChat.id, formData);
    }

    for (const file of otherFiles) {
      const encrypted = await encryptAttachmentMessage({
        chat: activeChat,
        caption: trimmedCaption && !captionUsed ? trimmedCaption : "",
        files: [file],
      });
      const formData = new FormData();
      formData.append("file", encrypted.encryptedFiles[0]);
      formData.append("encryptedPayload", encrypted.encryptedPayload);
      formData.append("encryptionMeta", encrypted.encryptionMeta);
      if (trimmedCaption && !captionUsed) captionUsed = true;
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendFileMessage(activeChat.id, formData);
    }

    await refreshActiveChat({ forceScroll: true });
  }

  async function sendVoice(blob, durationSec, replyToMessageId) {
    if (!activeChat || !blob) return;
    if (activeChatSecurity.mode !== "enabled") {
      const formData = new FormData();
      formData.append("file", blob, `voice-${Date.now()}.webm`);
      formData.append("durationSec", String(durationSec || 0));
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendVoiceMessage(activeChat.id, formData);
      await refreshActiveChat({ forceScroll: true });
      return;
    }

    const voiceFile = new File([blob], `voice-${Date.now()}.webm`, {
      type: blob.type || "audio/webm",
    });
    const encrypted = await encryptAttachmentMessage({
      chat: activeChat,
      files: [voiceFile],
      durationSec: Number(durationSec || 0),
    });
    const formData = new FormData();
    formData.append("file", encrypted.encryptedFiles[0]);
    formData.append("encryptedPayload", encrypted.encryptedPayload);
    formData.append("encryptionMeta", encrypted.encryptionMeta);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
    await api.sendVoiceMessage(activeChat.id, formData);
    await refreshActiveChat({ forceScroll: true });
  }

  async function refreshActiveChat(options = {}) {
    if (!activeChat) return;
    await fetchChats(activeChat.id);
    await openChat(activeChat.id, { markRead: false, forceScroll: false, ...options });
  }

  async function editMessage(message) {
    setEditDialog({
      message,
      text: message.text,
    });
  }

  async function deleteMessage(message) {
    setConfirmDialog({
      message,
      title: message.grouped ? "Удалить группу фото?" : "Удалить сообщение?",
      description: message.grouped
        ? "Все изображения в этой группе будут удалены."
        : "Сообщение исчезнет из диалога.",
    });
  }

  async function confirmDeleteMessage() {
    if (!confirmDialog?.message) return;

    const { message } = confirmDialog;
    if (message.grouped && Array.isArray(message.items) && message.items.length > 0) {
      for (const item of message.items) {
        await api.deleteMessage(item.id);
      }
    } else {
      await api.deleteMessage(message.id);
    }

    setConfirmDialog(null);
    await refreshActiveChat();
    pushToast(message.grouped ? "Группа фото удалена" : "Сообщение удалено");
  }

  async function submitEditMessage() {
    if (!editDialog?.message) return;

    const nextText = editDialog.text.trim();
    if (!nextText || nextText === editDialog.message.text) {
      setEditDialog(null);
      return;
    }

    if (activeChatSecurity.mode !== "enabled") {
      await api.editMessage(editDialog.message.id, { text: nextText });
    } else {
      const encrypted = await encryptTextMessage({ text: nextText, chat: activeChat });
      await api.editMessage(editDialog.message.id, encrypted);
    }
    setEditDialog(null);
    await refreshActiveChat();
    pushToast("Сообщение обновлено");
  }

  async function saveProfile(event) {
    event.preventDefault();

    try {
      const data = await api.updateProfile(profileDraft);
      applyUserSession(data.user);
      setProfileEditorOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api.uploadAvatar(formData);
      applyUserSession(data.user);
      pushToast("Аватар обновлен");
    } catch (err) {
      setError(err.message);
    }
  }

  function openImageViewer(items, index = 0) {
    if (!items?.length) return;
    setImageViewer({ items, index });
  }

  function pushToast(message) {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message }]);
  }

  function handleSidebarTabChange(nextTab) {
    setSidebarTab(nextTab);
    if (isMobile) {
      setMobileScreen("sidebar");
    }
  }

  function handleMobileBack() {
    setMobileScreen("sidebar");
  }

  if (booting) {
    return <div className="boot-screen">Подготавливаем приложение...</div>;
  }

  if (!currentUser) {
    return (
      <AuthScreen
        authMode={authMode}
        error={error}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div
      className={`app-shell ${isMobile ? "is-mobile" : ""} ${
        isMobile && sidebarTab === "chats" && mobileScreen === "chat"
          ? "mobile-chat-open"
          : "mobile-sidebar-open"
      }`}
    >
      <Sidebar
        currentUser={currentUser}
        chats={chats}
        activeChatId={activeChat?.id}
        activeTab={sidebarTab}
        error={error}
        onTabChange={handleSidebarTabChange}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenGroup={() => setGroupOpen(true)}
        onOpenChat={(chatId) => openChat(chatId, { markRead: true, forceScroll: true })}
      />

      <main className="chat-panel">
        {sidebarTab === "calls" ? (
          <div className="empty-stage empty-stage-compact">
            <p className="eyebrow">Раздел в работе</p>
            <h2>Звонки появятся позже</h2>
            <p>Пока здесь ничего не добавлено, переключение между вкладками уже работает.</p>
          </div>
        ) : activeChat ? (
          <>
            <ChatHeader
              chat={activeChat}
              activeTyping={activeTyping}
              loading={loadingChatId === activeChat.id}
              securityState={activeChatSecurity}
              onOpenE2EE={() => setE2eeModalOpen(true)}
              onOpenProfile={() => setPeerProfileOpen(true)}
              onBack={isMobile ? handleMobileBack : undefined}
            />

            <MessageList
              chatId={activeChat.id}
              currentUser={currentUser}
              messages={messages}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onOpenImage={openImageViewer}
              forceScroll={Boolean(activeChat.forceScroll)}
            />

            <Composer
              chatId={activeChat.id}
              isDisabled={!activeChatSecurity.canSend}
              inputPlaceholder={activeChatSecurity.composerPlaceholder}
              disabledTitle={activeChatSecurity.disabledTitle}
              onSendText={sendText}
              onSendAttachment={sendAttachment}
              onSendVoice={sendVoice}
              onTyping={async (typing) => {
                try {
                  await api.sendTyping(activeChat.id, typing);
                } catch {
                  return null;
                }
                return null;
              }}
            />
          </>
        ) : (
          <div className="empty-stage">
            <p className="eyebrow">Рабочее пространство готово</p>
            <h2>{welcomeChat ? "Выберите чат слева" : "Начните с нового чата"}</h2>
            <p>
              В этой версии есть авторизация, поиск пользователей, личные чаты,
              текстовые, фото и голосовые сообщения, а также редактирование и удаление.
            </p>
          </div>
        )}
      </main>

      <SearchModal
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        onClose={() => setSearchOpen(false)}
        onQueryChange={setSearchQuery}
        onStartChat={startChat}
      />

      <GroupChatModal
        open={groupOpen}
        title={groupTitle}
        query={groupQuery}
        results={groupResults}
        selectedUsers={groupSelectedUsers}
        onClose={() => setGroupOpen(false)}
        onTitleChange={setGroupTitle}
        onQueryChange={setGroupQuery}
        onToggleUser={toggleGroupUser}
        onCreate={createGroupChat}
      />

      <ProfileModal
        open={profileOpen}
        user={currentUser}
        theme={theme}
        onClose={() => setProfileOpen(false)}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        onLogout={handleLogout}
        onEdit={() => {
          setProfileOpen(false);
          setProfileEditorOpen(true);
        }}
      />

      <ProfileEditorModal
        open={profileEditorOpen}
        draft={profileDraft}
        onClose={() => setProfileEditorOpen(false)}
        onChange={setProfileDraft}
        onSubmit={saveProfile}
        onAvatarUpload={uploadAvatar}
      />

      <PeerProfileModal
        open={peerProfileOpen}
        chat={activeChat}
        onClose={() => setPeerProfileOpen(false)}
      />

      <ImageViewerModal
        viewer={imageViewer}
        onClose={() => setImageViewer(null)}
        onPrev={() => setImageViewer((prev) => moveImageViewer(prev, -1))}
        onNext={() => setImageViewer((prev) => moveImageViewer(prev, 1))}
      />

      <ConfirmModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        description={confirmDialog?.description}
        confirmLabel="Удалить"
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDeleteMessage}
      />

      <EditMessageModal
        open={Boolean(editDialog)}
        value={editDialog?.text || ""}
        onClose={() => setEditDialog(null)}
        onChange={(value) =>
          setEditDialog((prev) => (prev ? { ...prev, text: value } : prev))
        }
        onSubmit={submitEditMessage}
      />

      <E2EEModal
        open={e2eeModalOpen}
        mode={activeChatSecurity.mode}
        onClose={() => setE2eeModalOpen(false)}
        onConfirm={enableE2EEForActiveChat}
      />

      <ToastViewport toasts={toasts} />
    </div>
  );
}

function moveImageViewer(viewer, delta) {
  if (!viewer || !viewer.items?.length) return viewer;
  const length = viewer.items.length;
  const nextIndex = (viewer.index + delta + length) % length;
  return { ...viewer, index: nextIndex };
}

function upsertMessage(items, nextMessage) {
  if (!nextMessage?.chatId) return items;
  if (items.some((item) => Number(item.chatId) !== Number(nextMessage.chatId))) {
    return items;
  }

  const index = items.findIndex((item) => item.id === nextMessage.id);
  if (index >= 0) {
    return items.map((item) => (item.id === nextMessage.id ? nextMessage : item));
  }
  return [...items, nextMessage].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function getChatSecurityState(chat, currentUser, e2eeError) {
  if (!chat) {
    return {
      mode: "inactive",
      canSend: false,
      headerLabel: "E2EE",
      composerPlaceholder: "Напишите сообщение",
      disabledTitle: "",
    };
  }

  if (e2eeError) {
    return {
      mode: chat.e2eeEnabled ? "device-error" : "inactive",
      canSend: !chat.e2eeEnabled,
      headerLabel: chat.e2eeEnabled
        ? "E2EE недоступно на этом устройстве"
        : "Включить E2EE",
      composerPlaceholder: chat.e2eeEnabled
        ? "Защищенная отправка временно недоступна"
        : "Напишите сообщение",
      disabledTitle: chat.e2eeEnabled ? e2eeError : "",
    };
  }

  if (!chat.e2eeEnabled) {
    return {
      mode: "inactive",
      canSend: true,
      headerLabel: "Включить E2EE",
      composerPlaceholder: "Напишите сообщение",
      disabledTitle: "",
    };
  }

  const hasOwnKey = hasLocalPrivateKey(currentUser?.id);
  if (hasOwnKey && canEncryptForChat(chat)) {
    return {
      mode: "enabled",
      canSend: true,
      headerLabel: "E2EE включено",
      composerPlaceholder: "Напишите защищенное сообщение",
      disabledTitle: "",
    };
  }

  return {
    mode: "pending",
    canSend: false,
    headerLabel: "E2EE включено",
    composerPlaceholder: "Ожидаем ключи участников",
    disabledTitle: "",
  };
}
