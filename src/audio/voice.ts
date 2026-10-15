import type { Line, SpeakerId } from '../types';
import { CHARACTERS, SPEAKER_ORDER } from '../data/characters';

export type VoiceMode = 'file' | 'tts' | 'subtitle';
export interface VoiceInfo { mode: VoiceMode; detail: string; error?: string }
export type VoiceStatus = 'unknown' | 'loading' | 'ready' | 'no-korean' | 'unsupported';

export interface Assignment {
  speaker: SpeakerId;
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
  /** 사람이 읽는 적용 상태 */
  note: string;
}

const FEMALE_HINT = /(female|woman|여성|yuna|sunhi|sun-hi|heami|seoyeon|seohyeon|soonbok|yujin|jimin|sora|nara|yuri|jiyoung|boa|mijin|google 한국의)/i;
const MALE_HINT = /(\bmale|\bman\b|남성|injoon|in-joon|hyunsu|minsu|bongjin|gookmin|jinho|junwoo|taeho)/i;
/** 사람 목소리에 가까운 신경망·고품질 음성 */
export const NATURAL_HINT = /(natural|neural|online|premium|enhanced|google)/i;

const LS_KEY = 'axgame.voice.v1';
const BASE = import.meta.env.BASE_URL;

/**
 * 재생 우선순위
 * 1) public/audio/<speaker>/<lineId>.mp3 가 manifest 에 있으면 파일 재생
 * 2) 없거나 실패하면 이 PC의 한국어 브라우저 TTS (기본: localService=true 음성만)
 * 3) 둘 다 안 되면 자막만 표시하고 진행
 */
export class VoiceManager {
  voiceOn = true;
  volume = 1;
  allowRemote = false;
  status: VoiceStatus = 'unknown';
  manifest = new Set<string>();
  manifestLoaded = false;
  overrides: Partial<Record<SpeakerId, string>> = {};
  allKo: SpeechSynthesisVoice[] = [];
  lastInfo: VoiceInfo = { mode: 'subtitle', detail: '대기' };
  private token = 0;
  private audio: HTMLAudioElement | null = null;
  private timers: number[] = [];
  private listeners: ((speaking: boolean, speaker: SpeakerId | null, info: VoiceInfo) => void)[] = [];
  private statusListeners: (() => void)[] = [];

