/**
 * BGM·효과음. 외부 파일 없이 Web Audio 로 합성한다(사내망 오프라인 실행).
 * AudioContext 는 반드시 사용자 클릭 안에서 init() 으로 만든다.
 */
export type Sfx = 'ping' | 'file' | 'select' | 'confirm' | 'warn' | 'good';

const LS_KEY = 'axgame.sound.v1';

export class SoundManager {
  ctx: AudioContext | null = null;
  bgmOn = true;
  sfxOn = true;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private loopTimer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private ducked = false;

  constructor() {
    try {
      const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (typeof v.bgmOn === 'boolean') this.bgmOn = v.bgmOn;
      if (typeof v.sfxOn === 'boolean') this.sfxOn = v.sfxOn;
    } catch { /* noop */ }
  }

  persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ bgmOn: this.bgmOn, sfxOn: this.sfxOn })); } catch { /* noop */ }
  }

  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0;
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.35;
      this.sfxGain.connect(this.ctx.destination);
      this.applyBgm();
    } catch { this.ctx = null; }
  }

  setBgm(on: boolean) { this.bgmOn = on; this.persist(); this.applyBgm(); }
  setSfx(on: boolean) { this.sfxOn = on; this.persist(); }

  /** 대사 중에는 BGM을 줄인다 */
  duck(on: boolean) {
    this.ducked = on;
    this.applyLevel();
  }

  private applyLevel() {
    if (!this.ctx || !this.bgmGain) return;
    const target = !this.bgmOn ? 0 : this.ducked ? 0.02 : 0.075;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  private applyBgm() {
    if (!this.ctx) return;
    this.applyLevel();
    if (this.bgmOn && this.loopTimer === null) {
      this.nextBar = this.ctx.currentTime + 0.1;
      this.loopTimer = window.setInterval(() => this.schedule(), 200);
    } else if (!this.bgmOn && this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  // 경쾌한 오피스 팝 루프 (118BPM): C - G - Am - F, 킥·스네어·하이햇 + 베이스 + 통통 튀는 멜로디
  private schedule() {
    const ctx = this.ctx!;
    const beat = 60 / 118;
    const bar = beat * 4;
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
    const melody = [
      [72, 0, 76, 79, 0, 76, 74, 72], [71, 0, 74, 79, 0, 74, 71, 67],
      [72, 0, 76, 81, 79, 76, 74, 72], [69, 72, 74, 72, 0, 69, 67, 0],
    ];
    const out = this.bgmGain!;
    while (this.nextBar < ctx.currentTime + 0.8) {
      const i = this.bar % 4;
      const t0 = this.nextBar;
      const ch = chords[i];
      for (let k = 0; k < 8; k++) {
        const t = t0 + k * beat / 2;
        // 코드 스탭 (엇박)
        if (k % 2 === 1) ch.forEach((n) => this.tone(n, t, beat * 0.35, 'square', 0.035, out));
        // 베이스 (옥타브 바운스)
        this.tone(ch[0] - 24 + (k % 2 ? 12 : 0), t, beat * 0.4, 'triangle', 0.22, out);
        // 하이햇
        this.noise(t, 0.04, 0.05, 7000);
        // 멜로디 (짝수 마디는 쉬어 가며 리듬감)
        const m = melody[i][k];
        if (m && (this.bar % 8 < 4 || k % 2 === 0)) this.tone(m, t, beat * 0.45, 'triangle', 0.13, out);
      }
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * beat;
        if (k % 2 === 0) this.kick(t); else this.noise(t, 0.12, 0.18, 1800);
      }
      this.bar++;
      this.nextBar += bar;
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.bgmGain!);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** 타자기 '타닥' 소리: 짧은 잡음 + 낮은 '톡' */
  typeTick() {
    if (!this.ctx || !this.sfxOn || !this.sfxGain) return;
    const t = this.ctx.currentTime + 0.005;
    this.noise(t, 0.022 + Math.random() * 0.012, 0.55, 2200 + Math.random() * 2200, this.sfxGain);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(190 + Math.random() * 60, t);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.04);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise(t: number, dur: number, vol: number, hp: number, out?: AudioNode) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out || this.bgmGain!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(midi: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  sfx(kind: Sfx) {
    if (!this.ctx || !this.sfxOn || !this.sfxGain) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.sfxGain;
    switch (kind) {
      case 'ping': this.tone(84, t, 0.18, 'sine', 0.5, out); this.tone(91, t + 0.09, 0.22, 'sine', 0.4, out); break;
      case 'file': this.tone(72, t, 0.12, 'triangle', 0.5, out); this.tone(76, t + 0.07, 0.12, 'triangle', 0.5, out); this.tone(79, t + 0.14, 0.2, 'triangle', 0.5, out); break;
      case 'select': this.tone(76, t, 0.06, 'square', 0.12, out); break;
      case 'confirm': this.tone(67, t, 0.1, 'triangle', 0.5, out); this.tone(72, t + 0.08, 0.18, 'triangle', 0.5, out); break;
      case 'warn': this.tone(62, t, 0.18, 'sawtooth', 0.18, out); this.tone(58, t + 0.16, 0.25, 'sawtooth', 0.18, out); break;
      case 'good': this.tone(72, t, 0.1, 'sine', 0.5, out); this.tone(79, t + 0.08, 0.1, 'sine', 0.5, out); this.tone(84, t + 0.16, 0.25, 'sine', 0.5, out); break;
    }
  }
}
