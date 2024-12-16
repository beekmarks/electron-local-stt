import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

class AzureSpeechService {
    constructor(subscriptionKey, region) {
        this.speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
        this.speechConfig.speechRecognitionLanguage = "en-US";
        
        // Configure for conversation transcription
        this.speechConfig.setServiceProperty("conversation_transcription", "true", sdk.ServicePropertyChannel.UriQueryParameter);
        
        // Enable speaker diarization
        this.speechConfig.setProperty("DiarizationEnabled", "true");
        this.speechConfig.setProperty("TranscriptionService_SingleChannel", "true");
        
        // Set up format for detailed output
        this.speechConfig.outputFormat = sdk.OutputFormat.Detailed;

        // Keep track of unique speakers
        this.speakers = new Map();
        this.nextSpeakerId = 1;
    }

    async startContinuousRecognition(audioStream, onRecognized) {
        try {
            // Clean up any existing recognizer
            if (this.recognizer) {
                await this.stopRecognition();
            }

            const audioConfig = sdk.AudioConfig.fromStreamInput(audioStream);
            this.recognizer = new sdk.ConversationTranscriber(this.speechConfig, audioConfig);

            // Keep track of the last recognized text to prevent duplicates
            let lastRecognizedText = '';

            this.recognizer.transcribed = (s, e) => {
                if (e.result.text && e.result.text.trim()) {
                    const currentText = e.result.text.trim();
                    
                    // Only process if this is new text
                    if (currentText !== lastRecognizedText) {
                        lastRecognizedText = currentText;
                        
                        try {
                            // Get the speaker ID from the result
                            const speakerId = e.result.speakerId || this.extractSpeakerId(e.result);
                            
                            // Assign a consistent speaker number if we haven't seen this speaker before
                            if (speakerId && !this.speakers.has(speakerId)) {
                                this.speakers.set(speakerId, this.nextSpeakerId++);
                            }
                            
                            // Use the mapped speaker number or 'Unknown' if no speaker ID
                            const speakerNumber = speakerId ? this.speakers.get(speakerId) : 'Unknown';
                            const speakerLabel = speakerId ? `Speaker ${speakerNumber}` : 'Unknown';
                            
                            onRecognized(currentText, speakerLabel);
                        } catch (error) {
                            console.error('Error processing transcription:', error);
                            onRecognized(currentText, 'Unknown');
                        }
                    }
                }
            };

            this.recognizer.sessionStarted = (s, e) => {
                console.log('Conversation transcription session started');
                // Reset speaker tracking on new session
                this.speakers.clear();
                this.nextSpeakerId = 1;
            };

            this.recognizer.sessionStopped = (s, e) => {
                console.log('Conversation transcription session stopped');
            };

            // Handle canceled events
            this.recognizer.canceled = (s, e) => {
                console.log(`Conversation transcription canceled: ${e.errorDetails}`);
                if (e.reason === sdk.CancellationReason.Error) {
                    console.error(`Error details: ${e.errorDetails}`);
                }
            };

            await this.recognizer.startTranscribingAsync();
            console.log('Conversation transcription started');
        } catch (error) {
            console.error('Error starting conversation transcription:', error);
            throw error;
        }
    }

    extractSpeakerId(result) {
        try {
            // Try to extract speaker ID from various properties
            if (result.properties) {
                const response = result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
                if (response) {
                    const jsonResponse = JSON.parse(response);
                    if (jsonResponse.NBest && jsonResponse.NBest[0] && jsonResponse.NBest[0].Speaker) {
                        return jsonResponse.NBest[0].Speaker;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting speaker ID:', error);
            return null;
        }
    }

    async stopRecognition() {
        if (this.recognizer) {
            try {
                await this.recognizer.stopTranscribingAsync();
                console.log('Conversation transcription stopped');
            } catch (error) {
                console.error('Error stopping conversation transcription:', error);
            }
        }
    }

    formatTranscription(text, speaker) {
        const speakerClass = speaker.replace(/\s+/g, '-').toLowerCase();
        return `<div class="transcription-line">
            <span class="speaker-label ${speakerClass}">${speaker}:</span>
            <span class="transcription-text">${text}</span>
        </div>`;
    }
}

export default AzureSpeechService;
