class OllamaService {
  constructor(model = 'mistral', systemPrompt = 'You are a helpful AI assistant. Respond to the user\'s input in a clear and concise manner.') {
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.conversationHistory = [];
    this.setupErrorHandler();
  }

  setupErrorHandler() {
    window.api.onOllamaError((error) => {
      const errorElement = document.getElementById('model-error');
      errorElement.textContent = error;
      errorElement.classList.add('show');
      
      // Hide error after 10 seconds
      setTimeout(() => {
        errorElement.classList.remove('show');
      }, 10000);
    });
  }

  async generateResponse(prompt, responseElement) {
    try {
      let fullResponse = '';
      
      // Clear any previous errors
      const errorElement = document.getElementById('model-error');
      errorElement.classList.remove('show');
      
      // Add user message to conversation history
      this.conversationHistory.push({ 
        role: 'user', 
        content: prompt,
        model: this.model  
      });
      
      // Create a new response item div
      const responseItem = document.createElement('div');
      responseItem.className = 'response-item';
      responseItem.innerHTML = `
        <strong>Input:</strong> ${prompt}<br>
        <strong>Response:</strong> <span class="streaming-response"></span>
      `;
      
      // Get the correct response element and clear previous responses
      const outputElement = document.getElementById('llm-output');
      if (!outputElement) {
        throw new Error('Response element not found');
      }
      
      // Only keep the last 10 responses to prevent memory issues
      while (outputElement.children.length >= 10) {
        outputElement.removeChild(outputElement.firstChild);
      }
      
      outputElement.appendChild(responseItem);
      
      const streamingSpan = responseItem.querySelector('.streaming-response');

      // Create a new promise to handle the streaming response
      return new Promise((resolve, reject) => {
        window.api.generateOllamaResponse(
          JSON.stringify(this.conversationHistory),
          this.systemPrompt,
          (chunk) => {
            fullResponse += chunk;
            streamingSpan.textContent = fullResponse;
            // Scroll to bottom
            outputElement.scrollTop = outputElement.scrollHeight;
          },
          () => {
            // Add assistant response to conversation history
            this.conversationHistory.push({ role: 'assistant', content: fullResponse });
            console.log('Stream complete');
            resolve(fullResponse);
          }
        ).catch(reject);
      });
    } catch (error) {
      console.error('Error calling Ollama:', error);
      const errorElement = document.getElementById('model-error');
      errorElement.textContent = `Error: ${error.message}`;
      errorElement.classList.add('show');
      throw error;
    }
  }

  setModel(model) {
    if (!model || model.trim() === '') {
      const errorElement = document.getElementById('model-error');
      errorElement.textContent = 'Model name cannot be empty';
      errorElement.classList.add('show');
      return false;
    }
    this.model = model.trim();
    this.resetConversation();
    return true;
  }

  setSystemPrompt(systemPrompt) {
    if (!systemPrompt || systemPrompt.trim() === '') {
      const errorElement = document.getElementById('model-error');
      errorElement.textContent = 'System prompt cannot be empty';
      errorElement.classList.add('show');
      return false;
    }
    this.systemPrompt = systemPrompt.trim();
    this.resetConversation();
    console.log('System prompt updated to:', this.systemPrompt);
    return true;
  }

  resetConversation() {
    this.conversationHistory = [];
    // Clear the response display
    const outputElement = document.getElementById('llm-output');
    if (outputElement) {
      outputElement.innerHTML = '[LLM responses will appear here]';
    }
    console.log('Conversation reset');
    return true;
  }
}

// Make OllamaService available globally
window.OllamaService = OllamaService;