  constructor() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        this.volume = typeof v.volume === 'number' ? v.volume : 1;
        this.allowRemote = !!v.allowRemote;
        this.overrides = v.overrides || {};
      }
    } catch { /* 저장소 차단 환경 */ }
  }

  persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ volume: this.volume, allowRemote: this.allowRemote, overrides: this.overrides })); } catch { /* noop */ }
  }

  onSpeaking(cb: (speaking: boolean, speaker: SpeakerId | null, info: VoiceInfo) => void) { this.listeners.push(cb); }
  onStatus(cb: () => void) { this.statusListeners.push(cb); }
  private emit(speaking: boolean, speaker: SpeakerId | null, info: VoiceInfo) { this.lastInfo = info; this.listeners.forEach((l) => l(speaking, speaker, info)); }
  private emitStatus() { this.statusListeners.forEach((l) => l()); }

  get ttsSupported() { return typeof window !== 'undefined' && !!(window as any).speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined'; }

  async init() {
    await Promise.all([this.loadManifest(), this.loadVoices()]);
  }

  async loadManifest() {
    try {
      const res = await fetch(`${BASE}audio/manifest.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        this.manifest = new Set<string>(data.files || []);
      }
    } catch { /* 파일 없음 → TTS로 */ }
    this.manifestLoaded = true;
  }

  /** 음성 목록이 늦게 로드되는 브라우저를 위해 voiceschanged + 폴링(최대 3초) */
  loadVoices(): Promise<void> {
    if (!this.ttsSupported) { this.status = 'unsupported'; this.emitStatus(); return Promise.resolve(); }
    this.status = 'loading';
    this.emitStatus();
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.refreshVoiceList();
        resolve();
      };
      const check = () => { if (synth.getVoices().length) finish(); };
      synth.addEventListener?.('voiceschanged', () => { if (done) { this.refreshVoiceList(); } else check(); });
      check();
      let n = 0;
      const iv = window.setInterval(() => { n++; check(); if (done || n > 12) { clearInterval(iv); finish(); } }, 250);
    });
  }

  refreshVoiceList() {
    if (!this.ttsSupported) return;
    const voices = window.speechSynthesis.getVoices();
    this.allKo = voices.filter((v) => /^ko(-|_|$)/i.test(v.lang));
    this.status = this.usableVoices().length ? 'ready' : 'no-korean';
    this.emitStatus();
  }

  /** 사내망 기본: 이 PC에서 처리되는 음성(localService)만. 원격 음성은 사용자가 직접 허용할 때만 */
  usableVoices(): SpeechSynthesisVoice[] {
    // 자연스러운(신경망) 음성을 앞에 둔다
    return this.allKo.filter((v) => this.allowRemote || v.localService)
      .sort((a, b) => Number(NATURAL_HINT.test(b.name)) - Number(NATURAL_HINT.test(a.name)));
  }

  hasNatural() { return this.usableVoices().some((v) => NATURAL_HINT.test(v.name)); }

  assignments(): Assignment[] {
    const usable = this.usableVoices();
    const female = usable.filter((v) => FEMALE_HINT.test(v.name));
    const male = usable.filter((v) => MALE_HINT.test(v.name));
    const counters = { female: 0, male: 0, any: 0 };
    return SPEAKER_ORDER.map((id) => {
      const c = CHARACTERS[id];
      const ov = this.overrides[id];
      let voice: SpeechSynthesisVoice | null = null;
      // 높낮이를 크게 바꾸면 기계음처럼 들려서 원래 음성 쪽으로 절반만 반영
      let pitch = 1 + (c.tts.pitch - 1) * 0.5;
      const rate = c.tts.rate;
      let note = '';
      if (ov === 'none') return { speaker: id, voice: null, pitch, rate, note: '사용자 설정: 자막만' };
      if (ov) voice = usable.find((v) => v.voiceURI === ov) || null;
      if (!voice && usable.length) {
        const pool = c.gender === 'female' ? female : male;
        if (pool.length) {
          voice = pool[counters[c.gender]++ % pool.length];
          note = `${c.gender === 'female' ? '여성' : '남성'} 추정 음성`;
        } else {
          voice = usable[counters.any++ % usable.length];
          note = '성별 정보 없는 음성 · 높낮이로만 구분';
          // 남성 캐릭터가 여성(또는 미상) 음성을 받으면 높낮이만 낮춘다. 성별·억양을 보장하지 않는다.
          if (c.gender === 'male' && !MALE_HINT.test(voice.name)) pitch = Math.min(pitch, 0.85);
        }
      }
      if (voice && ov) note = '사용자 지정';
      // 자연스러운 음성은 높낮이를 크게 바꾸면 기계음처럼 들리므로 거의 그대로 둔다
      if (voice && NATURAL_HINT.test(voice.name)) { pitch = 1 + (c.tts.pitch - 1) * 0.3; note += ' · 자연스러운 음성'; }
      if (!voice) note = '사용 가능한 한국어 음성 없음 → 자막';
      return { speaker: id, voice, pitch, rate, note };
    });
  }

  assignmentFor(id: SpeakerId): Assignment {
    return this.assignments().find((a) => a.speaker === id)!;
  }

  hasFile(line: Line) { return this.manifest.has(`${line.speakerId}/${line.id}.mp3`); }

  stop() {
    this.token++;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.audio) { this.audio.onended = this.audio.onerror = this.audio.onplay = null; this.audio.pause(); this.audio.src = ''; this.audio = null; }
    if (this.ttsSupported) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
    this.emit(false, null, this.lastInfo);
  }

  /** 한 번에 한 사람만 말한다. 이전 재생·대기열은 항상 취소된다. */
  async speak(line: Line): Promise<VoiceInfo> {
    this.stop();
    const t = this.token;
    if (!this.voiceOn) {
      const info: VoiceInfo = { mode: 'subtitle', detail: '음성 꺼짐 (자막)' };
      this.emit(false, line.speakerId, info);
      return info;
    }
    if (this.hasFile(line)) {
      const r = await this.playFile(line, t);
      if (r) return r;
      if (t !== this.token) return { mode: 'subtitle', detail: '중단됨' };
    }
    return this.speakTts(line, t);
  }

  private playFile(line: Line, t: number): Promise<VoiceInfo | null> {
    return new Promise((resolve) => {
      const a = new Audio(`${BASE}audio/${line.speakerId}/${line.id}.mp3`);
      a.volume = this.volume;
      this.audio = a;
      const info: VoiceInfo = { mode: 'file', detail: `음성 파일 · ${line.id}.mp3` };
      let started = false;
      a.onplay = () => { if (t !== this.token) return; started = true; this.emit(true, line.speakerId, info); };
      a.onended = () => { if (t !== this.token) return; this.emit(false, line.speakerId, info); resolve(info); };
      a.onerror = () => { if (t !== this.token) return resolve(null); this.audio = null; resolve(null); };
      a.play().catch(() => { if (!started) resolve(null); });
      // 응답 없는 파일
      this.timers.push(window.setTimeout(() => { if (!started && t === this.token) { a.pause(); resolve(null); } }, 4000));
    });
  }

  private speakTts(line: Line, t: number): Promise<VoiceInfo> {
    return new Promise((resolve) => {
      const fallback = (error: string): void => {
        const info: VoiceInfo = { mode: 'subtitle', detail: '자막', error };
        this.emit(false, line.speakerId, info);
        resolve(info);
      };
      if (!this.ttsSupported) return fallback('이 브라우저는 음성 합성을 지원하지 않습니다.');
      if (this.status === 'loading' || this.status === 'unknown') this.refreshVoiceList();
      const asg = this.assignmentFor(line.speakerId);
      if (!asg.voice) {
        return fallback(this.overrides[line.speakerId] === 'none' ? '' : '이 PC에서 사용할 수 있는 한국어 음성을 찾지 못했습니다.');
      }
      const u = new SpeechSynthesisUtterance(line.text);
      u.voice = asg.voice;
      u.lang = asg.voice.lang || 'ko-KR';
      u.pitch = asg.pitch;
      u.rate = asg.rate;
      u.volume = this.volume;
      const info: VoiceInfo = { mode: 'tts', detail: `브라우저 TTS · ${asg.voice.name}${asg.voice.localService ? '' : ' (원격)'}` };
      let started = false;
      let finished = false;
      const end = (err?: string) => {
        if (finished) return;
        finished = true;
        if (t !== this.token) return resolve({ mode: 'subtitle', detail: '중단됨' });
        if (err) return fallback(err);
        this.emit(false, line.speakerId, info);
        resolve(info);
      };
      u.onstart = () => { if (t !== this.token) return; started = true; this.emit(true, line.speakerId, info); };
      u.onend = () => end();
      u.onerror = (e) => end(e.error === 'interrupted' || e.error === 'canceled' ? undefined : `음성 재생 오류(${e.error}) — 자막으로 계속합니다.`);
      // cancel 직후 speak 가 무시되는 브라우저가 있어 짧게 띄운다
      this.timers.push(window.setTimeout(() => {
        if (t !== this.token) return;
        try { window.speechSynthesis.speak(u); } catch { end('음성 재생을 시작하지 못했습니다.'); }
      }, 60));
      // 지연·무응답 감시: 시작이 안 되거나 끝나지 않으면 자막으로 넘어간다
      this.timers.push(window.setTimeout(() => { if (!started && t === this.token) { try { window.speechSynthesis.cancel(); } catch { /* */ } end('음성이 응답하지 않아 자막으로 계속합니다.'); } }, 3500));
      this.timers.push(window.setTimeout(() => { if (t === this.token && !finished) { try { window.speechSynthesis.cancel(); } catch { /* */ } end(); } }, 4000 + line.text.length * 220));
    });
  }
}
