const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("messengerDesktop", {
  isDesktop: true,
  shouldNotify: () => ipcRenderer.invoke("app:should-show-notification"),
  showMessageNotification: (payload) => ipcRenderer.send("notification:show", payload),
  getNotificationsEnabled: () => ipcRenderer.invoke("settings:get-notifications"),
  onNotificationClick: (callback) => {
    if (typeof callback !== "function") return;
    const handler = (_event, chatId) => callback(chatId);
    ipcRenderer.on("notification:clicked", handler);
    return () => ipcRenderer.removeListener("notification:clicked", handler);
  },
});
