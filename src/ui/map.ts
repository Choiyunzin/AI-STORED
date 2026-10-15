import type { Line, SpeakerId } from '../types';
import type { MapDef, MapNpc, Furn } from '../data/maps';
import { WORLD } from '../data/maps';
import { CHARACTERS } from '../data/characters';
import { avatarSvg } from './avatar';
import type { DialogueController } from './dialogue';
import type { SoundManager } from '../audio/sound';
import { esc } from '../data/files';

const SPEED = 200; // px/s
const TALK_R = 72; // 이 거리 안으로 들어오면 대화
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

function sprite(id: SpeakerId, extra = '') {
  const c = CHARACTERS[id];
  return `<div class="sprite ${extra}" data-id="${id}">
    <div class="sp-bubble" hidden></div>
    <div class="sp-mark" aria-hidden="true"></div>
    <div class="sp-head"><span class="avatar" style="--s:40px">${avatarSvg(id, 'smile')}</span></div>
    <div class="sp-body" style="background:${c.look.shirt}"><i class="leg l"></i><i class="leg r"></i></div>
    <div class="sp-shadow"></div>
    <div class="sp-name">${id === 'yunjin' ? '나 (윤진)' : c.name}</div>
  </div>`;
}

/**
 * 방향키로 윤진을 움직이는 탐색 화면.
 * - 사람 가까이 가면 그 사람의 대사가 음성+자막으로 재생 (한 번에 한 사람)
 * - 필수 대화를 모두 들은 뒤 목표 지점(내 자리 PC 등)에 가면 업무 화면으로 전환
 * - 바닥 클릭 이동, 화면 방향 패드, '바로 가기' 버튼으로도 진행 가능
 */
