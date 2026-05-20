const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("toastApi", {
  onData: (callback) => {
    ipcRenderer.on("toast:data", (_event, payload) => callback(payload));
  },
  click: () => ipcRenderer.send("toast:click"),
  dismiss: () => ipcRenderer.send("toast:dismiss"),
});
