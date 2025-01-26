class OllamaService {
  constructor(model = 'deepseek-r1:7b', systemPrompt = `
You are an AI assistant specialized in analyzing conversations between financial planners and their clients. Your primary task is to analyze a provided call transcript and iteratively improve your output based on feedback. 

Your tasks include:  
1. **CONVERSATION ANALYSIS:**  
   - Provide a concise summary of the main topics discussed.  
   - Identify key points, including:  
     - The client's primary concerns or goals.  
     - Financial strategies or products discussed.  
     - Decisions made or conclusions reached.  
     - Any specific numbers, dates, or figures mentioned.

2. **FEEDBACK INTEGRATION:**  
   - After your initial analysis, review any feedback on incorrect or incomplete details.  
   - Iteratively refine your output to improve accuracy and completeness.

3. **CONFIDENCE SCORING:**  
   - Indicate your confidence level (e.g., High, Medium, Low) for each detail reconstructed from the call.  

4. **REWARD AND PENALTY:**  
   - Aim for high accuracy in identifying financial topics and reconstructing factual details. Each correct fact adds to your score, and missing or misrepresenting key details reduces it.

**OUTPUT FORMAT:**  
   Provide your analysis in the following JSON structure:  

\`\`\`json
{
  "summary": "[2-3 paragraph summary organized by main topics]",
  "key_points": [
    {
      "topic": "Client Concerns",
      "details": "[Details about concerns/goals]"
    },
    {
      "topic": "Financial Strategies",
      "details": "[Strategies/products discussed]"
    },
    {
      "topic": "Decisions",
      "details": "[Conclusions reached]"
    },
    {
      "topic": "Specific Figures",
      "details": "[Numbers/dates/figures mentioned]"
    }
  ],
  "action_items": [
    {
      "task": "[Specific task for the financial planner]"
    }
  ],
  "confidence_scores": [
    {
      "section": "summary",
      "confidence": "High"
    },
    {
      "section": "key_points",
      "confidence": "Medium"
    }
  ]
}
\`\`\`

The call transcript provided contains errors due to the transcription system. Reconstruct factual details as accurately as possible using context. After providing your initial analysis, you will receive feedback to refine your output.
`) {
    this.model = model;
    this._systemPrompt = systemPrompt;
  }

  // Getter for systemPrompt
  get systemPrompt() {
    return this._systemPrompt;
  }

  // Setter for systemPrompt
  set systemPrompt(value) {
    if (typeof value === 'string' && value.trim()) {
      this._systemPrompt = value.trim();
    }
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
        this._systemPrompt,
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
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }
}

// Make OllamaService available globally
window.OllamaService = OllamaService;
