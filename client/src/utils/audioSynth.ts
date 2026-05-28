// High-tech sci-fi Sound Effects Generator using Web Audio API
// This operates completely within the client browser, requiring no assets.

// Persisted mute flag — affects both the synth (beeps/startup) and is read
// from elsewhere (Admin.tsx handleReadAloud) to silence ElevenLabs / browser TTS.
const MUTE_KEY = "dumpster.admin.muted";
let _muted = false;
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* SSR */ }

type MuteListener = (muted: boolean) => void;
const _muteListeners = new Set<MuteListener>();

export function isMuted(): boolean { return _muted; }
export function setMuted(next: boolean): void {
  _muted = next;
  try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* SSR */ }
  // Stop in-flight TTS when muting
  if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
  _muteListeners.forEach(fn => { try { fn(next); } catch { /* noop */ } });
}
export function onMuteChange(fn: MuteListener): () => void {
  _muteListeners.add(fn);
  return () => _muteListeners.delete(fn);
}

class SciFiSynth {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      // @ts-ignore
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    // Resume context if suspended
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // A brief, nice high-pitch confirmation sound
  playBeep(frequency = 880, duration = 0.08, type: OscillatorType = 'sine') {
    if (_muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      
      // Pitch slide upward for active/positive feel
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, this.ctx.currentTime + duration);

      gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio context might fail block by browser permissions
      console.warn("Audio feedback block", e);
    }
  }

  // Tech startup sequence
  playStartup() {
    if (_muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C major chord arpeggio
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  // System diagnostic scan sound
  playScan() {
    if (_muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      // Sweeping frequency
      osc.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.6);

      // Low pass filter to make it sound muffled and futuristic
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.61);
    } catch (e) {
      console.warn(e);
    }
  }

  // Error alert sound
  playAlert() {
    if (_muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.frequency.setValueAtTime(220, now);
      osc2.frequency.setValueAtTime(225, now); // Slightly detuned

      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(now + 0.31);
      osc2.stop(now + 0.31);
    } catch (e) {
      console.warn(e);
    }
  }
}

export const sfx = new SciFiSynth();