export class OfficeMap {
  x: number;
  y: number;
  talked = new Set<SpeakerId>();
  private held = new Set<'up' | 'down' | 'left' | 'right'>();
  private target: { x: number; y: number } | null = null;
  private raf = 0;
  private last = 0;
  private stuck = 0;
  private done = false;
  private afterPlayed = false;
  private goalWarnAt = 0;
  private nearId: SpeakerId | null = null;
  private talkingWith: MapNpc | null = null;
  private prevAuto = false;
  private world!: HTMLElement;
  private player!: HTMLElement;
  private wrap!: HTMLElement;
  private ro: ResizeObserver | null = null;
  private scale = 1;
  private onKeyDown = (e: KeyboardEvent) => this.key(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.key(e, false);
  private onLine = (e: Event) => this.bubble((e as CustomEvent<Line | null>).detail);

  constructor(private root: HTMLElement, private def: MapDef, private dlg: DialogueController, private sound: SoundManager, private onFinish: (skipped: boolean) => void) {
    this.x = def.start.x;
    this.y = def.start.y;
    // 걸어 다니는 동안에는 대사가 끝나면 자동으로 다음 대사로
    this.prevAuto = dlg.autoAdvance;
    dlg.autoAdvance = true;
    this.build();
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    document.addEventListener('dlg:line', this.onLine);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  private get required() { return this.def.npcs.filter((n) => n.required); }
  private get allTalked() { return this.required.every((n) => this.talked.has(n.id)); }
  /** 지금 이야기해야 할 사람 (순서대로) */
  private get nextReq(): MapNpc | null { return this.required.find((n) => !this.talked.has(n.id)) || null; }

  private build() {
    const d = this.def;
    const furn = (f: Furn) => `<div class="furn ${f.kind}" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px"><span>${esc(f.label || '')}</span></div>`;
    this.root.innerHTML = `
      <div class="map-hud">
        <div class="hud-card">
          <div class="hud-main"><p class="hud-time">${esc(d.time)}</p>
          <p class="hud-hint">${esc(d.hint)}</p>
          <ol class="hud-steps">${this.required.map((n, i) => `<li data-req="${n.id}"><span class="no">${i + 1}</span>${CHARACTERS[n.id].name}에게 가서 이야기 듣기</li>`).join('')}<li data-req="goal"><span class="no">${this.required.length + 1}</span>${esc(d.goal.label)}(으)로 가기</li></ol></div>
          <div class="hud-side"><p class="hud-keys">⬆⬇⬅➡ / WASD 이동 · 가까이 가면 대화 · Space 다시 듣기 · 바닥 클릭 이동</p>
          <button type="button" class="btn small" data-testid="map-skip">대화 듣고 바로 ${esc(d.goal.label.replace(/^\S+\s/, ''))}(으)로 ▶</button></div>
        </div>
      </div>
      <div class="map-stage">
      <div class="map-wrap" tabindex="0" aria-label="${esc(d.room)} 탐색 화면. 방향키나 WASD로 이동하세요.">
        <div class="map-world floor-${d.floor}" style="width:${WORLD.w}px;height:${WORLD.h}px">
          <div class="wall"><span class="room-tag">📍 ${esc(d.room)}</span></div>
          ${d.furniture.map(furn).join('')}
          <div class="goal locked" style="left:${d.goal.x}px;top:${d.goal.y}px;width:${d.goal.w}px;height:${d.goal.h}px"><span>${esc(d.goal.label)}</span></div>
          ${d.npcs.map((n) => sprite(n.id, `npc ${n.required ? 'req' : 'amb'}`)).join('')}
          <div class="target-ring" aria-hidden="true"></div>
          ${sprite('yunjin', 'player')}
          <div class="guide-arrow" aria-hidden="true">➜</div>
          <div class="talk-prompt" hidden>Space · 다시 듣기</div>
        </div>
      </div>
      <div class="dpad" aria-label="이동 패드">
        <button type="button" data-dir="up" aria-label="위로">▲</button><button type="button" data-dir="left" aria-label="왼쪽으로">◀</button>
        <button type="button" data-dir="down" aria-label="아래로">▼</button><button type="button" data-dir="right" aria-label="오른쪽으로">▶</button>
      </div></div>`;
    this.wrap = this.root.querySelector('.map-wrap')!;
    this.world = this.root.querySelector('.map-world')!;
    this.player = this.world.querySelector('.sprite.player')!;
    for (const n of this.def.npcs) {
      const el = this.world.querySelector<HTMLElement>(`.sprite.npc[data-id=${n.id}]`)!;
      el.style.transform = `translate(${n.x - 22}px, ${n.y - 64}px)`;
      el.style.zIndex = String(Math.round(n.y));
    }
    this.place();
    this.fit();
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.root.querySelector('.map-stage')!);
    this.world.addEventListener('pointerdown', (e) => this.click(e));
    this.root.querySelectorAll<HTMLButtonElement>('.dpad [data-dir]').forEach((b) => {
      const dir = b.dataset.dir as 'up';
      const on = (ev: Event) => { ev.preventDefault(); this.target = null; this.held.add(dir); };
      const off = () => this.held.delete(dir);
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
    });
    this.root.querySelector('[data-testid=map-skip]')!.addEventListener('click', () => this.skip());
    this.wrap.focus({ preventScroll: true });
    this.updateHud();
  }

  private fit() {
    const r = this.root.querySelector('.map-stage')!.getBoundingClientRect();
    const k = Math.min((r.width - 8) / WORLD.w, (r.height - 8) / WORLD.h);
    this.scale = Math.max(0.3, k);
    this.world.style.transform = `scale(${this.scale})`;
    this.wrap.style.width = `${WORLD.w * this.scale}px`;
    this.wrap.style.height = `${WORLD.h * this.scale}px`;
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (this.done || document.getElementById('modal-root')?.innerHTML) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      this.target = null;
      if (down) this.held.add(dir); else this.held.delete(dir);
      return;
    }
    if (down && (e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') {
      e.preventDefault();
      e.stopPropagation();
      const n = this.nearest();
      if (n && !this.dlg.active) this.talk(n, true);
      else this.dlg.next();
    }
  }

  private click(e: PointerEvent) {
    const r = this.world.getBoundingClientRect();
    let x = (e.clientX - r.left) / this.scale;
    let y = (e.clientY - r.top) / this.scale;
    const sp = (e.target as HTMLElement).closest<HTMLElement>('.sprite.npc');
    if (sp) {
      const n = this.def.npcs.find((m) => m.id === sp.dataset.id)!;
      x = n.x; y = n.y + 34;
    }
    this.target = { x, y };
    this.wrap.focus({ preventScroll: true });
  }

  private collides(x: number, y: number) {
    if (x < 18 || x > WORLD.w - 18 || y < WORLD.top + 8 || y > WORLD.h - 6) return true;
    const box = { l: x - 12, r: x + 12, t: y - 8, b: y };
    const hit = (l: number, t: number, w: number, h: number) => box.r > l && box.l < l + w && box.b > t && box.t < t + h;
    for (const f of this.def.furniture) if (f.solid !== false && hit(f.x, f.y, f.w, f.h)) return true;
    for (const n of this.def.npcs) if (hit(n.x - 14, n.y - 10, 28, 10)) return true;
    return false;
  }

  private tick(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!this.done) {
      let vx = 0, vy = 0;
      if (this.held.has('left')) vx -= 1;
      if (this.held.has('right')) vx += 1;
      if (this.held.has('up')) vy -= 1;
      if (this.held.has('down')) vy += 1;
      if (!vx && !vy && this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) this.target = null; else { vx = dx / dist; vy = dy / dist; }
      }
      const len = Math.hypot(vx, vy);
      let moved = false;
      if (len) {
        const step = SPEED * dt / len;
        const nx = this.x + vx * step, ny = this.y + vy * step;
        if (!this.collides(nx, this.y)) { this.x = nx; moved = true; }
        if (!this.collides(this.x, ny)) { this.y = ny; moved = true; }
        if (vx) this.player.classList.toggle('face-left', vx < 0);
        if (!moved && this.target && ++this.stuck > 15) { this.target = null; this.stuck = 0; }
        if (moved) this.stuck = 0;
      }
      this.player.classList.toggle('walking', moved);
      this.place();
      this.proximity();
      this.checkGoal();
      this.guide();
    }
    this.raf = requestAnimationFrame((tt) => this.tick(tt));
  }

  private place() {
    this.player.style.transform = `translate(${this.x - 22}px, ${this.y - 64}px)`;
    this.player.style.zIndex = String(Math.round(this.y));
  }

  private nearest(): MapNpc | null {
    let best: MapNpc | null = null, bd = TALK_R;
    for (const n of this.def.npcs) {
      const d = Math.hypot(n.x - this.x, n.y - this.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  private proximity() {
    const n = this.nearest();
    const id = n?.id ?? null;
    if (id !== this.nearId) {
      this.nearId = id;
      this.world.querySelectorAll('.sprite.npc').forEach((el) => el.classList.toggle('near', (el as HTMLElement).dataset.id === id));
      const p = this.world.querySelector<HTMLElement>('.talk-prompt')!;
      p.hidden = !n || !this.talked.has(n.id);
      if (n) { p.style.left = `${n.x}px`; p.style.top = `${n.y + 8}px`; }
    }
    // 가까이 가면 자동으로 말을 건다 (다른 대화가 진행 중이면 끝날 때까지 기다림)
    // 앞 사람에게서 멀어졌으면 새 사람이 말을 시작한다 (한 번에 한 사람만 말함)
    const walkedAway = this.talkingWith && Math.hypot(this.talkingWith.x - this.x, this.talkingWith.y - this.y) > TALK_R * 1.6;
    if (n && !this.talked.has(n.id)) {
      const outOfTurn = n.required && n !== this.nextReq;
      if (outOfTurn) this.hintOutOfTurn(n);
      else if (!n.required ? !this.dlg.active : (!this.dlg.active || walkedAway)) this.talk(n, false);
    }
  }

  private talk(n: MapNpc, replay: boolean) {
    if (!replay) this.talked.add(n.id);
    this.world.querySelector(`.sprite.npc[data-id=${n.id}]`)?.classList.add('talked');
    this.updateHud();
    this.talkingWith = n;
    this.dlg.play(n.lines, () => { this.talkingWith = null; this.afterTalk(); });
  }

  private hintAt = 0;
  private hintOutOfTurn(n: MapNpc) {
    const now = performance.now();
    if (now - this.hintAt < 3000) return;
    this.hintAt = now;
    const next = this.nextReq!;
    const b = this.world.querySelector<HTMLElement>(`.sprite[data-id=${n.id}] .sp-bubble`);
    if (b && !this.dlg.active) {
      b.textContent = `${CHARACTERS[next.id].name}랑 먼저 얘기해 보세요!`;
      b.hidden = false;
      window.setTimeout(() => { if (b.textContent?.includes('먼저')) b.hidden = true; }, 2200);
    }
  }

  /** 다음 목표(사람 또는 자리)로 향하는 화살표와 바닥 링 */
  private guide() {
    const nr = this.nextReq;
    const g = this.def.goal;
    const tx = nr ? nr.x : g.x + g.w / 2;
    const ty = nr ? nr.y : g.y + g.h / 2;
    const ring = this.world.querySelector<HTMLElement>('.target-ring')!;
    ring.style.transform = `translate(${tx - 30}px, ${ty - 16}px)`;
    ring.classList.toggle('goal-ring', !nr);
    const arrow = this.world.querySelector<HTMLElement>('.guide-arrow')!;
    const dist = Math.hypot(tx - this.x, ty - this.y);
    const ang = Math.atan2(ty - this.y, tx - this.x);
    arrow.hidden = dist < 90 || this.done;
    arrow.style.transform = `translate(${this.x + Math.cos(ang) * 46 - 14}px, ${this.y - 30 + Math.sin(ang) * 46 - 14}px) rotate(${ang}rad)`;
    this.world.querySelectorAll<HTMLElement>('.sprite.npc.req').forEach((el) => el.classList.toggle('next', el.dataset.id === nr?.id));
    this.root.querySelectorAll<HTMLElement>('.hud-steps li').forEach((li) => li.classList.toggle('cur', li.dataset.req === (nr ? nr.id : 'goal')));
  }

  private afterTalk() {
    const p = this.world.querySelector<HTMLElement>('.talk-prompt');
    if (p && this.nearId) p.hidden = false;
    if (this.allTalked && !this.afterPlayed && this.def.afterAll?.length && !this.dlg.active) {
      this.afterPlayed = true;
      this.dlg.play(this.def.afterAll);
    }
  }

  private checkGoal() {
    const g = this.def.goal;
    const inside = this.x > g.x && this.x < g.x + g.w && this.y > g.y && this.y < g.y + g.h + 10;
    if (!inside) return;
    if (this.allTalked) { this.finish(false); return; }
    const now = performance.now();
    if (now - this.goalWarnAt > 2500) {
      this.goalWarnAt = now;
      const left = this.required.filter((n) => !this.talked.has(n.id)).map((n) => CHARACTERS[n.id].name).join(', ');
      this.dlg.systemMessage(`먼저 이야기를 들어보세요: ${left}`, 'info');
      this.sound.sfx('warn');
    }
  }

  private updateHud() {
    for (const n of this.required) {
      const li = this.root.querySelector(`[data-req=${n.id}]`);
      if (li) li.classList.toggle('ok', this.talked.has(n.id));
    }
    this.world.querySelector('.goal')!.classList.toggle('locked', !this.allTalked);
  }

  private bubble(line: Line | null) {
    this.world.querySelectorAll<HTMLElement>('.sp-bubble').forEach((b) => { b.hidden = true; });
    this.world.querySelectorAll('.sprite.has-bubble').forEach((s) => s.classList.remove('has-bubble'));
    if (!line) return;
    const sp = this.world.querySelector<HTMLElement>(`.sprite[data-id=${line.speakerId}]`);
    const el = sp?.querySelector<HTMLElement>('.sp-bubble');
    if (sp && el) { el.textContent = line.text; el.hidden = false; sp.classList.add('has-bubble'); }
  }

  /** 버튼으로 진행: 남은 필수 대사를 이어서 재생하며 바로 업무 화면으로 */
  skip() {
    const rest = this.required.filter((n) => !this.talked.has(n.id)).flatMap((n) => n.lines);
    const after = this.afterPlayed ? [] : this.def.afterAll || [];
    this.required.forEach((n) => this.talked.add(n.id));
    this.finish(true, [...rest, ...after]);
  }

  private finish(skipped: boolean, pending: string[] = []) {
    if (this.done) return;
    this.done = true;
    this.held.clear();
    this.root.querySelector(`[data-req=goal]`)?.classList.add('ok');
    // 남은 대사가 있으면(바로 가기) 업무 화면에서 이어서 재생
    if (!skipped && this.allTalked && !this.afterPlayed && this.def.afterAll?.length) pending = this.def.afterAll;
    this.sound.sfx('confirm');
    const g = this.def.goal;
    this.world.style.transformOrigin = `${g.x + g.w / 2}px ${g.y}px`;
    this.world.classList.add('zoom-in');
    window.setTimeout(() => {
      this.onFinish(skipped);
      if (pending.length) this.dlg.play(pending);
    }, 520);
  }

  destroy() {
    this.dlg.autoAdvance = this.prevAuto;
    cancelAnimationFrame(this.raf);
    this.done = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    document.removeEventListener('dlg:line', this.onLine);
    this.ro?.disconnect();
  }

  /** 테스트·디버그용 */
  get debug() { return { x: this.x, y: this.y, talked: [...this.talked], done: this.done }; }
}
