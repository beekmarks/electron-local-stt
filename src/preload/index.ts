import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('nodeAPI', {
      bufferAlloc: (size: number) => Buffer.alloc(size),
      writeFile: (path: string, data: Uint8Array) => {
        return ipcRenderer.invoke('writeFile', path, data)
      }
    })

    // Expose audio capture API
    contextBridge.exposeInMainWorld('audioAPI', {
      startCapture: () => ipcRenderer.invoke('start-audio-capture'),
      stopCapture: () => ipcRenderer.invoke('stop-audio-capture')
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
