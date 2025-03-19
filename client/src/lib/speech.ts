import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    audioEnabled: boolean; // Added global variable for audio enable/disable
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private isSpeaking: boolean = false;
  private isListening: boolean = false;
  private audio: HTMLAudioElement | null = null;
  private conversationMode: boolean = false;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD = 1500; // 1.5 seconds of silence before stopping

  // Debug settings
  private debug: boolean = true;
  private debugLog(message: string, ...args: any[]) {
    if (this.debug) {
      console.log(`[SpeechHandler] ${message}`, ...args);
    }
  }

  constructor() {
    this.debugLog('Initializing SpeechHandler');
    if ('webkitSpeechRecognition' in window) {
      try {
        this.recognition = new window.webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.setupRecognitionHandlers();
        this.debugLog('Speech recognition initialized successfully');
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        this.recognition = null;
      }
    }

    this.setupAudioHandlers();
  }

  private setupRecognitionHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.debugLog('Recognition started');
      this.isListening = true;
    };

    this.recognition.onend = () => {
      this.debugLog('Recognition ended');
      this.isListening = false;

      // In conversation mode, restart listening if not speaking
      if (this.conversationMode && !this.isSpeaking) {
        this.debugLog('Restarting recognition in conversation mode');
        this.startListening();
      }
    };

    this.recognition.onerror = (event: any) => {
      this.debugLog('Recognition error:', event.error);
      this.isListening = false;
    };

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript;
        this.debugLog('Final transcript:', transcript);

        // Reset silence detection
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
      }
    };
  }

  private setupAudioHandlers() {
    this.debugLog('Setting up audio handlers');
    this.audio = new Audio();

    this.audio.addEventListener('ended', () => {
      this.debugLog('Audio playback ended');
      this.isSpeaking = false;

      // Resume listening in conversation mode after speaking
      if (this.conversationMode) {
        this.debugLog('Resuming listening after speech');
        this.startListening();
      }
    });

    this.audio.addEventListener('error', (e) => {
      this.debugLog('Audio playback error:', e);
      this.isSpeaking = false;
    });

    this.audio.addEventListener('play', () => {
      this.debugLog('Audio playback started');
      this.isSpeaking = true;

      // Stop listening while speaking to prevent feedback
      if (this.isListening) {
        this.debugLog('Pausing recognition during speech');
        this.stopListening();
      }
    });
  }

  setConversationMode(enabled: boolean) {
    this.debugLog('Setting conversation mode:', enabled);
    this.conversationMode = enabled;

    if (enabled) {
      this.startListening();
    } else {
      this.stopListening();
    }
  }

  startListening(onResult?: (text: string) => void, onError?: (error: string) => void) {
    if (!this.recognition) {
      this.debugLog('Speech recognition not supported');
      onError?.("Speech recognition not supported in this browser");
      return;
    }

    if (this.isSpeaking) {
      this.debugLog('Cannot start listening while speaking');
      onError?.("Please wait for AI to finish speaking");
      return;
    }

    try {
      if (!this.isListening) {
        this.debugLog('Starting recognition');
        this.recognition.start();
      }

      // Set up result handler if provided
      if (onResult) {
        this.recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            this.debugLog('Final transcript with callback:', transcript);
            onResult(transcript);

            // Stop listening after getting result in non-conversation mode
            if (!this.conversationMode) {
              this.stopListening();
            }
          }
        };
      }
    } catch (err) {
      this.debugLog('Error starting recognition:', err);
      onError?.("Failed to start speech recognition");
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.debugLog('Stopping recognition');
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }

  async speak(text: string, voiceId?: string) {
    this.debugLog('Speaking text:', text.substring(0, 50) + '...');

    try {
      // Check if audio is enabled via the passed parameter
      if (!window.audioEnabled) {
        this.debugLog('Audio is disabled, skipping speech');
        return;
      }

      // Stop listening while speaking to prevent feedback
      if (this.isListening) {
        this.debugLog('Pausing recognition before speaking');
        this.stopListening();
      }

      if (this.isSpeaking) {
        this.debugLog('Stopping current audio playback');
        await this.stopSpeaking();
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

      this.debugLog('Audio response received');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (this.audio) {
        this.debugLog('Starting audio playback');
        this.audio.src = audioUrl;
        await this.audio.play();
      }
    } catch (err) {
      this.debugLog('Error with speech synthesis:', err);
      this.isSpeaking = false;
      throw err;
    }
  }

  // Add method to stop current speech
  async stopSpeaking() {
    if (this.audio && this.isSpeaking) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isSpeaking = false;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  isInConversationMode(): boolean {
    return this.conversationMode;
  }
}

export const speechHandler = new SpeechHandler();