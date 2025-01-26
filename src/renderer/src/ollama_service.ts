interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

declare global {
  interface Window {
    api: {
      generateOllamaResponse: (prompt: string, systemPrompt: string, onChunk: (chunk: string) => void, onDone: () => void) => Promise<void>;
      directOllamaQuery: (prompt: string) => Promise<string>;
      startCapture: () => Promise<void>;
      stopCapture: () => Promise<void>;
    };
  }
}

export class OllamaService {
  private model: string;

  constructor(model: string = 'deepseek-r1:7b') {
    this.model = model;
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      if (!window.api?.directOllamaQuery) {
        throw new Error('API not properly initialized');
      }
      const response = await window.api.directOllamaQuery(prompt);
      return response;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw error;
    }
  }

  setModel(model: string): void {
    this.model = model;
  }
}
