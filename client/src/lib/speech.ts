declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private isSpeaking: boolean = false;
  private audio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioUrlChange: ((url: string | null) => void) | null = null;

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

    // Initialize audio element for playing ElevenLabs audio
    this.audio = new Audio();
    this.audio.addEventListener('ended', () => {
      console.log('Audio playback ended');
      this.isSpeaking = false;
      this.onPlayingStateChange?.(false);
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
        this.onAudioUrlChange?.(null);
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.isSpeaking = false;
      this.onPlayingStateChange?.(false);
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
        this.onAudioUrlChange?.(null);
      }
    });

    this.audio.addEventListener('play', () => {
      console.log('Audio playback started');
      this.onPlayingStateChange?.(true);
    });

    this.audio.addEventListener('pause', () => {
      console.log('Audio playback paused');
      this.onPlayingStateChange?.(false);
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
        console.log('Stopping current audio playback');
        this.audio?.pause();
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
          this.onAudioUrlChange?.(null);
        }
      }

      this.isSpeaking = true;
      console.log('Requesting audio from server');

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
        throw new Error(`Failed to get audio: ${response.status} ${response.statusText}`);
      }

      console.log('Audio response received, creating blob URL');
      const audioBlob = await response.blob();
      this.currentAudioUrl = URL.createObjectURL(audioBlob);
      this.onAudioUrlChange?.(this.currentAudioUrl);

      if (this.audio) {
        console.log('Starting audio playback');
        this.audio.src = this.currentAudioUrl;
        await this.audio.play();
      }
    } catch (err) {
      console.error('Error with speech synthesis:', err);
      this.isSpeaking = false;
      this.onPlayingStateChange?.(false);
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
        this.onAudioUrlChange?.(null);
      }
      throw err;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  setPlayingStateListener(callback: (isPlaying: boolean) => void) {
    this.onPlayingStateChange = callback;
  }

  setAudioUrlListener(callback: (url: string | null) => void) {
    this.onAudioUrlChange = callback;
  }
}

export const speechHandler = new SpeechHandler();