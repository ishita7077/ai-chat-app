import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private isSpeaking: boolean = false;
  private audio: HTMLAudioElement | null = null;

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

    this.audio = new Audio();
    this.audio.addEventListener('ended', () => {
      this.isSpeaking = false;
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.isSpeaking = false;
    });

    this.audio.addEventListener('play', () => {
      this.isSpeaking = true;
    });
  }

  startListening(onResult: (text: string) => void, onError: (error: string) => void) {
    if (!this.recognition) {
      onError("Speech recognition not supported in this browser");
      return;
    }

    if (this.isSpeaking) {
      onError("Please wait for AI to finish speaking");
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

  async speak(text: string, voiceId?: string) {
    try {
      if (this.isSpeaking) {
        this.audio?.pause();
      }

      this.isSpeaking = true;

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          voiceId 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('quota_exceeded')) {
          throw new Error('Message is too long for voice synthesis. Please try a shorter message or disable voice responses.');
        }
        throw new Error('Voice synthesis unavailable. Please try again later.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (this.audio) {
        this.audio.src = audioUrl;
        await this.audio.play();
      }
    } catch (err) {
      console.error('Error with speech synthesis:', err);
      this.isSpeaking = false;
      throw err;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}

export const speechHandler = new SpeechHandler();