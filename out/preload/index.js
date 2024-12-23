"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
globalThis.current_speaker = false;
globalThis.current_volume = 0;
globalThis.current_speaker_label = "Customer";
globalThis.is_from_mic = false;
const audioCallbacks = /* @__PURE__ */ new Set();
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("nodeAPI", {
      bufferAlloc: (size) => Buffer.alloc(size),
      writeFile: (path, data) => {
        return electron.ipcRenderer.invoke("writeFile", path, data);
      }
    });
    electron.contextBridge.exposeInMainWorld("audioAPI", {
      startCapture: () => electron.ipcRenderer.invoke("start-audio-capture"),
      stopCapture: () => electron.ipcRenderer.invoke("stop-audio-capture"),
      getCurrentSpeaker: () => globalThis.current_speaker,
      getCurrentVolume: () => globalThis.current_volume,
      getCurrentSpeakerLabel: () => globalThis.current_speaker_label,
      getCurrentIsFromMic: () => globalThis.is_from_mic,
      updateAudioState: (data) => {
        console.log("Updating audio state:", data);
        globalThis.current_speaker = data.isSpeaking;
        globalThis.current_volume = data.volume;
        globalThis.is_from_mic = data.isFromMic;
        globalThis.current_speaker_label = data.isFromMic ? "Representative" : "Customer";
        audioCallbacks.forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error("Error in audio callback:", error);
          }
        });
      },
      onAudioUpdate: (callback) => {
        console.log("Setting up audio update listener");
        audioCallbacks.add(callback);
        return () => {
          console.log("Cleaning up audio update listener");
          audioCallbacks.delete(callback);
        };
      }
    });
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
