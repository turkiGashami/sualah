"use client";
// Procedural ambient audio via WebAudio — no binary files needed (and easy to
// swap for recorded files later). Atmosphere is part of v1 (§8.4): a night
// drone, a dawn chord, a reveal sting, death thud, and win fanfares.

type Winner = "village" | "monsters" | null;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambient: (() => void) | null = null;
  private enabled = false;

  async enable(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    await this.ctx.resume();
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  stopAmbient(): void {
    this.ambient?.();
    this.ambient = null;
  }

  forPhase(phase: string, winner: Winner = null): void {
    if (!this.enabled || !this.ctx) return;
    switch (phase) {
      case "night":
        this.night();
        break;
      case "dawn":
        this.stopAmbient();
        this.chord([523.25, 659.25, 783.99], 1.8);
        break;
      case "execution":
        this.stopAmbient();
        this.sting();
        break;
      case "ended":
        this.stopAmbient();
        if (winner === "village") this.chord([392, 493.88, 587.33, 783.99], 1.4);
        if (winner === "monsters") this.chord([196, 233.08, 277.18], 1.6);
        break;
      default:
        this.stopAmbient();
    }
  }

  private night(): void {
    const c = this.ctx!;
    this.stopAmbient();
    const now = c.currentTime;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(c.destination);
    gain.gain.linearRampToValueAtTime(0.1, now + 2.5);

    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 82.4;

    const lfo = c.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(o1.frequency);

    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.05;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    noise.connect(filter);
    filter.connect(gain);

    o1.connect(gain);
    o2.connect(gain);
    o1.start();
    o2.start();
    lfo.start();
    noise.start();

    this.ambient = () => {
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => {
        for (const n of [o1, o2, lfo, noise]) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
      }, 900);
    };
  }

  private chord(freqs: number[], dur: number): void {
    const c = this.ctx!;
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(c.destination);
    g.gain.linearRampToValueAtTime(0.16, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    for (const f of freqs) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(g);
      o.start(now);
      o.stop(now + dur);
    }
  }

  private sting(): void {
    const c = this.ctx!;
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(880, now);
    o.frequency.exponentialRampToValueAtTime(110, now + 0.55);
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.connect(g);
    g.connect(c.destination);
    o.start(now);
    o.stop(now + 0.6);
  }
}

export const sound = new SoundEngine();
