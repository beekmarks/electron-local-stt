"use strict";
const electron = require("electron");
console.log("Preload script starting...");
const api = {
  startCapture: () => {
    console.log("Calling startCapture");
    return electron.ipcRenderer.invoke("startCapture");
  },
  stopCapture: () => {
    console.log("Calling stopCapture");
    return electron.ipcRenderer.invoke("stopCapture");
  },
  generateOllamaResponse: (prompt, systemPrompt, onChunk, onDone) => {
    console.log("Calling generateOllamaResponse");
    electron.ipcRenderer.on("ollama:chunk", (_event, chunk) => onChunk(chunk));
    electron.ipcRenderer.on("ollama:done", () => {
      electron.ipcRenderer.removeAllListeners("ollama:chunk");
      electron.ipcRenderer.removeAllListeners("ollama:done");
      onDone();
    });
    return electron.ipcRenderer.invoke("ollama:generate", prompt, systemPrompt);
  },
  directOllamaQuery: async (prompt, onStream) => {
    console.log("Calling directOllamaQuery with prompt:", prompt);
    try {
      const streamHandler = (_event, chunk) => {
        console.log("Preload received stream chunk:", chunk);
        onStream(chunk);
      };
      const completeHandler = (_event, finalResponse) => {
        console.log("Stream complete");
      };
      electron.ipcRenderer.on("ollama:stream", streamHandler);
      electron.ipcRenderer.on("ollama:complete", completeHandler);
      console.log("Making query to main process...");
      const result = await electron.ipcRenderer.invoke("ollama:direct-query", prompt);
      console.log("Query complete, final result:", result);
      electron.ipcRenderer.removeListener("ollama:stream", streamHandler);
      electron.ipcRenderer.removeListener("ollama:complete", completeHandler);
      console.log("Removed stream listeners");
      return result;
    } catch (error) {
      console.error("Error in directOllamaQuery:", error);
      electron.ipcRenderer.removeAllListeners("ollama:stream");
      electron.ipcRenderer.removeAllListeners("ollama:complete");
      throw error;
    }
  }
};
console.log("API object structure:", {
  startCapture: typeof api.startCapture,
  stopCapture: typeof api.stopCapture,
  generateOllamaResponse: typeof api.generateOllamaResponse,
  directOllamaQuery: typeof api.directOllamaQuery
});
try {
  console.log("Exposing API to renderer process...");
  electron.contextBridge.exposeInMainWorld("api", api);
  console.log("API exposed successfully:", Object.keys(api));
} catch (error) {
  console.error("Failed to expose API:", error);
}
