import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    nodeAPI: {
      writeFile: (path: string, data: Uint8Array) => Promise<void>
    }
    audioAPI: {
      startCapture: () => Promise<MediaStream>
      stopCapture: () => void
    }
  }
}
