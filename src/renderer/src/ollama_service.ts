interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'mistral') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as OllamaResponse;
      return data.response;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw error;
    }
  }

  setModel(model: string): void {
    this.model = model;
  }
}
