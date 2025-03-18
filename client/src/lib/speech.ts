declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export class SpeechHandler {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isSpeaking: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];

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
    this.synthesis = window.speechSynthesis;

    // Initialize voices
    this.loadVoices();
    this.synthesis.onvoiceschanged = () => {
      this.loadVoices();
    };
  }

  private loadVoices() {
    this.voices = this.synthesis.getVoices();
  }

  private formatTextForNaturalSpeech(text: string): string {
    // Add periods if missing at the end of sentences
    text = text.replace(/([a-z])\s+([A-Z])/g, '$1. $2');

    // Ensure proper spacing after punctuation
    text = text.replace(/([.,!?])([A-Za-z])/g, '$1 $2');

    // Add slight pauses for commas and longer pauses for periods
    text = text.replace(/,/g, ', ');
    text = text.replace(/\./g, '... ');

    return text;
  }

  private selectBestVoice(): SpeechSynthesisVoice | null {
    const preferredVoices = [
      { name: 'Samantha', score: 5 },      // MacOS (very natural)
      { name: 'David', score: 4 },         // MacOS (natural male voice)
      { name: 'Google UK English Female', score: 4 }, // Chrome (good quality)
      { name: 'Microsoft Zira', score: 3 }, // Windows (decent)
      { name: 'Google US English', score: 3 } // Chrome (backup)
    ];

    let bestVoice = null;
    let highestScore = -1;

    for (const voice of this.voices) {
      if (!voice.lang.startsWith('en')) continue;

      for (const pv of preferredVoices) {
        if (voice.name.includes(pv.name) && pv.score > highestScore) {
          bestVoice = voice;
          highestScore = pv.score;
        }
      }
    }

    return bestVoice || this.voices.find(v => v.lang.startsWith('en')) || null;
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

  speak(text: string) {
    if (!this.synthesis) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    try {
      const formattedText = this.formatTextForNaturalSpeech(text);
      const utterance = new SpeechSynthesisUtterance(formattedText);

      const selectedVoice = this.selectBestVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Adjust speech parameters for more natural sound
      utterance.rate = 0.85;     // Slightly slower for clarity
      utterance.pitch = 1.05;    // Very slightly higher pitch
      utterance.volume = 1.0;    // Full volume
      utterance.lang = 'en-US';

      this.isSpeaking = true;

      utterance.onend = () => {
        this.isSpeaking = false;
      };

      // Add a small delay before speaking for more natural interaction
      setTimeout(() => {
        this.synthesis.speak(utterance);
      }, 200);
    } catch (err) {
      console.error('Error with speech synthesis:', err);
      this.isSpeaking = false;
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