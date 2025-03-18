declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      try {
        this.recognition = new window.webkitSpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        this.recognition = null;
      }
    }
  }

  startListening(onResult: (text: string) => void, onError: (error: string) => void) {
    if (!this.recognition) {
      onError("Speech recognition not supported in this browser");
      return;
    }

    try {
      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (event.results.length > 0) {
          const transcript = event.results[0][0].transcript;
          onResult(transcript);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        onError(`Speech recognition error: ${event.error}`);
      };

      this.recognition.start();
    } catch (err) {
      onError("Failed to start speech recognition");
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}

export const speechHandler = new SpeechHandler();