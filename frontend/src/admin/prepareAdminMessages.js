export function prepareAdminMessages(items) {
  return (items || []).map((message) => {
    const next = {
      ...message,
      reactions: message.reactions || [],
      status: message.status || "sent",
    };

    if (message.encryptedPayload) {
      next.e2eeState = "locked";
    }

    if (message.deletedAt && message.deletedContentAvailable) {
      next.adminDeletedSnapshot = true;
    }

    return next;
  });
}
