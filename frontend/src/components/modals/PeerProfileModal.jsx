import { FiAtSign, FiImage, FiUsers, FiUser, FiX } from "react-icons/fi";
import Avatar from "../Avatar";
import { getChatAvatar, getChatSubtitle, getChatTitle } from "../../utils/chats";

export default function PeerProfileModal({ open, chat, onClose }) {
  if (!open || !chat) return null;

  const isGroup = chat.kind === "group";
  const peer = chat.peer;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card profile-showcase" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="ghost-button profile-close"
          onClick={onClose}
          aria-label="Закрыть профиль"
        >
          <FiX />
        </button>
        <div className="profile-hero">
          <div className="profile-hero-avatar">
            <Avatar user={getChatAvatar(chat)} />
          </div>
          <div className="profile-hero-copy">
            <p className="eyebrow">{isGroup ? "Групповой чат" : "Профиль собеседника"}</p>
            <h3>{getChatTitle(chat)}</h3>
            <p>{getChatSubtitle(chat)}</p>
            <span>
              {isGroup
                ? "Участники группы видят общую историю и получают сообщения одновременно."
                : peer?.bio || "Пользователь пока не добавил описание."}
            </span>
          </div>
        </div>

        {isGroup ? (
          <div className="group-member-list">
            {chat.participants?.map((user) => (
              <div className="group-member" key={user.id}>
                <Avatar user={user} />
                <div>
                  <strong>{user.name}</strong>
                  <span>@{user.username}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-facts">
            <div className="profile-fact">
              <FiUser />
              <div>
                <strong>Имя</strong>
                <span>{peer?.name}</span>
              </div>
            </div>
            <div className="profile-fact">
              <FiAtSign />
              <div>
                <strong>Username</strong>
                <span>@{peer?.username}</span>
              </div>
            </div>
            <div className="profile-fact">
              <FiImage />
              <div>
                <strong>Диалог</strong>
                <span>Личный чат</span>
              </div>
            </div>
          </div>
        )}

        {isGroup && (
          <div className="profile-facts">
            <div className="profile-fact">
              <FiUsers />
              <div>
                <strong>Участники</strong>
                <span>{chat.participants?.length || 0}</span>
              </div>
            </div>
            <div className="profile-fact">
              <FiImage />
              <div>
                <strong>Тип</strong>
                <span>Групповой чат</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
