import type { Line, SpeakerId } from '../types';
import lines from '../data/dialogue.json';
import { CHARACTERS } from '../data/characters';
import { avatarSvg, avatarEl } from './avatar';
import type { VoiceManager, VoiceInfo } from '../audio/voice';
import type { SoundManager } from '../audio/sound';
import { esc } from '../data/files';

export const LINES: Record<string, Line> = Object.fromEntries((lines as Line[]).map((l) => [l.id, l]));

/** 대사 진행: 자막은 즉시 표시, 음성은 한 번에 한 사람, 다음/장면 전환/음소거 시 이전 재생 취소 */
export class DialogueController {
  private queue: Line[] = [];
  private idx = -1;
  private onDone: (() => void) | null = null;
  autoAdvance = false;
  private autoTimer: number | null = null;
  private els: Record<string, HTMLElement>;
  openSettings: () => void = () => {};
  onSpeakerChange: (id: SpeakerId | null, expr?: string) => void = () => {};

  constructor(private box: HTMLElement, private messenger: HTMLElement, private voice: VoiceManager, private sound: SoundManager) {
    box.innerHTML = `
      <div class="dlg-portrait" aria-hidden="true"></div>
      <div class="dlg-body">
        <div class="dlg-head"><b class="dlg-name">팀 메신저</b><span class="dlg-rank"></span><span class="dlg-count"></span><span class="dlg-mode" title="현재 재생 방식"></span></div>
        <p class="dlg-text" aria-live="polite">대화가 여기에 표시됩니다.</p>
        <div class="dlg-notice" role="status" hidden></div>
      </div>
      <div class="dlg-ctrl">
        <div class="dlg-row"><button type="button" class="btn ghost" data-k="prev" title="놓친 대사 다시 보기 (←)" data-testid="dlg-prev">◀ 이전</button>
        <button type="button" class="btn ghost" data-k="replay" title="다시 듣기 (R)">↻ 다시 듣기</button></div>
        <button type="button" class="btn primary" data-k="next" title="다음 대사 (Enter / Space)">다음 ▶</button>
        <button type="button" class="btn ghost" data-k="skip" title="이 대화 건너뛰기 (S)">⏭ 건너뛰기</button>
      </div>`;
    const q = (s: string) => box.querySelector(s) as HTMLElement;
    this.els = {
      portrait: q('.dlg-portrait'), name: q('.dlg-name'), rank: q('.dlg-rank'), count: q('.dlg-count'), mode: q('.dlg-mode'),
      text: q('.dlg-text'), notice: q('.dlg-notice'), replay: q('[data-k=replay]'), prev: q('[data-k=prev]'), next: q('[data-k=next]'), skip: q('[data-k=skip]'),
    };
    this.els.replay.addEventListener('click', () => this.replay());
    this.els.next.addEventListener('click', () => this.next());
    this.els.prev.addEventListener('click', () => this.prev());
    this.els.skip.addEventListener('click', () => this.skip());
    voice.onSpeaking((speaking, speaker, info) => {
      this.els.portrait.classList.toggle('talking', speaking);
      document.querySelectorAll('.roster-item').forEach((el) => el.classList.toggle('talking', speaking && (el as HTMLElement).dataset.id === speaker));
      sound.duck(speaking);
      this.showMode(info);
    });
    this.idle();
  }

  get active() { return this.idx >= 0 && this.idx < this.queue.length; }

  /** 이 장면에서 지금까지 나온 대사 (◀ 이전으로 다시 보기) */
  private history: Line[] = [];
  /** 다시 보기 중이면 history 위치, 아니면 null */
  private review: number | null = null;

  private updatePrev() {
    const cur = this.review ?? (this.active ? this.history.length - 1 : this.history.length);
    (this.els.prev as HTMLButtonElement).disabled = cur <= 0;
  }

  /** 놓친 대사를 한 줄씩 거슬러 올라가며 다시 본다 (진행 중인 대화는 그대로 유지) */
  prev() {
    this.clearAuto();
    const cur = this.review ?? (this.active ? this.history.length - 1 : this.history.length);
    if (cur <= 0) return;
    this.review = cur - 1;
    this.sound.sfx('select');
    this.display(this.history[this.review], `다시 보기 ${this.review + 1} / ${this.history.length}`);
  }

