class OllamaService {
  constructor(model = 'mistral', systemPrompt = 'You are a helpful AI assistant. Respond to the user\'s input in a clear and concise manner.') {
    this.model = model;
    this.systemPrompt = systemPrompt;
  }

  async generateResponse(prompt, responseElement) {
    try {
      let fullResponse = '';
      
      // Create a new response item div
      const responseItem = document.createElement('div');
      responseItem.className = 'response-item';
      responseItem.innerHTML = `
        <strong>Input:</strong> ${prompt}<br>
        <strong>Response:</strong> <span class="streaming-response"></span>
      `;
      responseElement.appendChild(responseItem);
      
      const streamingSpan = responseItem.querySelector('.streaming-response');

      await window.api.generateOllamaResponse(
        prompt,
        this.systemPrompt,
        (chunk) => {
          fullResponse += chunk;
          streamingSpan.textContent = fullResponse;
          // Scroll to bottom
          responseElement.scrollTop = responseElement.scrollHeight;
        },
        () => {
          console.log('Stream complete');
        }
      );

      return fullResponse;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw error;
    }
  }

  setModel(model) {
    this.model = model;
  }

  setSystemPrompt(systemPrompt) {
    this.systemPrompt = systemPrompt;
  }
}

// Make OllamaService available globally
window.OllamaService = OllamaService;
