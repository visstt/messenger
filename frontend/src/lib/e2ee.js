const E2EE_STORAGE_PREFIX = "messenger-e2ee-keypair-v1:";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function ensureDeviceKeys(user, api) {
  const storedPair = loadStoredKeyPair(user.id);

  if (!storedPair) {
    if (user.publicKey) {
      throw new Error(
        "Для этого аккаунта уже включено сквозное шифрование, но локальный ключ на этом устройстве не найден."
      );
    }

    const pair = await generateAndStoreKeyPair(user.id);
    const response = await api.updatePublicKey(pair.publicKey);
    return response.user;
  }

  if (user.publicKey && user.publicKey !== storedPair.publicKey) {
    throw new Error(
      "Локальный ключ устройства не совпадает с ключом аккаунта. Для безопасности отправка зашифрованных сообщений отключена."
    );
  }

  if (!user.publicKey) {
    const response = await api.updatePublicKey(storedPair.publicKey);
    return response.user;
  }

  return user;
}

export function hasLocalPrivateKey(userId) {
  return Boolean(loadStoredKeyPair(userId));
}

export function canEncryptForChat(chat) {
  return Boolean(chat?.participants?.length) && chat.participants.every((user) => Boolean(user.publicKey));
}

export async function encryptTextMessage({ text, chat }) {
  const prepared = await encryptPayloadForChat(chat, {
    text,
    attachments: [],
  });

  return {
    text: "",
    encryptedPayload: prepared.encryptedPayload,
    encryptionMeta: prepared.encryptionMeta,
  };
}

export async function encryptAttachmentMessage({ chat, caption = "", files = [], durationSec = 0 }) {
  const prepared = await encryptPayloadForChat(chat, {
    text: caption,
    durationSec,
    attachments: files.map((file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size || 0,
      iv: arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(12))),
    })),
  });

  const encryptedFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const attachment = prepared.payload.attachments[index];
    const encryptedBytes = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: base64ToUint8Array(attachment.iv),
      },
      prepared.aesKey,
      await file.arrayBuffer()
    );

    encryptedFiles.push(
      new File([encryptedBytes], `${Date.now()}-${index}.bin`, {
        type: "application/octet-stream",
      })
    );
  }

  return {
    encryptedFiles,
    encryptedPayload: prepared.encryptedPayload,
    encryptionMeta: prepared.encryptionMeta,
  };
}

export async function decryptMessage(message, currentUserId, options = {}) {
  const { includeFiles = false } = options;
  if (!message?.encryptedPayload || !message?.encryptionMeta) {
    return { ...message, e2eeState: "plain" };
  }

  try {
    const { privateKey } = await getDeviceKeys(currentUserId);
    const meta = JSON.parse(message.encryptionMeta);
    const wrappedKey = meta?.keys?.[String(currentUserId)];
    if (!wrappedKey) {
      throw new Error("missing wrapped key");
    }

    const aesKeyRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToArrayBuffer(wrappedKey)
    );
    const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, "AES-GCM", false, [
      "decrypt",
    ]);
    const payloadBytes = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToUint8Array(meta.iv),
      },
      aesKey,
      base64ToArrayBuffer(message.encryptedPayload)
    );

    const payload = JSON.parse(textDecoder.decode(payloadBytes));
    const decrypted = {
      ...message,
      text: payload.text || "",
      durationSec: payload.durationSec || message.durationSec || 0,
      e2eeState: "ready",
      e2eePayload: payload,
      decryptedAttachments: payload.attachments || [],
    };

    if (!includeFiles || !payload.attachments?.length) {
      return decrypted;
    }

    const storedUrls = parseMaybeArray(message.fileUrl);
    const hydratedAttachments = [];

    for (let index = 0; index < payload.attachments.length; index += 1) {
      const attachment = payload.attachments[index];
      const encryptedUrl = storedUrls[index];
      if (!encryptedUrl) {
        hydratedAttachments.push(attachment);
        continue;
      }

      const response = await fetch(encryptedUrl, { credentials: "include" });
      const encryptedBuffer = await response.arrayBuffer();
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64ToUint8Array(attachment.iv),
        },
        aesKey,
        encryptedBuffer
      );
      const blob = new Blob([decryptedBuffer], {
        type: attachment.mimeType || "application/octet-stream",
      });

      hydratedAttachments.push({
        ...attachment,
        src: URL.createObjectURL(blob),
        encryptedUrl,
      });
    }

    return {
      ...decrypted,
      decryptedAttachments: hydratedAttachments,
    };
  } catch (error) {
    return {
      ...message,
      text: "",
      e2eeState: "locked",
      e2eeError: error instanceof Error ? error.message : "decrypt failed",
      decryptedAttachments: [],
    };
  }
}

async function encryptPayloadForChat(chat, payload) {
  if (!chat?.participants?.length) {
    throw new Error("Не удалось определить участников чата для шифрования.");
  }

  const participantKeys = await Promise.all(
    chat.participants.map(async (participant) => {
      if (!participant.publicKey) {
        throw new Error(`У пользователя ${participant.name} ещё не настроен ключ E2EE.`);
      }

      return {
        userId: participant.id,
        key: await importPublicKey(participant.publicKey),
      };
    })
  );

  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(JSON.stringify(payload))
  );

  const wrappedKeys = {};
  for (const participant of participantKeys) {
    const wrapped = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      participant.key,
      aesKeyRaw
    );
    wrappedKeys[String(participant.userId)] = arrayBufferToBase64(wrapped);
  }

  return {
    aesKey,
    payload,
    encryptedPayload: arrayBufferToBase64(ciphertext),
    encryptionMeta: JSON.stringify({
      version: 1,
      algorithm: "AES-GCM+RSA-OAEP-256",
      iv: arrayBufferToBase64(iv),
      keys: wrappedKeys,
    }),
  };
}

async function generateAndStoreKeyPair(userId) {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const stored = {
    publicKey: JSON.stringify(publicJwk),
    privateKey: JSON.stringify(privateJwk),
  };
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(stored));
  return stored;
}

async function getDeviceKeys(userId) {
  const stored = loadStoredKeyPair(userId);
  if (!stored) {
    throw new Error("Локальный приватный ключ не найден.");
  }

  return {
    publicKey: await importPublicKey(stored.publicKey),
    privateKey: await importPrivateKey(stored.privateKey),
  };
}

function loadStoredKeyPair(userId) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function importPublicKey(serialized) {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(serialized),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

async function importPrivateKey(serialized) {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(serialized),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

function getStorageKey(userId) {
  return `${E2EE_STORAGE_PREFIX}${userId}`;
}

function arrayBufferToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64ToArrayBuffer(value) {
  return base64ToUint8Array(value).buffer;
}

function base64ToUint8Array(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseMaybeArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [value];
  }
  return [value];
}