  /** 대사를 화면에만 다시 띄운다 (메신저 기록에는 다시 쌓지 않음) */
  private display(l: Line, count: string) {
    const c = CHARACTERS[l.speakerId];
    this.box.classList.remove('done');
    this.box.classList.toggle('reviewing', this.review !== null);
    this.els.portrait.innerHTML = `<span class="avatar big" style="--s:96px">${avatarSvg(l.speakerId, l.expression)}</span>`;
    this.els.name.textContent = c.name;
    this.els.rank.textContent = `${c.rank} · ${c.strengths[0]}`;
    this.els.count.textContent = count;
    this.els.text.textContent = l.text;
    this.els.next.textContent = '다음 ▶';
    (this.els.next as HTMLButtonElement).disabled = false;
    (this.els.replay as HTMLButtonElement).disabled = false;
    this.updatePrev();
    this.speak(l);
  }

  play(ids: string[], onDone?: () => void) {
    this.clearAuto();
    const ls = ids.map((id) => LINES[id]).filter(Boolean);
    if (ids.length !== ls.length) console.warn('[dialogue] 없는 대사 ID', ids.filter((id) => !LINES[id]));
    this.queue = ls;
    this.idx = -1;
    this.onDone = onDone || null;
    if (!ls.length) { this.finish(); return; }
    this.box.classList.remove('done');
    this.sound.sfx('ping');
    this.show(0);
  }

  private show(i: number) {
    this.idx = i;
    const l = this.queue[i];
    const c = CHARACTERS[l.speakerId];
    this.els.portrait.innerHTML = `<span class="avatar big" style="--s:96px">${avatarSvg(l.speakerId, l.expression)}</span>`;
    this.els.name.textContent = c.name;
    this.els.rank.textContent = `${c.rank} · ${c.strengths[0]}`;
    this.els.count.textContent = `${i + 1} / ${this.queue.length}`;
    this.els.text.textContent = l.text;
    this.review = null;
    this.box.classList.remove('reviewing');
    this.history.push(l);
    this.els.next.textContent = i === this.queue.length - 1 ? '대화 마치기 ✓' : '다음 ▶';
    (this.els.next as HTMLButtonElement).disabled = false;
    (this.els.replay as HTMLButtonElement).disabled = false;
    (this.els.skip as HTMLButtonElement).disabled = this.queue.length < 2;
    this.box.dataset.speaker = l.speakerId;
    this.updatePrev();
    this.onSpeakerChange(l.speakerId, l.expression);
    this.appendMessenger(l);
    document.dispatchEvent(new CustomEvent('dlg:line', { detail: l }));
    this.speak(l);
  }

  private async speak(l: Line) {
    this.els.notice.hidden = true;
    const info = await this.voice.speak(l);
    if (this.queue[this.idx] !== l) return;
    this.showMode(info);
    if (info.error) this.showNotice(info.error);
    if (this.autoAdvance && this.active && this.review === null) {
      this.autoTimer = window.setTimeout(() => { if (this.queue[this.idx] === l) this.next(); }, info.mode === 'subtitle' ? 2600 + l.text.length * 60 : 700);
    }
  }

  private showMode(info: VoiceInfo) {
    const label = info.mode === 'file' ? '🔊 음성 파일' : info.mode === 'tts' ? '🔊 브라우저 TTS' : '💬 자막';
    this.els.mode.textContent = label;
    this.els.mode.title = info.detail;
  }

  private showNotice(msg: string) {
    this.els.notice.hidden = false;
    this.els.notice.innerHTML = `<span>${esc(msg)}</span> <button type="button" class="btn tiny" data-n="retry">재시도</button> <button type="button" class="btn tiny" data-n="settings">음성 설정</button>`;
    this.els.notice.querySelector('[data-n=retry]')!.addEventListener('click', async () => { await this.voice.loadVoices(); this.replay(); });
    this.els.notice.querySelector('[data-n=settings]')!.addEventListener('click', () => this.openSettings());
  }

