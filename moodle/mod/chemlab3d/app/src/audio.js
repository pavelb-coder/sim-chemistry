/**
 * Процедурный звуковой движок на Web Audio API (без внешних аудиофайлов)
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.loops = {};
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted) {
      this.stopAll();
    } else {
      this.unlock();
    }
  }

  _noise() {
    if (!this.ctx) return null;
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  play(kind) {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    if (kind === 'clink') {
      // Лёгкий стеклянный звон посуды
      [1480, 2210].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.08 / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.18 + i * 0.05);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.24);
      });
    } else if (kind === 'pour') {
      // Короткое журчание приливания раствора
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(620, now);
      bp.frequency.linearRampToValueAtTime(1080, now + 0.35);
      bp.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.16, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      src.connect(bp).connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 0.4);
    } else if (kind === 'dropSolid') {
      // Падение гранулы в сосуд
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'ignite') {
      // Вспышка зажигания спиртовки
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(280, now + 0.24);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      src.connect(lp).connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 0.28);
    } else if (kind === 'popH2') {
      // Характерный «лающий» хлопок водорода
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);
      g.gain.setValueAtTime(0.34, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === 'flare') {
      // Вспышка магния / кислорода
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(1900, now);
      hp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      src.connect(hp).connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 0.58);
    } else if (kind === 'success') {
      // Приятный мажорный аккорд при успешной сдаче опыта
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.075;
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.48);
        osc.connect(g).connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.5);
      });
    } else if (kind === 'drip') {
      // Капля титранта из крана бюретки
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.085);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (kind === 'switch') {
      // Щелчок тумблера лабораторного прибора
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (kind === 'transfer') {
      // Мягкий шорох переноса сосуда между столами + лёгкое касание столешницы
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340, now);
      bp.frequency.exponentialRampToValueAtTime(780, now + 0.16);
      bp.frequency.exponentialRampToValueAtTime(290, now + 0.34);
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.005, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      src.connect(bp).connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 0.38);

      const osc = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now + 0.28);
      osc.frequency.exponentialRampToValueAtTime(185, now + 0.38);
      g2.gain.setValueAtTime(0.08, now + 0.28);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      osc.connect(g2).connect(this.master);
      osc.start(now + 0.28);
      osc.stop(now + 0.41);
    } else if (kind === 'muffleDoor') {
      // Металлический затвор дверцы муфельной печи ПМ-1000
      [310, 165].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.06;
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t0 + 0.11);
        g.gain.setValueAtTime(0.13, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
        osc.connect(g).connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.14);
      });
    }
  }

  updateLoops({ fizz = 0, flame = 0, furnace = 0 }) {
    if (this.muted || !this.ctx) return;
    this._setLoop('fizz', Math.min(1, fizz), 2400, 'bandpass', 0.12);
    this._setLoop('flame', Math.min(1, flame), 240, 'lowpass', 0.15);
    this._setLoop('furnace', Math.min(1, furnace), 135, 'lowpass', 0.09);
  }

  _setLoop(name, level, freq, filterType, maxGain) {
    let L = this.loops[name];
    if (level <= 0.02) {
      if (L) {
        try {
          L.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        } catch (e) {}
      }
      return;
    }
    if (!L) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      src.loop = true;
      const flt = this.ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.value = freq;
      flt.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(flt).connect(gain).connect(this.master);
      src.start();
      L = this.loops[name] = { src, flt, gain };
    }
    L.gain.gain.setTargetAtTime(level * maxGain, this.ctx.currentTime, 0.1);
  }

  stopAll() {
    for (const k of Object.keys(this.loops)) {
      try {
        this.loops[k].src.stop();
      } catch (e) {}
    }
    this.loops = {};
  }
}
