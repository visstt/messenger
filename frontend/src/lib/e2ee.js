const E2EE_STORAGE_PREFIX = "messenger-e2ee-keypair-v1:";
const E2EE_DB_NAME = "messenger-e2ee";
const E2EE_DB_VERSION = 1;
const E2EE_STORE_NAME = "device_keys";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function ensureDeviceKeys(user, api) {
  const storedPair = await loadStoredKeyPair(user.id);

  if (!storedPair) {
    if (user.publicKey) {
      throw new Error(
        "For this account, E2EE is already enabled, but the local device key was not found."
      );
    }

    const pair = await generateAndStoreKeyPair(user.id);
    const response = await api.updatePublicKey(pair.publicKey);
    return response.user;
  }

  if (user.publicKey && user.publicKey !== storedPair.publicKey) {
    throw new Error(
      "The local device key does not match the account key. Encrypted sending is disabled for safety."
    );
  }

  if (!user.publicKey) {
    const response = await api.updatePublicKey(storedPair.publicKey);
    return response.user;
  }

  return user;
}

export async function hasLocalPrivateKey(userId) {
  return Boolean(await loadStoredKeyPair(userId));
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
    throw new Error("Could not determine chat participants for encryption.");
  }

  const participantKeys = await Promise.all(
    chat.participants.map(async (participant) => {
      if (!participant.publicKey) {
        throw new Error(`User ${participant.name} does not have an E2EE key yet.`);
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
  const hardenedPrivateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"]
  );

  const stored = {
    userId,
    publicKey: JSON.stringify(publicJwk),
    privateKey: hardenedPrivateKey,
  };
  await saveStoredKeyPair(stored);
  return stored;
}

async function getDeviceKeys(userId) {
  const stored = await loadStoredKeyPair(userId);
  if (!stored) {
    throw new Error("Local private key not found.");
  }

  return {
    publicKey: await importPublicKey(stored.publicKey),
    privateKey: stored.privateKey instanceof CryptoKey
      ? stored.privateKey
      : await importPrivateKey(stored.privateKey),
  };
}

async function loadStoredKeyPair(userId) {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return null;
  }

  const record = await getStoredKeyPair(userId);
  if (record) {
    return record;
  }

  const legacyRecord = loadLegacyStoredKeyPair(userId);
  if (!legacyRecord) {
    return null;
  }

  const migrated = {
    userId,
    publicKey: legacyRecord.publicKey,
    privateKey: await importPrivateKey(legacyRecord.privateKey),
  };
  await saveStoredKeyPair(migrated);
  window.localStorage.removeItem(getStorageKey(userId));
  return migrated;
}

async function getStoredKeyPair(userId) {
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(E2EE_STORE_NAME, "readonly");
    const store = tx.objectStore(E2EE_STORE_NAME);
    const request = store.get(String(userId));

    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }

      resolve({
        userId,
        publicKey: result.publicKey,
        privateKey: result.privateKey,
      });
    };
    request.onerror = () => reject(request.error || new Error("Failed to read device key."));
  });
}

async function saveStoredKeyPair({ userId, publicKey, privateKey }) {
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(E2EE_STORE_NAME, "readwrite");
    const store = tx.objectStore(E2EE_STORE_NAME);
    store.put({
      userId: String(userId),
      publicKey,
      privateKey,
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to store device key."));
    tx.onabort = () => reject(tx.error || new Error("Storing device key was aborted."));
  });
}

async function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(E2EE_DB_NAME, E2EE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(E2EE_STORE_NAME)) {
        db.createObjectStore(E2EE_STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open E2EE storage."));
  });
}

function loadLegacyStoredKeyPair(userId) {
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
    false,
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
