class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play realistic telephone ring / warm transfer alert chime
  playTelephoneRing(type: 'ring' | 'transfer_chime' | 'hangup') {
    try {
      const ctx = this.getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'ring') {
        // Standard US Ringback tone: 440Hz + 480Hz
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      } else if (type === 'transfer_chime') {
        // High alert pleasant two-tone bridging chime
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc1.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc1.stop(ctx.currentTime + 0.6);
      } else if (type === 'hangup') {
        osc1.frequency.setValueAtTime(480, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc1.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc1.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Audio tone play prevented:', e);
    }
  }

  // Play sleek, futuristic chime when a voice command is detected and executed
  playActionChime() {
    try {
      const ctx = this.getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      // C5 (523.25) -> G5 (783.99) -> C6 (1046.50) harmonious arpeggio
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.08);
      osc1.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.16);

      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('Chime play prevented:', e);
    }
  }

  // Soft listening pulse chirp when always-on listener awakens
  playListeningChirp() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn('Chirp play prevented:', e);
    }
  }

  // Soft sleep / power-down chirp when need-based voice listener turns off
  playSleepChirp() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(293.66, ctx.currentTime + 0.16); // D4

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn('Sleep chirp play prevented:', e);
    }
  }

  // Speak with human-like voice parameters
  speak(
    text: string, 
    options: {
      rate?: number;
      pitch?: number;
      gender?: 'female' | 'male';
      onStart?: () => void;
      onEnd?: () => void;
    } = {}
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        options.onEnd?.();
        resolve();
        return;
      }

      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Select natural sounding English voice
      const voices = this.synth.getVoices();
      const usVoices = voices.filter(v => v.lang.startsWith('en-US') || v.lang.startsWith('en'));
      
      // Look for natural high-quality female or male voices (Samantha, Victoria, Google US English, Jenny, Guy, etc.)
      let selectedVoice: SpeechSynthesisVoice | undefined;
      if (options.gender === 'male') {
        selectedVoice = usVoices.find(v => /Guy|David|Alex|George|Daniel|Male/i.test(v.name));
      } else {
        selectedVoice = usVoices.find(v => /Samantha|Victoria|Jenny|Zira|Female|Google US English/i.test(v.name));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else if (usVoices.length > 0) {
        utterance.voice = usVoices[0];
      }

      utterance.rate = options.rate ?? 1.02; // Slightly brisk, confident professional pace
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        options.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options.onEnd?.();
        resolve();
      };

      utterance.onerror = (err) => {
        console.warn('Speech synthesis error or canceled:', err);
        this.currentUtterance = null;
        options.onEnd?.();
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  isSpeaking(): boolean {
    return !!this.synth && this.synth.speaking;
  }
}

export const speechService = new SpeechService();
