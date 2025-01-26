


class OllamaService {
  constructor(model = 'deepseek-r1:7b', systemPrompt = 'You are a helpful assistant that always talks like a pirate.  Always respond to user queries using language that a pirate would use.') {
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
        <strong>Response:</strong> <pre class="streaming-response"></pre>
      `;
      responseElement.appendChild(responseItem);
      
      const streamingSpan = responseItem.querySelector('.streaming-response');

      await window.api.generateOllamaResponse(
        prompt,
        this.systemPrompt,
        (chunk) => {
          fullResponse += chunk;
          try {
            // Try to parse and pretty print as JSON
            const jsonObj = JSON.parse(fullResponse);
            streamingSpan.textContent = JSON.stringify(jsonObj, null, 2);
          } catch (e) {
            // If not valid JSON, display as plain text
            streamingSpan.textContent = fullResponse;
          }
          // Scroll to bottom
          responseElement.scrollTop = responseElement.scrollHeight;
        },
        () => {
          console.log('Stream complete');
          // Try one final time to format as JSON in case the complete response is valid JSON
          try {
            const jsonObj = JSON.parse(fullResponse);
            streamingSpan.textContent = JSON.stringify(jsonObj, null, 2);
          } catch (e) {
            // If still not valid JSON, leave as is
          }
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
