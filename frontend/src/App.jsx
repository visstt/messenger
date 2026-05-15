import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatHeader from "./components/ChatHeader";
import CallOverlay from "./components/CallOverlay";
import Composer from "./components/Composer";
import IncomingCallModal from "./components/IncomingCallModal";
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
import ForwardMessageModal from "./components/modals/ForwardMessageModal";
import ToastViewport from "./components/ToastViewport";
import { api } from "./lib/api";
import { decryptMessage, ensureDeviceKeys } from "./lib/e2ee";
import {
  registerNotificationServiceWorker,
  requestNotificationPermission,
  setUnreadTitle,
  shouldNotifyWhenMessageArrives,
  showMessageNotification,
} from "./utils/browserNotifications";
import { getChatTitle } from "./utils/chats";
import { parseAttachmentItems, parseImageItems, renderPreview } from "./utils/messages";
import { normalizeMediaUrl } from "./utils/mediaUrls";
import { useSwipeBack } from "./hooks/useSwipeBack";

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
  const [replyDraft, setReplyDraft] = useState(null);
  const [forwardDraft, setForwardDraft] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [profileDraft, setProfileDraft] = useState(emptyProfile);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const socketRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const manualMobileExitRef = useRef(false);
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const chatsRef = useRef([]);
  const decryptedCacheRef = useRef(new Map());

  const handleMobileBack = useCallback(() => {
    // Keep current chat state for instant return, but block auto-reopen on mobile.
    manualMobileExitRef.current = true;
    activeChatIdRef.current = null;
    setReplyDraft(null);
    setMobileScreen("sidebar");
  }, []);

  const mobileChatOpen = isMobile && Boolean(activeChat) && mobileScreen === "chat";
  const swipeBackRef = useSwipeBack(mobileChatOpen, handleMobileBack);

  const activeTyping = activeChat ? typingState[activeChat.id] : false;
  const welcomeChat = useMemo(() => chats[0], [chats]);
  const activeChatSecurity = useMemo(() => getChatSecurityState(activeChat), [activeChat]);

  useEffect(() => {
    activeChatIdRef.current = activeChat?.id ?? null;
  }, [activeChat?.id]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    setUnreadTitle(unreadNotificationCount);
  }, [unreadNotificationCount]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadNotificationCount(0);
      setUnreadTitle(0);
      return undefined;
    }

    registerNotificationServiceWorker();
    const requestOnInteraction = () => requestNotificationPermission();
    const resetUnread = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        setUnreadNotificationCount(0);
      }
    };

    window.addEventListener("pointerdown", requestOnInteraction, { once: true });
    window.addEventListener("keydown", requestOnInteraction, { once: true });
    window.addEventListener("focus", resetUnread);
    document.addEventListener("visibilitychange", resetUnread);

    return () => {
      window.removeEventListener("pointerdown", requestOnInteraction);
      window.removeEventListener("keydown", requestOnInteraction);
      window.removeEventListener("focus", resetUnread);
      document.removeEventListener("visibilitychange", resetUnread);
    };
  }, [currentUser]);

  useEffect(() => {
    setReplyDraft(null);
  }, [activeChat?.id]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("messenger-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    let frame = null;

    function applyHeight(nextHeight) {
      root.style.setProperty("--app-height", `${Math.round(nextHeight)}px`);
    }

    function syncViewportHeight() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const nextHeight = viewport
          ? viewport.height + viewport.offsetTop
          : window.innerHeight;
        applyHeight(nextHeight);
      });
    }

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.addEventListener("orientationchange", syncViewportHeight);
    window.visualViewport?.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("scroll", syncViewportHeight);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("orientationchange", syncViewportHeight);
      window.visualViewport?.removeEventListener("resize", syncViewportHeight);
      window.visualViewport?.removeEventListener("scroll", syncViewportHeight);
      root.style.removeProperty("--app-height");
    };
  }, []);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) {
        manualMobileExitRef.current = false;
        if (activeChat?.id) {
          activeChatIdRef.current = Number(activeChat.id);
        }
        setMobileScreen("sidebar");
      } else if (!activeChat) {
        setMobileScreen("sidebar");
      }
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [activeChat]);

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
          const isIncomingMessage =
            currentUser && Number(message.senderId) !== Number(currentUser.id);

          if (isActiveChatMessage) {
            setMessages((prev) => upsertMessage(prev, message));
            if (message.senderId !== currentUser.id && message.kind !== "system") {
              api.markRead(eventChatId).catch(() => null);
            }
          }
          if (isIncomingMessage && shouldNotifyWhenMessageArrives()) {
            notifyIncomingMessage(message, eventChatId);
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

        if (payload.type === "call:incoming") {
          if (Number(payload.data.from?.id) === Number(currentUser.id)) return;
          setIncomingCall(payload.data);
        }

        if (payload.type === "call:accepted") {
          const currentCall = activeCallRef.current;
          if (currentCall?.callId === payload.data.callId) {
            pushToast(`${payload.data.from?.name || "Собеседник"} присоединился к звонку`);
            setActiveCall({ ...currentCall, status: "active" });
          }
        }

        if (payload.type === "call:declined") {
          const currentCall = activeCallRef.current;
          const currentIncomingCall = incomingCallRef.current;
          if (currentCall?.callId === payload.data.callId) {
            pushToast(`${payload.data.from?.name || "Собеседник"} отклонил звонок`);
            activeCallRef.current = null;
            setActiveCall(null);
          }
          if (currentIncomingCall?.callId === payload.data.callId) {
            pushToast("Звонок завершен");
            incomingCallRef.current = null;
            setIncomingCall(null);
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
        const canAutoReopen = !(isMobile && manualMobileExitRef.current);
        const chatIdForRefresh = activeChatIdRef.current;

        if (chatIdForRefresh && canAutoReopen) {
          await fetchChats(chatIdForRefresh, { syncActive: true });
          await openChat(chatIdForRefresh, {
            markRead: false,
            forceScroll: false,
            silent: true,
          });
        } else {
          await fetchChats(chatIdForRefresh, { syncActive: false });
        }
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
  }, [currentUser, isMobile]);

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
      return secureUser;
    } catch {
      applyUserSession(user);
      return user;
    }
  }

  async function hydrateMessage(message, options = {}) {
    if (!message || !currentUser || message.kind === "system") return message;
    const cacheKey = getMessageCacheKey(message);
    const fingerprint = getMessageFingerprint(message, options);
    const cached = decryptedCacheRef.current.get(cacheKey);

    if (cached && cached.fingerprint === fingerprint) {
      return cached.value;
    }

    const decrypted = normalizeForwardedMessage(
      await decryptMessage(message, currentUser.id, options)
    );

    if (decrypted.e2eeState === "ready") {
      storeCachedMessage(decryptedCacheRef.current, cacheKey, fingerprint, decrypted);
      return decrypted;
    }

    if (cached && cached.fingerprint === fingerprint) {
      return cached.value;
    }

    return decrypted;
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
    const { markRead = true, forceScroll = false, silent = false } = options;
    if (!chatId) return;

    manualMobileExitRef.current = false;
    activeChatIdRef.current = Number(chatId);
    if (!silent) {
      setLoadingChatId(chatId);
    }

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
      if (!silent) {
        setLoadingChatId(null);
      }
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
    disposeCachedMessages(decryptedCacheRef.current);
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

  async function sendTextToChat(chat, text, replyToMessageId) {
    if (!chat || !text.trim()) return;
    await api.sendTextMessage(chat.id, { text: text.trim(), replyToMessageId });
  }

  async function sendAttachmentToChat(chat, files, caption = "", replyToMessageId) {
    if (!chat || !files?.length) return;
    const trimmedCaption = caption.trim();
    let captionUsed = false;

    const images = files.filter((file) => file.type.startsWith("image/"));
    const videos = files.filter((file) => file.type.startsWith("video/"));
    const otherFiles = files.filter(
      (file) => !file.type.startsWith("image/") && !file.type.startsWith("video/")
    );

    if (images.length > 0) {
      const formData = new FormData();
      images.forEach((file) => formData.append("file", file));
      if (trimmedCaption) {
        formData.append("text", trimmedCaption);
        captionUsed = true;
      }
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendImageMessage(chat.id, formData);
    }

    for (const file of videos) {
      const formData = new FormData();
      formData.append("file", file);
      if (trimmedCaption && !captionUsed) {
        formData.append("text", trimmedCaption);
        captionUsed = true;
      }
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendVideoMessage(chat.id, formData);
    }

    for (const file of otherFiles) {
      const formData = new FormData();
      formData.append("file", file);
      if (trimmedCaption && !captionUsed) {
        formData.append("text", trimmedCaption);
        captionUsed = true;
      }
      if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
      await api.sendFileMessage(chat.id, formData);
    }
  }

  async function sendVoiceToChat(chat, blob, durationSec, replyToMessageId, caption = "") {
    if (!chat || !blob) return;
    const trimmedCaption = caption.trim();
    const formData = new FormData();
    formData.append("file", blob, `voice-${Date.now()}.webm`);
    formData.append("durationSec", String(durationSec || 0));
    if (trimmedCaption) formData.append("text", trimmedCaption);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
    await api.sendVoiceMessage(chat.id, formData);
  }

  async function sendVideoNoteToChat(chat, file, replyToMessageId, caption = "") {
    if (!chat || !file) return;
    const trimmedCaption = caption.trim();
    const formData = new FormData();
    formData.append("file", file);
    if (trimmedCaption) formData.append("text", trimmedCaption);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
    await api.sendVideoNoteMessage(chat.id, formData);
  }

  async function sendText(text, replyToMessageId) {
    if (!activeChat || !text.trim()) return;
    await sendTextToChat(activeChat, text, replyToMessageId);
    setReplyDraft(null);
    await refreshActiveChat({ forceScroll: true });
  }

  async function sendAttachment(files, caption = "", replyToMessageId) {
    if (!activeChat || !files?.length) return;
    await sendAttachmentToChat(activeChat, files, caption, replyToMessageId);
    setReplyDraft(null);
    await refreshActiveChat({ forceScroll: true });
  }

  async function sendVoice(blob, durationSec, replyToMessageId) {
    if (!activeChat || !blob) return;
    await sendVoiceToChat(activeChat, blob, durationSec, replyToMessageId);
    setReplyDraft(null);
    await refreshActiveChat({ forceScroll: true });
  }

  async function sendVideoNote(file, replyToMessageId) {
    if (!activeChat || !file) return;
    await sendVideoNoteToChat(activeChat, file, replyToMessageId);
    setReplyDraft(null);
    await refreshActiveChat({ forceScroll: true });
  }

  async function refreshActiveChat(options = {}) {
    if (!activeChat) return;
    await fetchChats(activeChat.id);
    await openChat(activeChat.id, { markRead: false, forceScroll: false, ...options });
  }

  async function forwardMessageToChat(message, targetChatId) {
    const targetChat = chats.find((chat) => Number(chat.id) === Number(targetChatId));
    if (!targetChat || !message) return;
    const forwardedText = buildForwardedText(message);
    try {
      if (message.kind === "text") {
        await sendTextToChat(targetChat, forwardedText);
      }

      if (message.kind === "image") {
        const files = await buildFilesFromImageMessage(message);
        await sendAttachmentToChat(targetChat, files, forwardedText);
      }

      if (message.kind === "video" || message.kind === "file") {
        const files = await buildFilesFromAttachmentMessage(message);
        await sendAttachmentToChat(targetChat, files, forwardedText);
      }

      if (message.kind === "video_note") {
        const [item] = parseAttachmentItems(message);
        if (item?.src) {
          const blob = await fetchBlob(item.src);
          const file = new File([blob], item.name || `video-note-${Date.now()}.mp4`, {
            type: blob.type || guessFileMimeType(item.name),
          });
          await sendVideoNoteToChat(targetChat, file, undefined, forwardedText);
        }
      }

      if (message.kind === "voice") {
        const [item] = parseAttachmentItems(message);
        if (item?.src) {
          const blob = await fetchBlob(item.src);
          await sendVoiceToChat(targetChat, blob, message.durationSec || 0, undefined, forwardedText);
        }
      }

      setForwardDraft(null);
      pushToast("Сообщение переслано");

      await fetchChats(targetChat.id);
      await openChat(targetChat.id, { markRead: true, forceScroll: true });
    } catch (err) {
      setError(err.message);
    }
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

  async function togglePinMessage(message) {
    if (!message || message.deletedAt) return;

    if (message.pinnedAt) {
      await api.unpinMessage(message.id);
      pushToast("Сообщение откреплено");
    } else {
      await api.pinMessage(message.id);
      pushToast("Сообщение закреплено");
    }
    await refreshActiveChat();
  }

  async function startCall(kind) {
    if (!activeChat) return;

    try {
      const callId = createCallId(activeChat.id);
      const data = await api.createCallToken(activeChat.id, { kind });
      await api.inviteCall(activeChat.id, { callId, kind });
      setActiveCall({
        ...data,
        callId,
        kind,
        status: "dialing",
        chat: data.chat || activeChat,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function acceptIncomingCall() {
    if (!incomingCall?.chat?.id) return;

    const call = incomingCall;
    try {
      await api.acceptCall(call.chat.id, { callId: call.callId, kind: call.kind });
      const data = await api.createCallToken(call.chat.id, { kind: call.kind });
      setIncomingCall(null);
      setActiveCall({
        ...data,
        callId: call.callId,
        kind: call.kind,
        status: "active",
        chat: data.chat || call.chat,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function declineIncomingCall() {
    if (!incomingCall?.chat?.id) return;

    const call = incomingCall;
    setIncomingCall(null);
    try {
      await api.declineCall(call.chat.id, { callId: call.callId, kind: call.kind });
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeActiveCall() {
    const call = activeCallRef.current;
    activeCallRef.current = null;
    setActiveCall(null);
    if (!call?.chat?.id || !call?.callId) return;

    try {
      await api.declineCall(call.chat.id, { callId: call.callId, kind: call.kind });
    } catch (err) {
      setError(err.message);
    }
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

    await api.editMessage(editDialog.message.id, { text: nextText });
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

  function notifyIncomingMessage(message, chatId) {
    const chat = chatsRef.current.find((item) => Number(item.id) === Number(chatId));
    const title = chat ? getChatTitle(chat) : message.sender?.name || "Signal";
    const body = renderPreview(message);

    setUnreadNotificationCount((count) => count + 1);
    showMessageNotification({
      title,
      body,
      tag: `signal-chat-${chatId}`,
      onClick: () => {
        setUnreadNotificationCount(0);
        openChat(chatId, { markRead: true, forceScroll: true }).catch(() => null);
      },
    });
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
      className={`tg-app ${isMobile ? "is-mobile" : ""} ${
        isMobile && mobileScreen === "chat"
          ? "mobile-chat-open"
          : "mobile-sidebar-open"
      }`}
    >
      <Sidebar
        currentUser={currentUser}
        chats={chats}
        activeChatId={activeChat?.id}
        error={error}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenGroup={() => setGroupOpen(true)}
        onOpenChat={(chatId) => openChat(chatId, { markRead: true, forceScroll: true })}
      />

      <main
        className={`tg-chat-area${mobileChatOpen ? " tg-chat-area--mobile-open" : ""}`}
      >
        {activeChat ? (
          <div
            className="tg-chat-stack"
            ref={swipeBackRef}
            data-mobile-chat={mobileChatOpen ? "true" : undefined}
          >
            <ChatHeader
              chat={activeChat}
              activeTyping={activeTyping}
              loading={loadingChatId === activeChat.id}
              onOpenProfile={() => setPeerProfileOpen(true)}
              onStartCall={startCall}
              onBack={isMobile ? handleMobileBack : undefined}
            />

            <MessageList
              chatId={activeChat.id}
              currentUser={currentUser}
              messages={messages}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onReply={(message) => setReplyDraft(message)}
              onForward={(message) => setForwardDraft(message)}
              onTogglePin={togglePinMessage}
              onOpenImage={openImageViewer}
              forceScroll={Boolean(activeChat.forceScroll)}
            />

            <Composer
              chatId={activeChat.id}
              isDisabled={!activeChatSecurity.canSend}
              inputPlaceholder={activeChatSecurity.composerPlaceholder}
              disabledTitle={activeChatSecurity.disabledTitle}
              replyMessage={replyDraft}
              replyPreview={replyDraft ? renderPreview(replyDraft) : ""}
              onCancelReply={() => setReplyDraft(null)}
              onSendText={sendText}
              onSendAttachment={sendAttachment}
              onSendVoice={sendVoice}
              onSendVideoNote={sendVideoNote}
              onTyping={async (typing) => {
                try {
                  await api.sendTyping(activeChat.id, typing);
                } catch {
                  return null;
                }
                return null;
              }}
            />
          </div>
        ) : (
          <div className="tg-stage">
            <p className="tg-eyebrow">Рабочее пространство готово</p>
            <h2 className="tg-stage-title">
              {welcomeChat ? "Выберите чат слева" : "Начните с нового чата"}
            </h2>
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

      <ForwardMessageModal
        open={Boolean(forwardDraft)}
        chats={chats}
        activeChatId={activeChat?.id}
        onClose={() => setForwardDraft(null)}
        onForward={(targetChatId) => forwardMessageToChat(forwardDraft, targetChatId)}
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
        messages={messages}
        onClose={() => setPeerProfileOpen(false)}
        onOpenImage={(items, index) => setImageViewer({ items, index })}
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

      <IncomingCallModal
        call={incomingCall}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
      />
      <CallOverlay call={activeCall} onClose={closeActiveCall} />
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

async function buildFilesFromImageMessage(message) {
  const files = [];
  const imageItems = parseImageItems(message);

  for (let index = 0; index < imageItems.length; index += 1) {
    const item = imageItems[index];
    const blob = await fetchBlob(item.src);
    files.push(
      new File([blob], item.alt || `image-${index + 1}.jpg`, {
        type: blob.type || "image/jpeg",
      })
    );
  }

  return files;
}

async function buildFilesFromAttachmentMessage(message) {
  const files = [];
  const items = parseAttachmentItems(message);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const blob = await fetchBlob(item.src);
    files.push(
      new File([blob], item.name || `file-${index + 1}`, {
        type: blob.type || guessFileMimeType(item.name),
      })
    );
  }

  return files;
}

async function fetchBlob(src) {
  const response = await fetch(normalizeMediaUrl(src), { credentials: "omit" });
  return response.blob();
}

function guessFileMimeType(name = "") {
  const lower = name.toLowerCase();

  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

function createCallId(chatId) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `call-${chatId}-${crypto.randomUUID()}`;
  }
  return `call-${chatId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getChatSecurityState(chat) {
  if (!chat) {
    return {
      mode: "inactive",
      canSend: false,
      composerPlaceholder: "Напишите сообщение",
      disabledTitle: "",
    };
  }

  return {
    mode: "inactive",
    canSend: true,
    composerPlaceholder: "Напишите сообщение",
    disabledTitle: "",
  };
}

function getMessageCacheKey(message) {
  return `${message.chatId}:${message.id}`;
}

function getMessageFingerprint(message, options = {}) {
  return JSON.stringify({
    encryptedPayload: message.encryptedPayload || "",
    encryptionMeta: message.encryptionMeta || "",
    text: message.text || "",
    fileUrl: message.fileUrl || "",
    fileName: message.fileName || "",
    durationSec: message.durationSec || 0,
    deletedAt: message.deletedAt || "",
    includeFiles: Boolean(options.includeFiles),
  });
}

function storeCachedMessage(cache, key, fingerprint, value) {
  const previous = cache.get(key);
  if (previous && previous.fingerprint !== fingerprint) {
    revokeMessageObjectUrls(previous.value);
  }
  cache.set(key, { fingerprint, value });
}

function disposeCachedMessages(cache) {
  cache.forEach((entry) => revokeMessageObjectUrls(entry.value));
  cache.clear();
}

function revokeMessageObjectUrls(message) {
  if (!Array.isArray(message?.decryptedAttachments)) return;
  message.decryptedAttachments.forEach((item) => {
    if (item?.src?.startsWith?.("blob:")) {
      URL.revokeObjectURL(item.src);
    }
  });
}

const FORWARDED_PREFIX = "[[forwarded:";

function buildForwardedText(message) {
  const fromName = message.forwardedFromName || message.sender?.name || "Unknown";
  const safeFromName = String(fromName).replaceAll("]]", "").trim();
  const body = typeof message.text === "string" ? message.text.trim() : "";
  return `${FORWARDED_PREFIX}${safeFromName}]]${body ? `\n${body}` : ""}`;
}

function normalizeForwardedMessage(message) {
  if (!message || typeof message.text !== "string") return message;

  const match = message.text.match(/^\[\[forwarded:(.+?)\]\](?:\r?\n)?([\s\S]*)$/);
  if (!match) return message;

  const [, forwardedFromName, body] = match;
  return {
    ...message,
    forwardedFromName: forwardedFromName.trim(),
    text: body || "",
  };
}
