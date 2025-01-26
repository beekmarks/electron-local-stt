import { contextBridge, ipcRenderer } from 'electron'

console.log('Preload script starting...')

// Define the API interface
interface ElectronAPI {
  startCapture: () => Promise<void>
  stopCapture: () => Promise<void>
  generateOllamaResponse: (
    prompt: string,
    systemPrompt: string,
    onChunk: (chunk: string) => void,
    onDone: () => void
  ) => Promise<void>
  directOllamaQuery: (
    prompt: string,
    onStream: (chunk: string) => void
  ) => Promise<string>
}

// Custom APIs for renderer
const api: ElectronAPI = {
  startCapture: () => {
    console.log('Calling startCapture');
    return ipcRenderer.invoke('startCapture');
  },
  stopCapture: () => {
    console.log('Calling stopCapture');
    return ipcRenderer.invoke('stopCapture');
  },
  generateOllamaResponse: (prompt: string, systemPrompt: string, onChunk: (chunk: string) => void, onDone: () => void) => {
    console.log('Calling generateOllamaResponse');
    ipcRenderer.on('ollama:chunk', (_event, chunk) => onChunk(chunk));
    ipcRenderer.on('ollama:done', () => {
      ipcRenderer.removeAllListeners('ollama:chunk');
      ipcRenderer.removeAllListeners('ollama:done');
      onDone();
    });
    return ipcRenderer.invoke('ollama:generate', prompt, systemPrompt);
  },
  directOllamaQuery: async (prompt: string, onStream: (chunk: string) => void) => {
    console.log('Calling directOllamaQuery with prompt:', prompt);
    try {
      // Set up stream listener
      const streamHandler = (_event: any, chunk: string) => {
        console.log('Preload received stream chunk:', chunk);
        onStream(chunk);
      };

      const completeHandler = (_event: any, finalResponse: string) => {
        console.log('Stream complete');
      };
      
      ipcRenderer.on('ollama:stream', streamHandler);
      ipcRenderer.on('ollama:complete', completeHandler);

      // Make the query
      console.log('Making query to main process...');
      const result = await ipcRenderer.invoke('ollama:direct-query', prompt);
      console.log('Query complete, final result:', result);

      // Clean up listeners
      ipcRenderer.removeListener('ollama:stream', streamHandler);
      ipcRenderer.removeListener('ollama:complete', completeHandler);
      console.log('Removed stream listeners');

      return result;
    } catch (error) {
      console.error('Error in directOllamaQuery:', error);
      // Clean up listeners on error too
      ipcRenderer.removeAllListeners('ollama:stream');
      ipcRenderer.removeAllListeners('ollama:complete');
      throw error;
    }
  }
}

// Log the API object to verify its structure
console.log('API object structure:', {
  startCapture: typeof api.startCapture,
  stopCapture: typeof api.stopCapture,
  generateOllamaResponse: typeof api.generateOllamaResponse,
  directOllamaQuery: typeof api.directOllamaQuery
});

// Expose the API to the renderer process
try {
  console.log('Exposing API to renderer process...');
  contextBridge.exposeInMainWorld('api', api);
  console.log('API exposed successfully:', Object.keys(api));
} catch (error) {
  console.error('Failed to expose API:', error);
}
