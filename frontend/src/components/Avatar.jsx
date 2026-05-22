import { normalizeMediaUrl } from "../utils/mediaUrls";

export default function Avatar({ user, showOnline = false }) {
  let avatarNode = <div className="avatar avatar-fallback">?</div>;

  if (user) {
    if (user.avatarUrl) {
      avatarNode = <img className="avatar" src={normalizeMediaUrl(user.avatarUrl)} alt={user.name} />;
    } else {
      const label = (user.name || "?")
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      avatarNode = <div className="avatar avatar-fallback">{label}</div>;
    }
  }

  if (!showOnline) return avatarNode;

  return (
    <span className="avatar-wrap avatar-wrap--online">
      {avatarNode}
      <span className="avatar-online-dot" aria-hidden="true" />
    </span>
  );
}
