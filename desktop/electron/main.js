const fs = require("fs");
const path = require("path");
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  screen,
} = require("electron");
const Store = require("electron-store");

const PRODUCTION_SERVER_URL = "https://chat.5-35-88-205.sslip.io";

const store = new Store({
  defaults: {
    notificationsEnabled: true,
    serverUrl: getDefaultServerUrl(),
  },
});

function getDefaultServerUrl() {
  if (process.env.MESSENGER_URL) {
    return process.env.MESSENGER_URL.replace(/\/$/, "");
  }
  if (app.isPackaged) {
    return PRODUCTION_SERVER_URL;
  }
  return "http://localhost:3020";
}

function getAssetsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets");
  }
  return path.join(__dirname, "..", "assets");
}

function assetPath(name) {
  return path.join(getAssetsDir(), name);
}

const TOAST_WIDTH = 360;
const TOAST_HEIGHT = 88;
const TOAST_MARGIN = 16;
const TOAST_GAP = 10;
const TOAST_LIFETIME_MS = 5500;
const MAX_TOASTS = 4;

let mainWindow = null;
let tray = null;
let isQuitting = false;
const activeToasts = [];

if (process.platform === "win32") {
  app.setAppUserModelId("com.messenger.signal.desktop");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  registerIpcHandlers();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  showMainWindow();
});

function getServerUrl() {
  return (
    process.env.MESSENGER_URL ||
    store.get("serverUrl") ||
    getDefaultServerUrl()
  ).replace(/\/$/, "");
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function loadNativeImage(filePath) {
  if (!filePath || !fileExists(filePath)) return nativeImage.createEmpty();

  let image = nativeImage.createFromPath(filePath);
  if (!image.isEmpty()) return image;

  try {
    const buffer = fs.readFileSync(filePath);
    image = nativeImage.createFromBuffer(buffer);
    if (!image.isEmpty()) return image;
  } catch {
    // ignore read/decode errors
  }

  return nativeImage.createEmpty();
}

function loadFirstNativeImage(fileNames) {
  for (const name of fileNames) {
    const image = loadNativeImage(assetPath(name));
    if (!image.isEmpty()) return image;
  }
  return nativeImage.createEmpty();
}

function getWindowIcon() {
  return loadFirstNativeImage(["icon.ico", "icon.png"]);
}

function getTrayIconImage() {
  const traySize = process.platform === "win32" ? 16 : 22;
  const image = loadFirstNativeImage([
    "tray.ico",
    "tray-16.png",
    "tray-32.png",
    "icon.ico",
    "icon.png",
  ]);

  if (image.isEmpty()) return image;
  const { width, height } = image.getSize();
  if (width === traySize && height === traySize) return image;
  return image.resize({ width: traySize, height: traySize });
}

function createMainWindow() {
  const icon = getWindowIcon();

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#e6ebee",
    icon: icon && !icon.isEmpty() ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.loadURL(getServerUrl());
}

function createTray() {
  let trayImage = getTrayIconImage();

  if (trayImage.isEmpty()) {
    trayImage = nativeImage
      .createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBwGxgYGCAGBgYGBgQEAAP//AwBQZQGqJXQp8QAAAABJRU5ErkJggg=="
      )
      .resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayImage);

  tray.setToolTip("Signal");
  refreshTrayMenu();
  tray.on("double-click", () => showMainWindow());
}

function refreshTrayMenu() {
  const notificationsEnabled = store.get("notificationsEnabled");

  const menu = Menu.buildFromTemplate([
    {
      label: "Открыть Signal",
      click: () => showMainWindow(),
    },
    {
      label: "Скрыть окно",
      click: () => mainWindow?.hide(),
    },
    { type: "separator" },
    {
      label: "Уведомления",
      type: "checkbox",
      checked: notificationsEnabled,
      click: (item) => {
        store.set("notificationsEnabled", item.checked);
        refreshTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        isQuitting = true;
        closeAllToasts();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function registerIpcHandlers() {
  ipcMain.handle("settings:get-notifications", () =>
    store.get("notificationsEnabled")
  );

  ipcMain.handle("app:should-show-notification", () => shouldShowNotificationNow());

  ipcMain.on("notification:show", (_event, payload) => {
    if (!store.get("notificationsEnabled")) return;
    if (!shouldShowNotificationNow()) return;
    showToast(payload);
  });

  ipcMain.on("toast:click", (event) => {
    const entry = activeToasts.find(
      (item) => item.window.webContents.id === event.sender.id
    );
    if (!entry) return;
    const { chatId } = entry;
    dismissToast(entry);
    showMainWindow();
    if (chatId) {
      mainWindow?.webContents.send("notification:clicked", chatId);
    }
  });

  ipcMain.on("toast:dismiss", (event) => {
    const entry = activeToasts.find(
      (item) => item.window.webContents.id === event.sender.id
    );
    if (entry) dismissToast(entry);
  });
}

function shouldShowNotificationNow() {
  if (!store.get("notificationsEnabled")) return false;
  if (!mainWindow) return true;
  return (
    !mainWindow.isVisible() ||
    mainWindow.isMinimized() ||
    !mainWindow.isFocused()
  );
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showToast(payload) {
  const chatId = payload?.chatId ?? parseChatIdFromTag(payload?.tag);

  const toastWindow = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "toast-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const entry = {
    window: toastWindow,
    chatId,
    timer: null,
  };

  activeToasts.unshift(entry);
  trimToasts();

  toastWindow.loadFile(path.join(__dirname, "toast.html"));
  toastWindow.webContents.once("did-finish-load", () => {
    toastWindow.webContents.send("toast:data", {
      title: payload?.title || "Signal",
      body: payload?.body || "",
    });
    layoutToasts();
    toastWindow.showInactive();
  });

  entry.timer = setTimeout(() => dismissToast(entry), TOAST_LIFETIME_MS);
}

function parseChatIdFromTag(tag) {
  if (!tag || typeof tag !== "string") return null;
  const match = tag.match(/signal-chat-(\d+)/);
  return match ? Number(match[1]) : null;
}

function layoutToasts() {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  let offsetY = workArea.y + workArea.height - TOAST_MARGIN;

  activeToasts.forEach((entry) => {
    if (entry.window.isDestroyed()) return;
    offsetY -= TOAST_HEIGHT;
    entry.window.setBounds({
      x: workArea.x + workArea.width - TOAST_WIDTH - TOAST_MARGIN,
      y: offsetY,
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT,
    });
    offsetY -= TOAST_GAP;
  });
}

function dismissToast(entry) {
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  const index = activeToasts.indexOf(entry);
  if (index >= 0) activeToasts.splice(index, 1);
  if (!entry.window.isDestroyed()) entry.window.close();
  layoutToasts();
}

function trimToasts() {
  while (activeToasts.length > MAX_TOASTS) {
    const oldest = activeToasts.pop();
    dismissToast(oldest);
  }
}

function closeAllToasts() {
  [...activeToasts].forEach((entry) => dismissToast(entry));
}
