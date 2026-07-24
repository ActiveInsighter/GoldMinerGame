/**
 * Small, asset-free audio engine for the game.
 *
 * Browsers only allow an AudioContext to start in a user gesture. Call
 * `await gameAudio.init()` from the first click, pointer or keyboard handler,
 * then use `play` and `startMusic`.
 */

export const SOUND_EFFECTS = [
  "launch",
  "grab",
  "diamond",
  "explosion",
  "settle",
  "warning",
  "success",
  "failure",
  "click",
] as const;

export type SoundEffect = (typeof SOUND_EFFECTS)[number];

export interface AudioSettings {
  /** Master volume, clamped to the inclusive 0-1 range. */
  volume: number;
  /** Global mute. This does not forget the previous volume. */
  muted: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
}

export type GameAudioOptions = Partial<AudioSettings>;

type AudioBus = "sfx" | "music";

interface ToneOptions {
  start: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  gain?: number;
  type?: OscillatorType;
  detune?: number;
}

interface NoiseOptions {
  start: number;
  duration: number;
  gain?: number;
  frequency?: number;
  filterType?: BiquadFilterType;
  q?: number;
}

const DEFAULT_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  volume: 0.72,
  muted: false,
  sfxEnabled: true,
  musicEnabled: true,
});

const MUSIC_STEP_SECONDS = 60 / 112 / 2;
const MUSIC_LOOKAHEAD_SECONDS = 0.35;
const MUSIC_TIMER_MS = 100;

// An original, short arpeggio intended to sit quietly under gameplay.
const MUSIC_MELODY = [
  329.63, 392.0, 523.25, 392.0,
  293.66, 369.99, 493.88, 369.99,
  261.63, 329.63, 440.0, 329.63,
  293.66, 369.99, 440.0, 493.88,
] as const;

const MUSIC_BASS = [130.81, 146.83, 110.0, 146.83] as const;

