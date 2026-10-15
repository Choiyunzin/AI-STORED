import type { GameState } from '../types';
import { newState } from '../logic/game';

const KEY = 'axgame.save.v1';

/** 하나의 상태 모델. UI·회고는 모두 이 상태에서 그린다. */
export class Store {
  state: GameState;
  private subs: (() => void)[] = [];

  constructor() {
    this.state = newState();
  }

  static loadSaved(): GameState | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as GameState;
      if (s.version !== 1 || !s.scene) return null;
      return s;
    } catch {
      return null;
    }
  }

  static clearSaved() {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }

  subscribe(fn: () => void) { this.subs.push(fn); }

  /** 상태 변경 → 저장 → 구독자(상단바·파일함·장면) 갱신 */
  update<T>(fn: (s: GameState) => T): T {
    const r = fn(this.state);
    this.save();
    this.subs.forEach((s) => s());
    return r;
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* 저장 불가 환경에서도 진행 */ }
  }

  reset(audioMode: 'voice' | 'subtitle') {
    Store.clearSaved();
    this.state = newState(audioMode);
    this.save();
    this.subs.forEach((s) => s());
  }
}
