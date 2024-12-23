import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
declare global {
  var current_speaker: boolean;
  var current_volume: number;
  var current_speaker_label: string;
  var is_from_mic: boolean;
}

// Initialize global variables
globalThis.current_speaker = false;
globalThis.current_volume = 0;
globalThis.current_speaker_label = 'Customer';
globalThis.is_from_mic = false;

// Store callbacks for audio updates
const audioCallbacks: Set<(data: { isSpeaking: boolean; volume: number; isFromMic: boolean }) => void> = new Set();

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
      stopCapture: () => ipcRenderer.invoke('stop-audio-capture'),
      getCurrentSpeaker: () => globalThis.current_speaker,
      getCurrentVolume: () => globalThis.current_volume,
      getCurrentSpeakerLabel: () => globalThis.current_speaker_label,
      getCurrentIsFromMic: () => globalThis.is_from_mic,
      updateAudioState: (data: { volume: number; isSpeaking: boolean; isFromMic: boolean }) => {
        console.log('Updating audio state:', data);
        globalThis.current_speaker = data.isSpeaking;
        globalThis.current_volume = data.volume;
        globalThis.is_from_mic = data.isFromMic;
        globalThis.current_speaker_label = data.isFromMic ? 'Representative' : 'Customer';
        
        // Notify all callbacks
        audioCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in audio callback:', error);
          }
        });
      },
      onAudioUpdate: (callback: (data: { isSpeaking: boolean; volume: number; isFromMic: boolean }) => void) => {
        console.log('Setting up audio update listener');
        audioCallbacks.add(callback);
        
        // Return cleanup function
        return () => {
          console.log('Cleaning up audio update listener');
          audioCallbacks.delete(callback);
        };
      }
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