  private appendMessenger(l: Line) {
    const c = CHARACTERS[l.speakerId];
    const div = document.createElement('div');
    div.className = `msg ${l.speakerId === 'yunjin' ? 'me' : ''}`;
    div.innerHTML = `${avatarEl(l.speakerId, l.expression, 28)}<div><b>${c.name}</b><p>${esc(l.text)}</p></div>`;
    this.messenger.appendChild(div);
    while (this.messenger.children.length > 60) this.messenger.firstChild!.remove();
    this.messenger.scrollTop = this.messenger.scrollHeight;
  }

  systemMessage(text: string, kind: 'file' | 'warn' | 'info' = 'info') {
    const div = document.createElement('div');
    div.className = `msg sys ${kind}`;
    div.innerHTML = `<p>${kind === 'file' ? '📄 ' : kind === 'warn' ? '⚠ ' : 'ℹ '}${esc(text)}</p>`;
    this.messenger.appendChild(div);
    this.messenger.scrollTop = this.messenger.scrollHeight;
  }

  next() {
    this.clearAuto();
    if (this.review !== null) {
      // 다시 보기 중: 한 줄씩 앞으로, 따라잡으면 원래 대화 위치로 돌아간다
      this.sound.sfx('select');
      const live = this.active ? this.history.length - 1 : this.history.length;
      this.review++;
      if (this.review < live) { this.display(this.history[this.review], `다시 보기 ${this.review + 1} / ${this.history.length}`); return; }
      this.review = null;
      this.box.classList.remove('reviewing');
      if (this.active) { this.display(this.queue[this.idx], `${this.idx + 1} / ${this.queue.length}`); this.els.next.textContent = this.idx === this.queue.length - 1 ? '대화 마치기 ✓' : '다음 ▶'; }
      else this.showEnded();
      return;
    }
    if (!this.active) return;
    this.sound.sfx('select');
    if (this.idx < this.queue.length - 1) this.show(this.idx + 1);
    else this.finish();
  }

  skip() {
    this.clearAuto();
    if (!this.active) return;
    // 남은 대사는 메신저 기록에만 남기고 넘어간다
    for (let i = this.idx + 1; i < this.queue.length; i++) this.appendMessenger(this.queue[i]);
    this.finish();
  }

  replay() {
    this.clearAuto();
    if (this.active) this.speak(this.queue[this.idx]);
    else if (this.queue.length) { this.idx = this.queue.length - 1; this.speak(this.queue[this.idx]); }
  }

  /** 장면 전환·음소거: 재생과 대기열 취소 */
  stopAll() {
    this.clearAuto();
    this.voice.stop();
    this.queue = [];
    this.idx = -1;
    this.onDone = null;
    this.history = [];
    this.review = null;
    this.idle();
  }

  /** 대화가 끝난 상태 표시 (다시 보기에서 돌아왔을 때) */
  private showEnded() {
    this.voice.stop();
    this.box.classList.add('done');
    this.els.next.textContent = '대화 끝';
    (this.els.next as HTMLButtonElement).disabled = true;
    this.els.count.textContent = '';
    this.updatePrev();
  }

  private finish() {
    this.voice.stop();
    this.idx = this.queue.length;
    this.box.classList.add('done');
    this.els.next.textContent = '대화 끝';
    (this.els.next as HTMLButtonElement).disabled = true;
    (this.els.skip as HTMLButtonElement).disabled = true;
    this.els.count.textContent = '';
    this.review = null;
    this.box.classList.remove('reviewing');
    this.updatePrev();
    this.onSpeakerChange(null);
    document.dispatchEvent(new CustomEvent('dlg:line', { detail: null }));
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  private idle() {
    this.els.portrait.innerHTML = '<span class="dlg-idle">💬</span>';
    this.els.name.textContent = '팀 메신저';
    this.els.rank.textContent = '';
    this.els.count.textContent = '';
    this.els.text.textContent = '화면의 업무를 진행하세요. 지난 대화는 왼쪽 메신저에 남아 있어요.';
    (this.els.next as HTMLButtonElement).disabled = true;
    (this.els.skip as HTMLButtonElement).disabled = true;
    (this.els.replay as HTMLButtonElement).disabled = true;
    (this.els.prev as HTMLButtonElement).disabled = true;
    this.box.classList.add('done');
  }

  private clearAuto() { if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = null; } }
}
