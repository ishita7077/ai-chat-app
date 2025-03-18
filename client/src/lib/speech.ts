// Add proper type definitions for the Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new window.webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }
    this.synthesis = window.speechSynthesis;
  }

  startListening(onResult: (text: string) => void, onError: (error: string) => void) {
    if (!this.recognition) {
      onError("Speech recognition not supported");
      return;
    }

    if (this.isListening) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      onResult(text);
    };

    this.recognition.onerror = (event: SpeechRecognitionError) => {
      onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.start();
    this.isListening = true;
  }

  stopListening() {
    if (!this.recognition || !this.isListening) return;
    this.recognition.stop();
    this.isListening = false;
  }

  speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    this.synthesis.speak(utterance);
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}

export const speechHandler = new SpeechHandler();