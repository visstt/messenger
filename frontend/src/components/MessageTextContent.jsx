import { useState } from "react";
import GroupInviteCard from "./GroupInviteCard";
import { isGroupInviteUrl, parseInviteTokenFromUrl } from "../utils/groupInvite";
import { splitTextWithUrls } from "../utils/messageLinks";

export default function MessageTextContent({ text, className, onJoinGroupInvite }) {
  const [joiningToken, setJoiningToken] = useState(null);

  if (!text) return null;

  const segments = splitTextWithUrls(text);
  const renderedSegments = [];
  const seenInviteTokens = new Set();

  async function handleJoin(token) {
    if (!token || joiningToken || typeof onJoinGroupInvite !== "function") return;
    setJoiningToken(token);
    try {
      await onJoinGroupInvite(token);
    } finally {
      setJoiningToken(null);
    }
  }

  segments.forEach((segment, index) => {
    if (segment.type === "text") {
      if (!segment.value) return;
      renderedSegments.push(
        <span key={`text-${index}`} className="message-text-plain">
          {segment.value}
        </span>
      );
      return;
    }

    const inviteToken = parseInviteTokenFromUrl(segment.href);
    if (inviteToken && isGroupInviteUrl(segment.href) && !seenInviteTokens.has(inviteToken)) {
      seenInviteTokens.add(inviteToken);
      renderedSegments.push(
        <GroupInviteCard
          key={`invite-${inviteToken}-${index}`}
          token={inviteToken}
          joining={joiningToken === inviteToken}
          onJoin={handleJoin}
        />
      );
      return;
    }

    renderedSegments.push(
      <a
        key={`url-${index}`}
        className="message-link"
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {segment.value}
      </a>
    );
  });

  return <div className={className || "message-text-content"}>{renderedSegments}</div>;
}
