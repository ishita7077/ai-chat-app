declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      try {
        this.recognition = new window.webkitSpeechRecognition();
        this.recognition.continuous = true; // Enable continuous recognition
        this.recognition.interimResults = true; // Enable interim results
        this.recognition.lang = 'en-US';
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        this.recognition = null;
      }
    }
    this.synthesis = window.speechSynthesis;
  }

  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ) {
    if (!this.recognition) {
      onError("Speech recognition not supported in this browser");
      return;
    }

    try {
      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        onResult(transcript, isFinal);
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

  speak(text: string) {
    if (!this.synthesis) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

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

  isSpeechSupported(): boolean {
    return typeof window.speechSynthesis !== 'undefined';
  }
}

export const speechHandler = new SpeechHandler();