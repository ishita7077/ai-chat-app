import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export class SpeechHandler {
  private recognition: any | null = null;
  private isSpeaking: boolean = false;
  private isListening: boolean = false;
  private audio: HTMLAudioElement | null = null;
  private conversationMode: boolean = false;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD = 1500;
  private autoplayBlocked: boolean = false;
  private audioContext: AudioContext | null = null;
  private onAutoplayBlocked: (() => void) | null = null;

  // Debug settings
  private debug: boolean = true;
  private debugLog(message: string, ...args: any[]) {
    if (this.debug) {
      console.log(`[SpeechHandler] ${message}`, ...args);
    }
  }

  constructor() {
    this.debugLog('Initializing SpeechHandler');
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.setupRecognitionHandlers();
        this.debugLog('Speech recognition initialized successfully');
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        this.recognition = null;
      }
    } else {
      console.warn('Speech recognition not supported in this browser');
      this.recognition = null;
    }

    // Initialize Web Audio API if available
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.debugLog('Web Audio API initialized');
    } catch (e) {
      console.warn('Web Audio API not supported');
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

      // Only restart if we're in conversation mode and not speaking
      if (this.conversationMode && !this.isSpeaking) {
        this.debugLog('Restarting recognition in conversation mode');
        setTimeout(() => this.startListening(), 100);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.debugLog('Recognition error:', event.error);
      this.isListening = false;

      // Handle specific error types
      switch (event.error) {
        case 'not-allowed':
          console.error('Microphone access denied');
          break;
        case 'network':
          console.error('Network error occurred');
          break;
        case 'no-speech':
          this.debugLog('No speech detected');
          // Restart recognition if in conversation mode
          if (this.conversationMode && !this.isSpeaking) {
            setTimeout(() => this.startListening(), 100);
          }
          break;
        default:
          console.error(`Speech recognition error: ${event.error}`);
      }
    };

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript;
        this.debugLog('Final transcript:', transcript);

        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
        }
      }
    };
  }

  private setupAudioHandlers() {
    this.debugLog('Setting up audio handlers');
    this.audio = new Audio();

    this.audio.addEventListener('play', () => {
      this.debugLog('Audio playback started');
      this.isSpeaking = true;

      if (this.isListening) {
        this.debugLog('Pausing recognition during speech');
        this.stopListening();
      }
    });

    this.audio.addEventListener('ended', () => {
      this.debugLog('Audio playback ended');
      this.isSpeaking = false;

      if (this.conversationMode) {
        this.debugLog('Resuming listening after speech');
        this.startListening();
      }
    });

    this.audio.addEventListener('error', (e) => {
      this.debugLog('Audio playback error:', e);
      this.isSpeaking = false;
    });
  }

  private async testAudioPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('Microphone permission test failed:', err);
      return false;
    }
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

  async startListening(onResult?: (text: string) => void, onError?: (error: string) => void) {
    if (!this.recognition) {
      this.debugLog('Speech recognition not supported');
      onError?.("Speech recognition not supported in this browser");
      return;
    }

    // Test microphone permissions first
    const hasPermission = await this.testAudioPermissions();
    if (!hasPermission) {
      this.debugLog('Microphone permission denied');
      onError?.("Microphone access is required. Please grant permission in your browser settings.");
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

      if (onResult) {
        this.recognition.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            this.debugLog('Final transcript with callback:', transcript);
            onResult(transcript);

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
    const startTime = Date.now();
    this.debugLog(`[Timing] Starting speech synthesis at: ${startTime}`);
    this.debugLog('Speaking text:', text.substring(0, 50) + '...');

    try {
      // Stop listening while speaking
      if (this.isListening) {
        this.debugLog('Pausing recognition before speaking');
        this.stopListening();
      }

      if (this.isSpeaking) {
        this.debugLog('Stopping current audio playback');
        await this.stopSpeaking();
      }

      // Set speaking state early to prevent multiple calls
      this.isSpeaking = true;

      // Completely disable Web Speech API as requested by user
      // No dual sounds - only ElevenLabs voice

      this.debugLog('[Timing] Sending TTS request to server');
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

      const apiResponseTime = Date.now() - startTime;
      this.debugLog(`[Timing] Server responded after: ${apiResponseTime}ms`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes("quota_exceeded")) {
          throw new Error('Voice synthesis quota exceeded. Please try again later.');
        } else {
          throw new Error(errorData.error || 'Voice synthesis unavailable. Please check your audio settings.');
        }
      }

      // Use simpler approach for more reliable playback
      if (!this.audio) {
        this.audio = new Audio();
        this.setupAudioHandlers();
      }

      try {
        // For short responses or when MediaSource support is uncertain, use direct blob approach
        if (text.length < 100 || !window.MediaSource) {
          return await this.playWithDirectBlob(response, startTime);
        }
        
        // Try MediaSource streaming for longer content
        return await this.playWithMediaSource(response, startTime);
      } catch (err) {
        this.debugLog('MediaSource streaming failed, falling back to blob:', err);
        // If MediaSource fails, fall back to blob method
        return await this.playWithDirectBlob(response, startTime);
      }
    } catch (err) {
      this.debugLog('Error with speech synthesis:', err);
      this.isSpeaking = false;
      throw err;
    }
  }

  // Method to play audio with direct blob approach
  private async playWithDirectBlob(response: Response, startTime: number): Promise<boolean> {
    this.debugLog('Using direct blob playback');
    
    try {
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (!this.audio) {
        this.audio = new Audio();
        this.setupAudioHandlers();
      }
      
      this.audio.src = audioUrl;
      
      // Set playback rate to match streaming speed
      this.audio.playbackRate = 1.26;
      
      try {
        await this.audio.play();
        this.debugLog(`[Timing] Audio playback started with blob: ${Date.now() - startTime}ms total delay`);
        this.autoplayBlocked = false;
      } catch (e: any) {
        if (e.name === 'NotAllowedError') {
          this.autoplayBlocked = true;
          this.emitAutoplayBlocked();
        }
        throw e;
      }
      
      // Set up cleanup
      if (this.audio) {
        this.audio.onended = () => {
          this.debugLog('Audio playback ended');
          
          // Clean up
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          
          if (this.conversationMode) {
            this.startListening();
          }
        };
      }
      
      return true;
    } catch (e) {
      this.debugLog('Error in direct blob playback:', e);
      this.isSpeaking = false;
      throw e;
    }
  }

  // Method to play audio with MediaSource streaming
  private async playWithMediaSource(response: Response, startTime: number): Promise<boolean> {
    this.debugLog('Using MediaSource streaming with low latency mode');
    
    // Use lowLatency mode to start playback faster
    const mediaSource = new MediaSource();
    mediaSource.onsourceopen = () => {
      if (mediaSource.readyState === 'open') {
        // Configure for minimum latency
        mediaSource.duration = 0;
      }
    };
    
    const audioUrl = URL.createObjectURL(mediaSource);
    
    if (!this.audio) {
      this.audio = new Audio();
      this.setupAudioHandlers();
    }
    
    // Set a slightly higher playback rate to compensate for buffer underruns
    this.audio.playbackRate = 1.26;
    this.audio.src = audioUrl;
    
    let sourceBuffer: SourceBuffer | null = null;
    let pendingChunks: Uint8Array[] = [];
    let isMediaSourceOpen = false;
    let isSourceBufferValid = false;
    let streamingComplete = false;
    let playbackStarted = false;
    let minBufferSize = 1; // Start playback after just 1 chunk for minimal latency
    
    // Process the next chunk when the source buffer is ready
    const processNextChunk = async () => {
      if (!sourceBuffer || !isSourceBufferValid || !isMediaSourceOpen || pendingChunks.length === 0) {
        return;
      }
      
      try {
        if (!sourceBuffer.updating) {
          const chunk = pendingChunks.shift()!;
          sourceBuffer.appendBuffer(chunk);
        }
      } catch (e) {
        // If we get an error, mark the source buffer as invalid
        this.debugLog('Error appending buffer:', e);
        isSourceBufferValid = false;
        
        if (e instanceof DOMException && 
           (e.name === 'InvalidStateError' || e.message.includes('SourceBuffer'))) {
          // This is likely the error we're trying to fix
          throw new Error('MediaSource buffer error: ' + e.message);
        }
      }
    };
    
    return new Promise((resolve, reject) => {
      // Handle errors during the streaming process
      const handleError = (error: Error) => {
        this.debugLog('MediaSource streaming error:', error);
        cleanup();
        reject(error);
      };
      
      // Clean up resources
      const cleanup = () => {
        try {
          if (isMediaSourceOpen && mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
          URL.revokeObjectURL(audioUrl);
          isMediaSourceOpen = false;
          isSourceBufferValid = false;
          pendingChunks = [];
        } catch (e) {
          this.debugLog('Error during cleanup:', e);
        }
      };
  
      mediaSource.addEventListener('sourceopen', async () => {
        isMediaSourceOpen = true;
        this.debugLog('MediaSource opened');
        
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          isSourceBufferValid = true;
          
          // Set smaller segment size for lower latency
          if ('mode' in sourceBuffer) {
            try {
              sourceBuffer.mode = 'sequence';
            } catch (e) {
              this.debugLog('Could not set sourceBuffer mode:', e);
            }
          }
          
          // When a buffer update finishes, process the next chunk
          sourceBuffer.addEventListener('updateend', () => {
            processNextChunk();
            
            // Start playback as soon as we have a minimal buffer
            if (!playbackStarted && this.audio && pendingChunks.length >= 0 && 
                sourceBuffer && !sourceBuffer.updating) {
              this.startPlayback(this.audio, startTime).then(success => {
                playbackStarted = true;
                resolve(success);
              }).catch(err => {
                handleError(err);
              });
            }
            
            // Check if we're done streaming and all buffers are processed
            if (streamingComplete && pendingChunks.length === 0 && 
                sourceBuffer && !sourceBuffer.updating && 
                isMediaSourceOpen && mediaSource.readyState === 'open') {
              try {
                mediaSource.endOfStream();
                this.debugLog(`[Timing] Streaming complete after ${Date.now() - startTime}ms`);
              } catch (e) {
                this.debugLog('Error ending media stream:', e);
              }
            }
          });
          
          const reader = response.body?.getReader();
          
          if (!reader) {
            handleError(new Error('No reader available from response'));
            return;
          }
          
          let firstChunk = true;
          let chunks = 0;
          
          // Process audio chunks as they arrive
          while (true) {
            try {
              const { done, value } = await reader.read();
              
              if (done) {
                streamingComplete = true;
                
                // Check if we can end the stream immediately
                if (pendingChunks.length === 0 && sourceBuffer && 
                    !sourceBuffer.updating && isMediaSourceOpen && 
                    mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                  this.debugLog(`[Timing] Streaming complete after ${Date.now() - startTime}ms`);
                }
                
                break;
              }
              
              if (value && isSourceBufferValid && isMediaSourceOpen) {
                chunks++;
                
                // Add chunk to pending queue
                pendingChunks.push(value);
                
                // If this is the first chunk, process it immediately
                if (firstChunk) {
                  const firstChunkTime = Date.now() - startTime;
                  this.debugLog(`[Timing] First chunk received after ${firstChunkTime}ms`);
                  
                  // Process the first chunk immediately
                  processNextChunk();
                  firstChunk = false;
                } else {
                  // Process next chunk if possible
                  processNextChunk();
                }
              }
            } catch (e) {
              handleError(e instanceof Error ? e : new Error(String(e)));
              break;
            }
          }
        } catch (e) {
          handleError(e instanceof Error ? e : new Error(String(e)));
        }
      });
      
      mediaSource.addEventListener('sourceclose', () => {
        isMediaSourceOpen = false;
        isSourceBufferValid = false;
        this.debugLog('MediaSource closed');
      });
      
      // Set up cleanup
      if (this.audio) {
        this.audio.onended = () => {
          this.debugLog('Audio playback ended');
          
          // Clean up
          cleanup();
          this.isSpeaking = false;
          
          if (this.conversationMode) {
            this.startListening();
          }
        };
      }
      
      // Set a timeout in case mediaSource never opens
      setTimeout(() => {
        if (!isMediaSourceOpen) {
          handleError(new Error('MediaSource failed to open'));
        }
      }, 5000);
    });
  }
  
  // Helper method to start playback
  private async startPlayback(audio: HTMLAudioElement, startTime: number): Promise<boolean> {
    try {
      await audio.play();
      this.debugLog(`[Timing] Audio playback started with MediaSource: ${Date.now() - startTime}ms total delay`);
      this.autoplayBlocked = false;
      return true;
    } catch (e: any) {
      this.debugLog('Audio autoplay error:', e);
      if (e.name === 'NotAllowedError') {
        this.autoplayBlocked = true;
        this.emitAutoplayBlocked();
      }
      throw e;
    }
  }

  async stopSpeaking() {
    if (this.audio && this.isSpeaking) {
      this.debugLog('Stopping speech');
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isSpeaking = false;
    }
  }

  // Add helper for autoplay policy
  async ensureAudioPermission() {
    if (this.autoplayBlocked) {
      try {
        // Create temporary silent audio
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYzzmQwNYaRkZGXGyZek9L9bNas4s4pq7f+OIeT//9v7r/GmRxP/46/yZ/3z/+67eydHBAUBoGGCGMYYQzwMt0O4mH/JhMpBUAGWR7gzcB9wAAQAI8Z2XNAnSNFxkQgDX9n2f27AGjJAEMpznTIAMtwNMyDW8vzv66j6//7tMxBMDeiIRpmBe+wFaw1m0G3+z/ItaRFRWNaRERERERERERERBWtaBWuQgDX//JWu1qdRUiIiIiIhGP/1P/3dt//////tD//XZ/87uI/14iIiIiIiIiIiIiIiIhu7u7tVREREREREA/AAAAH/0Tf9wZ9zf7cx26Xn/nf//nXuiIiIiIiIiIiIiIiIiIiI7u7u7u7u7u7u1REa5iIiIiIiJMZ3juIiIiIiIiNMTHZ3juNCIiIiIiIiIiO7u7u7u7u7VERE7IiIiIiGIiIiIiIiIiIiI7u7u7u7u7VURERFf/7UsQAg851cJZ8ZI1g///EeOAP';
        await silentAudio.play();
        silentAudio.pause();
        this.autoplayBlocked = false;
        return true;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  // Add method to emit autoplay blocked event
  emitAutoplayBlocked() {
    if (this.onAutoplayBlocked) {
      this.onAutoplayBlocked();
    }
  }

  // Add fallback playback method using Web Audio API
  async playAudioWithWebAudio(audioBuffer: ArrayBuffer): Promise<boolean> {
    if (!this.audioContext) return false;
    
    try {
      const audioData = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioData;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.isSpeaking = false;
        if (this.conversationMode) {
          this.startListening();
        }
      };
      
      source.start(0);
      return true;
    } catch (e) {
      console.error('Web Audio API playback failed:', e);
      return false;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  isInConversationMode(): boolean {
    return this.conversationMode;
  }

  isAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  setAutoplayBlockedCallback(callback: () => void) {
    this.onAutoplayBlocked = callback;
  }

  // Web Speech API for immediate feedback
  private webSpeechUtterance: SpeechSynthesisUtterance | null = null;
  
  private startWebSpeechFeedback(text: string) {
    // Only use for longer texts where the wait would be noticeable
    if (!window.speechSynthesis) return;
    
    try {
      // Make sure any previous utterance is stopped
      this.stopWebSpeechFeedback();
      
      // Just speak the first sentence for immediate feedback
      const firstSentence = text.split(/[.!?]/).filter(s => s.trim().length > 0)[0] + '.';
      
      this.webSpeechUtterance = new SpeechSynthesisUtterance(firstSentence);
      this.webSpeechUtterance.rate = 1.2; // Slightly faster
      this.webSpeechUtterance.volume = 0.8; // Slightly quieter than main voice
      
      this.debugLog('Starting Web Speech API feedback with first sentence:', firstSentence);
      window.speechSynthesis.speak(this.webSpeechUtterance);
    } catch (e) {
      this.debugLog('Web Speech API error:', e);
    }
  }
  
  private stopWebSpeechFeedback() {
    if (window.speechSynthesis) {
      this.debugLog('Stopping Web Speech API feedback');
      window.speechSynthesis.cancel();
      this.webSpeechUtterance = null;
    }
  }
}

export const speechHandler = new SpeechHandler();