"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  startCapture: () => electron.ipcRenderer.invoke("startCapture"),
  stopCapture: () => electron.ipcRenderer.invoke("stopCapture"),
  generateOllamaResponse: (prompt, systemPrompt, onChunk, onDone) => {
    electron.ipcRenderer.on("ollama:chunk", (_event, chunk) => onChunk(chunk));
    electron.ipcRenderer.on("ollama:done", () => {
      electron.ipcRenderer.removeAllListeners("ollama:chunk");
      electron.ipcRenderer.removeAllListeners("ollama:done");
      onDone();
    });
    return electron.ipcRenderer.invoke("ollama:generate", prompt, systemPrompt);
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
