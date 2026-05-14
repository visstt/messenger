import { normalizeMediaUrl } from "../utils/mediaUrls";

export default function Avatar({ user }) {
  if (!user) {
    return <div className="avatar avatar-fallback">?</div>;
  }

  if (user.avatarUrl) {
    return <img className="avatar" src={normalizeMediaUrl(user.avatarUrl)} alt={user.name} />;
  }

  const label = (user.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return <div className="avatar avatar-fallback">{label}</div>;
}
