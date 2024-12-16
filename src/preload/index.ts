import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  startCapture: () => ipcRenderer.invoke('startCapture'),
  stopCapture: () => ipcRenderer.invoke('stopCapture'),
  generateOllamaResponse: (conversationHistory: string, systemPrompt: string, onChunk: (chunk: string) => void, onDone: () => void) => {
    ipcRenderer.on('ollama:chunk', (_event, chunk) => onChunk(chunk));
    ipcRenderer.on('ollama:done', () => {
      ipcRenderer.removeAllListeners('ollama:chunk');
      ipcRenderer.removeAllListeners('ollama:done');
      ipcRenderer.removeAllListeners('ollama:error');
      onDone();
    });
    return ipcRenderer.invoke('ollama:generate', conversationHistory, systemPrompt);
  },
  onOllamaError: (callback: (error: string) => void) => {
    ipcRenderer.on('ollama:error', (_event, error) => callback(error));
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