function clampVolume(value: number, fallback = DEFAULT_SETTINGS.volume): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeOscillators = new Set<OscillatorNode>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicNextNoteTime = 0;
  private musicStep = 0;
  private musicRequested = false;
  private destroyed = false;
  private settings: AudioSettings;

  constructor(options: GameAudioOptions = {}) {
    this.settings = {
      volume: clampVolume(options.volume ?? DEFAULT_SETTINGS.volume),
      muted: options.muted ?? DEFAULT_SETTINGS.muted,
      sfxEnabled: options.sfxEnabled ?? DEFAULT_SETTINGS.sfxEnabled,
      musicEnabled: options.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
    };
  }

  /**
   * Creates and resumes the Web Audio context.
   *
   * Invoke this from a user gesture. It is safe to call repeatedly and returns
   * false on the server, in unsupported browsers, or when audio is blocked.
   */
  async init(): Promise<boolean> {
    if (this.destroyed) {
      return false;
    }

    try {
      if (!this.context) {
        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) {
          return false;
        }

        const context = new AudioContextConstructor();
        const masterGain = context.createGain();
        const sfxGain = context.createGain();
        const musicGain = context.createGain();

        sfxGain.connect(masterGain);
        musicGain.connect(masterGain);
        masterGain.connect(context.destination);

        this.context = context;
        this.masterGain = masterGain;
        this.sfxGain = sfxGain;
        this.musicGain = musicGain;
        this.applyGainSettings(true);
      }

      if (
        this.context.state !== "running" &&
        this.context.state !== "closed"
      ) {
        await this.context.resume();
      }

      const ready = this.context.state === "running";
      if (ready && this.musicRequested && this.settings.musicEnabled) {
        this.beginMusicScheduler();
      }
      return ready;
    } catch {
      return false;
    }
  }

  /** Alias that makes the intended first-interaction usage explicit. */
  unlock(): Promise<boolean> {
    return this.init();
  }

  get isInitialized(): boolean {
    return this.context !== null && this.context.state !== "closed";
  }

  get isReady(): boolean {
    return this.context?.state === "running";
  }

  get isMusicPlaying(): boolean {
    return this.musicTimer !== null;
  }

  getSettings(): Readonly<AudioSettings> {
    return { ...this.settings };
  }

  setVolume(volume: number): number {
    this.settings.volume = clampVolume(volume, this.settings.volume);
    this.applyGainSettings();
    return this.settings.volume;
  }

  setMuted(muted: boolean): boolean {
    this.settings.muted = Boolean(muted);
    this.applyGainSettings();
    return this.settings.muted;
  }

  toggleMuted(): boolean {
    return this.setMuted(!this.settings.muted);
  }

  setSfxEnabled(enabled: boolean): boolean {
    this.settings.sfxEnabled = Boolean(enabled);
    this.applyGainSettings();
    return this.settings.sfxEnabled;
  }

  setMusicEnabled(enabled: boolean): boolean {
    this.settings.musicEnabled = Boolean(enabled);
    this.applyGainSettings();

    if (!this.settings.musicEnabled) {
      this.pauseMusicScheduler();
    } else if (this.musicRequested && this.isReady) {
      this.beginMusicScheduler();
    }

    return this.settings.musicEnabled;
  }

  configure(settings: Partial<AudioSettings>): Readonly<AudioSettings> {
    if (settings.volume !== undefined) {
      this.setVolume(settings.volume);
    }
    if (settings.muted !== undefined) {
      this.setMuted(settings.muted);
    }
    if (settings.sfxEnabled !== undefined) {
      this.setSfxEnabled(settings.sfxEnabled);
    }
    if (settings.musicEnabled !== undefined) {
      this.setMusicEnabled(settings.musicEnabled);
    }
    return this.getSettings();
  }

  /**
   * Plays one synthesized effect. Returns false when audio has not been
   * unlocked, is muted, or sound effects are disabled.
   */
  play(effect: SoundEffect): boolean {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      this.settings.muted ||
      !this.settings.sfxEnabled ||
      this.settings.volume <= 0
    ) {
      return false;
    }

    const now = context.currentTime + 0.005;

    try {
      switch (effect) {
        case "launch":
          this.tone("sfx", {
            start: now,
            duration: 0.19,
            frequency: 430,
            endFrequency: 125,
            gain: 0.14,
            type: "sawtooth",
          });
          this.noise("sfx", {
            start: now,
            duration: 0.12,
            gain: 0.035,
            frequency: 1_500,
            filterType: "bandpass",
            q: 1.8,
          });
          break;

        case "grab":
          this.tone("sfx", {
            start: now,
            duration: 0.13,
            frequency: 190,
            endFrequency: 82,
            gain: 0.2,
            type: "square",
          });
          this.tone("sfx", {
            start: now + 0.015,
            duration: 0.09,
            frequency: 720,
            endFrequency: 280,
            gain: 0.08,
            type: "triangle",
          });
          break;

        case "diamond":
          [880, 1_174.66, 1_479.98, 1_760].forEach((frequency, index) => {
            this.tone("sfx", {
              start: now + index * 0.055,
              duration: 0.24,
              frequency,
              endFrequency: frequency * 1.015,
              gain: 0.085,
              type: "sine",
            });
          });
          break;

        case "explosion":
          this.noise("sfx", {
            start: now,
            duration: 0.62,
            gain: 0.32,
            frequency: 260,
            filterType: "lowpass",
            q: 0.8,
          });
          this.tone("sfx", {
            start: now,
            duration: 0.48,
            frequency: 105,
            endFrequency: 34,
            gain: 0.27,
            type: "sine",
          });
          break;

        case "settle":
          [523.25, 659.25, 783.99, 1_046.5].forEach((frequency, index) => {
            this.tone("sfx", {
              start: now + index * 0.075,
              duration: 0.16,
              frequency,
              endFrequency: frequency * 1.02,
              gain: 0.1,
              type: "triangle",
            });
          });
          break;

        case "warning":
          [0, 0.17, 0.34].forEach((offset) => {
            this.tone("sfx", {
              start: now + offset,
              duration: 0.11,
              frequency: 185,
              endFrequency: 165,
              gain: 0.17,
              type: "square",
            });
          });
          break;

        case "success":
          [523.25, 659.25, 783.99, 1_046.5].forEach((frequency, index) => {
            this.tone("sfx", {
              start: now + index * 0.105,
              duration: index === 3 ? 0.55 : 0.22,
              frequency,
              gain: 0.13,
              type: "triangle",
            });
          });
          [523.25, 659.25, 783.99].forEach((frequency) => {
            this.tone("sfx", {
              start: now + 0.42,
              duration: 0.52,
              frequency,
              gain: 0.055,
              type: "sine",
            });
          });
          break;

        case "failure":
          [392, 329.63, 261.63, 196].forEach((frequency, index) => {
            this.tone("sfx", {
              start: now + index * 0.14,
              duration: index === 3 ? 0.5 : 0.2,
              frequency,
              endFrequency: frequency * 0.92,
              gain: 0.13,
              type: "triangle",
            });
          });
          break;

        case "click":
          this.tone("sfx", {
            start: now,
            duration: 0.065,
            frequency: 640,
            endFrequency: 520,
            gain: 0.09,
            type: "sine",
          });
          break;
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Convenience alias for call sites that prefer an explicit SFX name. */
  playSfx(effect: SoundEffect): boolean {
    return this.play(effect);
  }

  /**
   * Starts the synthesized loop after audio has been initialized.
   *
   * Calling before `init` records the intent but returns false; a subsequent
   * successful `init` will start it. `stopMusic` clears that intent.
   */
  startMusic(): boolean {
    if (this.destroyed) {
      return false;
    }

    this.musicRequested = true;
    if (!this.isReady || !this.settings.musicEnabled) {
      return false;
    }

    this.applyGainSettings();
    this.beginMusicScheduler();
    return true;
  }

  stopMusic(): void {
    this.musicRequested = false;
    this.pauseMusicScheduler();
    this.applyGainSettings();
  }

  /**
   * Stops all scheduled sound and closes the AudioContext.
   * A destroyed instance is intentionally not reusable.
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stopMusic();

    for (const oscillator of this.activeOscillators) {
      try {
        oscillator.stop();
      } catch {
        // The node may already have stopped.
      }
    }
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // The node may already have stopped.
      }
    }
    this.activeOscillators.clear();
    this.activeSources.clear();

    const context = this.context;
    this.context = null;
    this.sfxGain = null;
    this.musicGain = null;

    try {
      this.masterGain?.disconnect();
    } catch {
      // Disconnection is best effort during teardown.
    }
    this.masterGain = null;

    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Closing can fail if the document is already being torn down.
      }
    }
  }

  private applyGainSettings(immediate = false): void {
    const context = this.context;
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const masterValue = this.settings.muted ? 0 : this.settings.volume;
    const sfxValue = this.settings.sfxEnabled ? 1 : 0;
    const musicValue =
      this.settings.musicEnabled && this.musicRequested ? 0.24 : 0;

    this.setGain(this.masterGain, masterValue, now, immediate);
    this.setGain(this.sfxGain, sfxValue, now, immediate);
    this.setGain(this.musicGain, musicValue, now, immediate);
  }

  private setGain(
    node: GainNode | null,
    value: number,
    at: number,
    immediate: boolean,
  ): void {
    if (!node) {
      return;
    }
    node.gain.cancelScheduledValues(at);
    if (immediate) {
      node.gain.setValueAtTime(value, at);
    } else {
      node.gain.setTargetAtTime(value, at, 0.018);
    }
  }

  private getBus(bus: AudioBus): GainNode | null {
    return bus === "sfx" ? this.sfxGain : this.musicGain;
  }

  private tone(bus: AudioBus, options: ToneOptions): void {
    const context = this.context;
    const destination = this.getBus(bus);
    if (!context || !destination) {
      return;
    }

    const duration = Math.max(0.02, options.duration);
    const start = Math.max(context.currentTime, options.start);
    const end = start + duration;
    const peak = Math.max(0.0001, options.gain ?? 0.1);
    const attack = Math.min(0.018, duration * 0.22);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = options.type ?? "sine";
    oscillator.detune.setValueAtTime(options.detune ?? 0, start);
    oscillator.frequency.setValueAtTime(Math.max(1, options.frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency ?? options.frequency),
      end,
    );

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(envelope);
    envelope.connect(destination);
    this.activeOscillators.add(oscillator);
    oscillator.addEventListener(
      "ended",
      () => {
        this.activeOscillators.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );

    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  private noise(bus: AudioBus, options: NoiseOptions): void {
    const context = this.context;
    const destination = this.getBus(bus);
    if (!context || !destination) {
      return;
    }

    const duration = Math.max(0.02, options.duration);
    const start = Math.max(context.currentTime, options.start);
    const end = start + duration;
    const frameCount = Math.max(1, Math.ceil(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) {
      const decay = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * decay;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const peak = Math.max(0.0001, options.gain ?? 0.12);

    source.buffer = buffer;
    filter.type = options.filterType ?? "lowpass";
    filter.frequency.setValueAtTime(options.frequency ?? 700, start);
    filter.Q.setValueAtTime(options.q ?? 0.7, start);
    envelope.gain.setValueAtTime(peak, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    this.activeSources.add(source);
    source.addEventListener(
      "ended",
      () => {
        this.activeSources.delete(source);
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );

    source.start(start);
    source.stop(end + 0.01);
  }

  private beginMusicScheduler(): void {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      this.musicTimer !== null ||
      !this.settings.musicEnabled
    ) {
      return;
    }

    this.musicNextNoteTime = context.currentTime + 0.035;
    this.scheduleMusic();
    this.musicTimer = setInterval(() => {
      this.scheduleMusic();
    }, MUSIC_TIMER_MS);
  }

  private pauseMusicScheduler(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      !this.settings.musicEnabled ||
      !this.musicRequested
    ) {
      return;
    }

    const scheduleUntil = context.currentTime + MUSIC_LOOKAHEAD_SECONDS;
    if (this.musicNextNoteTime < context.currentTime - MUSIC_STEP_SECONDS) {
      // Timers are throttled in background tabs. Skip missed notes instead of
      // scheduling a large burst when the page becomes active again.
      this.musicNextNoteTime = context.currentTime + 0.035;
    }
    while (this.musicNextNoteTime < scheduleUntil) {
      const step = this.musicStep % MUSIC_MELODY.length;
      const melodyFrequency = MUSIC_MELODY[step];

      this.tone("music", {
        start: this.musicNextNoteTime,
        duration: MUSIC_STEP_SECONDS * 0.72,
        frequency: melodyFrequency,
        endFrequency: melodyFrequency * 0.998,
        gain: step % 4 === 0 ? 0.22 : 0.14,
        type: "triangle",
      });

      if (step % 4 === 0) {
        const bassFrequency = MUSIC_BASS[Math.floor(step / 4) % MUSIC_BASS.length];
        this.tone("music", {
          start: this.musicNextNoteTime,
          duration: MUSIC_STEP_SECONDS * 3.25,
          frequency: bassFrequency,
          endFrequency: bassFrequency * 0.995,
          gain: 0.16,
          type: "sine",
        });
      }

      this.musicStep = (this.musicStep + 1) % MUSIC_MELODY.length;
      this.musicNextNoteTime += MUSIC_STEP_SECONDS;
    }
  }
}

export function createGameAudio(options: GameAudioOptions = {}): GameAudio {
  return new GameAudio(options);
}

/** SSR-safe shared instance. It stays dormant until `init` is called. */
export const gameAudio = createGameAudio();
