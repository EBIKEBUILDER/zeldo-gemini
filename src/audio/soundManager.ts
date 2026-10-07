// Web Audio API Synthesizer - Zero external audio files

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private currentMusicTheme: 'overworld' | 'dungeon' | 'boss' | 'none' = 'none';
  private musicInterval: number | null = null;
  private musicStep: number = 0;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public ensureAudio() {
    this.initContext();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --- SOUND EFFECTS ---

  // 1. Sword Swing: crisp white noise sweep + gentle resonant pitch drop
  public playSwordSwing() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.16);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.17);

    // Add brief noise transient
    this.playNoiseBurst(0.08, 1200, 300, 0.2);
  }

  // 2. Sword Hit: metallic clang on enemy
  public playSwordHit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(780, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.14);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1240, now);
    osc2.frequency.exponentialRampToValueAtTime(310, now + 0.14);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
  }

  // 3. Enemy Hurt: crunchy squash pitch slide
  public playEnemyHurt() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  // 4. Enemy Death: nostalgic poof chime + low rumble
  public playEnemyDeath() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playNoiseBurst(0.24, 800, 100, 0.4);

    const now = this.ctx.currentTime;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  // 5. Player Hurt: impactful thump
  public playPlayerHurt() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.26);

    this.playNoiseBurst(0.18, 600, 80, 0.35);
  }

  // 6. Rupee Pickup: classic two-tone sparkle (B5 -> E6)
  public playRupeePickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [987.77, 1318.51]; // B5, E6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  // 7. Heart Pickup: warm ascending arpeggio (C5 -> E5 -> G5 -> C6)
  public playHeartPickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  // 8. Grass Cut: crisp leaf slice
  public playGrassCut() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playNoiseBurst(0.12, 3200, 900, 0.25);
  }

  // 9. Pot Smash: ceramic crunch & shards
  public playPotSmash() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playNoiseBurst(0.18, 1600, 200, 0.45);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // 10. Key Pickup: triumphant Zeldo-style 4-note stinger
  public playKeyPickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 392.0, d: 0.14 }, // G4
      { f: 523.25, d: 0.14 }, // C5
      { f: 659.25, d: 0.14 }, // E5
      { f: 783.99, d: 0.45 }, // G5
    ];

    let t = now;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + n.d + 0.05);

      t += n.d * 0.9;
    });
  }

  // 11. Gate Unlock: heavy stone rumble & iron bars
  public playGateUnlock() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    this.playNoiseBurst(0.8, 400, 60, 0.4);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.7);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.75);
  }

  // 12. Chest Open: iconic crescendo fanfare ending in a brilliant chord!
  public playChestOpen() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const arpeggio = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5

    arpeggio.forEach((freq, idx) => {
      const t = now + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.36);
    });

    // Sustained high triumphant chord at the end
    const finalTime = now + arpeggio.length * 0.12;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, finalTime);

      gain.gain.setValueAtTime(0.28, finalTime);
      gain.gain.exponentialRampToValueAtTime(0.001, finalTime + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(finalTime);
      osc.stop(finalTime + 1.25);
    });
  }

  // 13. Boss Roar
  public playBossRoar() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(14, now);
    lfoGain.gain.setValueAtTime(25, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.65);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.7);
    osc.stop(now + 0.7);

    this.playNoiseBurst(0.5, 450, 70, 0.35);
  }

  // 14. Game Over Melancholy Stinger
  public playGameOver() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 370.0, d: 0.3 }, // F#4
      { f: 349.23, d: 0.3 }, // F4
      { f: 329.63, d: 0.3 }, // E4
      { f: 311.13, d: 0.8 }, // Eb4
    ];

    let t = now;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + n.d + 0.05);

      t += n.d * 0.95;
    });
  }

  // 15. Victory Fanfare
  public playVictory() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.18 }, // C5
      { f: 523.25, d: 0.18 }, // C5
      { f: 523.25, d: 0.18 }, // C5
      { f: 523.25, d: 0.35 }, // C5
      { f: 415.3, d: 0.35 },  // Ab4
      { f: 466.16, d: 0.35 }, // Bb4
      { f: 523.25, d: 0.5 },  // C5
      { f: 466.16, d: 0.2 },  // Bb4
      { f: 523.25, d: 1.0 },  // C5
    ];

    let t = now;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + n.d + 0.05);

      t += n.d * 0.88;
    });
  }

  // Noise generator for hits, debris, poofs
  private playNoiseBurst(duration: number, startFreq: number, endFreq: number, volume: number) {
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const now = this.ctx.currentTime;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  // --- PROCEDURAL BACKGROUND CHIPTUNE MUSIC ---
  public startMusic(theme: 'overworld' | 'dungeon' | 'boss') {
    if (this.currentMusicTheme === theme && this.musicInterval) return;
    this.stopMusic();
    this.currentMusicTheme = theme;
    this.musicStep = 0;

    this.initContext();

    // 16-step retro pattern sequencer
    const bpm = theme === 'boss' ? 140 : theme === 'overworld' ? 116 : 92;
    const intervalMs = (60 / bpm / 2) * 1000; // eighth notes

    // Melodic pitch scales
    const overworldMelody = [
      392.0, 0, 523.25, 587.33, 659.25, 0, 783.99, 659.25,
      587.33, 523.25, 440.0, 523.25, 587.33, 0, 392.0, 0,
    ];
    const overworldBass = [
      130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196.0, 196.0,
      130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 196.0, 196.0,
    ];

    const dungeonMelody = [
      220.0, 0, 261.63, 0, 311.13, 0, 261.63, 0,
      220.0, 0, 196.0, 0, 207.65, 0, 220.0, 0,
    ];
    const dungeonBass = [
      55.0, 0, 55.0, 0, 65.41, 0, 55.0, 0,
      49.0, 0, 49.0, 0, 51.91, 0, 55.0, 0,
    ];

    const bossMelody = [
      146.83, 146.83, 220.0, 146.83, 130.81, 146.83, 174.61, 164.81,
      146.83, 146.83, 293.66, 146.83, 261.63, 220.0, 196.0, 174.61,
    ];
    const bossBass = [
      73.42, 73.42, 73.42, 73.42, 65.41, 65.41, 87.31, 82.41,
      73.42, 73.42, 73.42, 73.42, 65.41, 65.41, 55.0, 65.41,
    ];

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.isMuted) return;

      const step = this.musicStep % 16;
      let mNote = 0;
      let bNote = 0;

      if (theme === 'overworld') {
        mNote = overworldMelody[step];
        bNote = overworldBass[step];
      } else if (theme === 'dungeon') {
        mNote = dungeonMelody[step];
        bNote = dungeonBass[step];
      } else if (theme === 'boss') {
        mNote = bossMelody[step];
        bNote = bossBass[step];
      }

      const now = this.ctx.currentTime;

      // Play bass note
      if (bNote > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = theme === 'boss' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(bNote, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (intervalMs / 1000) * 0.9);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + intervalMs / 1000);
      }

      // Play lead melody note
      if (mNote > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = theme === 'dungeon' ? 'sine' : 'square';
        osc.frequency.setValueAtTime(mNote, now);

        gain.gain.setValueAtTime(theme === 'dungeon' ? 0.16 : 0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (intervalMs / 1000) * 0.85);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + intervalMs / 1000);
      }

      this.musicStep++;
    }, intervalMs);
  }

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentMusicTheme = 'none';
  }
}

export const soundManager = new SoundManager();
