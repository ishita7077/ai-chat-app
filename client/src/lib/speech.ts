// Add proper type definitions for the Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;

  constructor() {
    // Try standard SpeechRecognition first, then webkit prefix
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false; // Changed to false to prevent multiple results
        this.recognition.interimResults = false; // Changed to false for final results only
        this.recognition.lang = 'en-US'; // Set language explicitly
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        this.recognition = null;
      }
    }

    this.synthesis = window.speechSynthesis;
  }

  startListening(onResult: (text: string) => void, onError: (error: string) => void) {
    if (!this.recognition) {
      onError("Speech recognition not supported in this browser");
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (event.results.length > 0) {
          const transcript = event.results[0][0].transcript;
          onResult(transcript);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.isListening = false;
        let errorMessage = "Speech recognition error";

        switch (event.error) {
          case "network":
            errorMessage = "Network error occurred. Please check your connection.";
            break;
          case "not-allowed":
            errorMessage = "Microphone access denied. Please allow microphone access.";
            break;
          case "no-speech":
            errorMessage = "No speech detected. Please try again.";
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }

        onError(errorMessage);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.recognition) {
          try {
            this.recognition.start();
          } catch (err) {
            onError("Failed to restart speech recognition");
          }
        }
      };

      this.recognition.start();
      this.isListening = true;
    } catch (err) {
      onError("Failed to start speech recognition. Please try again.");
      this.isListening = false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
      this.isListening = false;
    }
  }

  speak(text: string) {
    if (!this.synthesis) return;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.lang = 'en-US';
      this.synthesis.speak(utterance);
    } catch (err) {
      console.error('Error with speech synthesis:', err);
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}

export const speechHandler = new SpeechHandler();