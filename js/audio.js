/**
 * Sistema de Audio Procedimental para Flora: Ayúdala a mantener la calma
 * Implementado enteramente con Web Audio API (sin dependencias externas ni archivos de audio)
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('flora_audio_muted') === 'true';
    this.ambientGain = null;
    this.masterGain = null;
    this.isAmbientPlaying = false;
    this.ambientTimer = null;
    this.tensionLevel = 0; // 0: Calma, 1: Aumento, 2: Alta presión
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    localStorage.setItem('flora_audio_muted', this.isMuted ? 'true' : 'false');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // --- EFECTOS DE SONIDO ---

  /**
   * Sonido de deslizamiento de la cuchilla / rastro
   */
  playSwoosh(intensity = 1.0) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.14;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.0, t);
    filter.frequency.setValueAtTime(800 * intensity, t);
    filter.frequency.exponentialRampToValueAtTime(3200 * intensity, t + 0.06);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.13);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.22 * Math.min(1.5, intensity), t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.14);
  }

  /**
   * Sonido crujiente y satisfactorio de corte vegetal
   */
  playSlice(comboTier = 1) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Crujido de corte (Noise snap)
    const snapLen = this.ctx.sampleRate * 0.07;
    const snapBuf = this.ctx.createBuffer(1, snapLen, this.ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapLen * 0.25));
    }
    const snapSource = this.ctx.createBufferSource();
    snapSource.buffer = snapBuf;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(1400, t);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.35, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    snapSource.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapSource.start(t);

    // 2. Tono resonante brillante del corte (hojas frescas)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const baseFreq = 520 + (comboTier * 90);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, t + 0.14);

    oscGain.gain.setValueAtTime(0.28, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Brote que surge de la tierra
   */
  playBrotePop() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.07);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * La planta madura y se vuelve CORTABLE
   */
  playPlantMature() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [659.25, 880.0]; // E5, A5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);

      gain.gain.setValueAtTime(0.08, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.22);
    });
  }

  /**
   * Acorde de combo creciente
   */
  playCombo(level) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const scale = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
    const t = this.ctx.currentTime;
    const count = Math.min(scale.length, level + 1);

    for (let i = 0; i < count; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(scale[i], t + i * 0.05);

      gain.gain.setValueAtTime(0.18, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.38);
    }
  }

  /**
   * Enredo: una planta atrapa a Flora
   */
  playEntangle(currentCount) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Disolución / acorde tenso menor
    const freqs = [220, 261.63, 311.13]; // A3, C4, Eb4 (disminuido)
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 0.35);

      gain.gain.setValueAtTime(0.15 + (currentCount * 0.04), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });

    // Crujido de enredadera
    const len = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / 15);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  /**
   * Notificación sonora de cambio de fase de dificultad
   */
  playPhaseSpike(phaseName) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Campana tibetana / cuenco de advertencia
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(phaseName === 'chaos' ? 440 : 330, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.25);
  }

  /**
   * Victoria: ¡Lo lograste! Campanas alegres
   */
  playVictory() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5 to G6
    melody.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);

      gain.gain.setValueAtTime(0.22, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.95);
    });
  }

  /**
   * Fin de partida: Flora abrumada
   */
  playGameOver() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.18);

      gain.gain.setValueAtTime(0.2, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.85);
    });
  }

  // --- AMBIENTE DE MEDITACIÓN Y PRESIÓN GRADUAL ---

  setTensionLevel(level) {
    this.tensionLevel = level;
  }

  startAmbient() {
    this.ensureContext();
    if (this.isAmbientPlaying || !this.ctx) return;
    this.isAmbientPlaying = true;
    this._scheduleAmbientChime();
  }

  stopAmbient() {
    this.isAmbientPlaying = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  _scheduleAmbientChime() {
    if (!this.isAmbientPlaying || !this.ctx) return;

    // Escala pentatónica zen: D4, F#4, A4, B4, D5
    const zenNotes = [293.66, 369.99, 440.00, 493.88, 587.33];
    const note = zenNotes[Math.floor(Math.random() * zenNotes.length)];
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, t);

    // Si la tensión es alta, las notas son más cortas y presentes
    const sustain = this.tensionLevel === 2 ? 1.5 : (this.tensionLevel === 1 ? 2.5 : 4.0);
    const volume = this.tensionLevel === 2 ? 0.12 : 0.08;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + sustain);

    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(t);
    osc.stop(t + sustain + 0.1);

    // Pulso sutil de tensión en fases avanzadas
    if (this.tensionLevel > 0) {
      const pulseOsc = this.ctx.createOscillator();
      const pulseGain = this.ctx.createGain();
      pulseOsc.type = 'triangle';
      pulseOsc.frequency.setValueAtTime(this.tensionLevel === 2 ? 110 : 82.4, t);
      pulseGain.gain.setValueAtTime(0.05, t);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(this.ambientGain);
      pulseOsc.start(t);
      pulseOsc.stop(t + 0.45);
    }

    const nextDelay = this.tensionLevel === 2 ? (800 + Math.random() * 600) :
                     (this.tensionLevel === 1 ? (1600 + Math.random() * 1000) :
                     (2800 + Math.random() * 1800));

    this.ambientTimer = setTimeout(() => {
      this._scheduleAmbientChime();
    }, nextDelay);
  }
}

window.audioManager = new AudioManager();
