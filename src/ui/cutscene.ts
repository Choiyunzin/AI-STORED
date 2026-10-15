import { CUTSCENE, type CutVisual, type CutSlide } from '../data/cutscene';
import { SPEAKER_ORDER, CHARACTERS } from '../data/characters';
import { avatarSvg } from './avatar';
import type { SoundManager } from '../audio/sound';

const CPS = 32; // 초당 글자 수

function visual(v: CutVisual, html = ''): string {
  switch (v) {
    case 'html':
      return html;
    case 'about':
      return `<div class="cv-about">
        <div class="ab" style="--d:0"><div class="ab-stage walk"><span class="ab-hong"><span class="avatar" style="--s:44px">${avatarSvg('hong', 'smile')}</span><i class="ab-mark">!</i></span><span class="ab-me"><span class="avatar" style="--s:44px">${avatarSvg('yunjin', 'bright')}</span></span><span class="ab-arrow">➜</span></div><b>① 걸어가서</b></div>
        <div class="ab" style="--d:1"><div class="ab-stage talk"><span class="avatar" style="--s:44px">${avatarSvg('hong', 'focused')}</span><span class="ab-bubble">신입 30명이<br/>들어와요!</span><span class="avatar" style="--s:44px">${avatarSvg('yunjin', 'smile')}</span></div><b>② 이야기 듣고</b></div>
        <div class="ab" style="--d:2"><div class="ab-stage pc"><div class="ab-mon"><i class="c1">🧑‍💼</i><i class="c2">🤖+🧑</i><i class="c3">🤖</i><span class="ab-cursor">👆</span></div></div><b>③ PC에서 고르고</b></div>
        <div class="ab" style="--d:3"><div class="ab-stage res"><p class="r1">✅ 잘한 점</p><p class="r2">✅ 잘한 점</p><p class="r3">🔁 바꿔볼 점</p></div><b>④ 결과 돌아보기</b></div>
      </div>`;
    case 'calendar':
      return `<div class="cv-cal"><div class="cal-top">10월</div><div class="cal-days">${['월', '화', '수', '목', '금', '토', '일'].map((d) => `<b>${d}</b>`).join('')}${Array.from({ length: 14 }, (_, i) => `<span class="${i === 0 ? 'today' : i === 7 ? 'dday' : ''}" style="--d:${i}">${i + 13}</span>`).join('')}</div><div class="cal-badge">D-7</div></div>`;
    case 'yunjin':
      return `<div class="cv-hero"><span class="avatar talking-loop" style="--s:150px">${avatarSvg('yunjin', 'bright')}</span><div class="hero-tag">윤진 매니저 <small>(나) · 교육팀 새내기 · AI 활용 담당</small></div><div class="sparkles">✨ 🤖 💡</div></div>`;
    case 'team':
      return `<div class="cv-team">${SPEAKER_ORDER.map((id, i) => `<div class="tm" style="--d:${i}"><span class="avatar" style="--s:74px">${avatarSvg(id, 'smile')}</span><b>${CHARACTERS[id].name}</b><small>${CHARACTERS[id].strengths[0]}</small></div>`).join('')}</div>`;
    case 'slack':
      return `<div class="cv-meter"><div class="meter-l">⏱ 작업 여유</div><div class="cells">${Array.from({ length: 18 }, (_, i) => `<i style="--d:${i}"></i>`).join('')}</div><div class="meter-demo"><span class="chip slack">업무 처리 ⏱ -2칸</span></div></div>`;
    case 'ai':
      return `<div class="cv-meter ai"><div class="meter-l">✦ AI 이용권</div><div class="aibar"><i></i></div><div class="meter-cmp"><div><span>📝</span><b>안내문 3줄</b><small>사람이 직접 ⏱1</small></div><div class="vs">vs</div><div><span>📊</span><b>응답 300건</b><small>AI 초안 + 확인 ✦16</small></div></div></div>`;
    case 'how':
      return `<div class="cv-how"><div class="how-step" style="--d:0"><span>⬆⬇⬅➡</span><b>걸어 다니기</b></div><div class="arrow">→</div><div class="how-step" style="--d:1"><span>💬</span><b>가까이 가서 대화</b></div><div class="arrow">→</div><div class="how-step" style="--d:2"><span>🖥</span><b>자리에서 선택</b></div><div class="arrow">→</div><div class="how-step" style="--d:3"><span>🔁</span><b>결과가 돌아옴</b></div></div>`;
    case 'goal':
      return `<div class="cv-goal"><div class="g" style="--d:0">📝<small>① 정의하고</small></div><div class="g" style="--d:1">🤖 + 🧑<small>② 나누고</small></div><div class="g" style="--d:2">🔍<small>③ 확인하고</small></div><div class="g" style="--d:3">📦<small>④ 남기기</small></div></div>`;
  }
}

/** 타자기 효과 컷신. 클릭/Enter: 지금 문장 즉시 완성 → 다음, Esc/건너뛰기: 종료 */
export function playCutscene(sound: SoundManager, onDone: () => void, startAt = 0, slides: CutSlide[] = CUTSCENE, finalLabel = '업무 시작 ▶') {
  const CUTSCENE = slides;
  const el = document.createElement('div');
  el.id = 'cutscene';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', slides.length > 1 ? '게임 소개' : '사건 소개');
  document.body.appendChild(el);
  let slide = startAt;
  let line = 0;
  let shown = 0;
  let timer = 0;
  let typing = false;
  let finished = false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const render = (instant = false) => {
    const s = CUTSCENE[slide];
    el.innerHTML = `<div class="cut-card">
      ${CUTSCENE.length > 1 ? `<div class="cut-progress">${CUTSCENE.map((_, i) => `<i class="${i < slide ? 'done' : i === slide ? 'cur' : ''}"></i>`).join('')}</div>` : ''}
      <div class="cut-visual ${s.visual === 'html' ? 'brief' : ''}">${visual(s.visual, s.html)}</div>
      <p class="cut-kicker">${s.kicker}</p>
      <div class="cut-text" aria-live="polite">${s.lines.map((_, i) => `<p data-l="${i}"></p>`).join('')}</div>
      <div class="cut-ctrl"><button type="button" class="btn ghost" data-k="skip" data-testid="cut-skip">건너뛰기 ⏭</button>
        <span class="cut-hint">클릭 · Enter로 넘기기 · ← 이전</span>
        <button type="button" class="btn" data-k="prev" data-testid="cut-prev" ${slide === 0 ? 'disabled' : ''}>◀ 이전</button>
        <button type="button" class="btn primary" data-k="next" data-testid="cut-next">다음 ▶</button></div></div>`;
    el.querySelector('[data-k=skip]')!.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    el.querySelector('[data-k=next]')!.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
    el.querySelector('[data-k=prev]')!.addEventListener('click', (e) => { e.stopPropagation(); back(); });
    (el.querySelector('[data-k=next]') as HTMLElement).focus();
    line = 0;
    if (instant) {
      // 이전 장으로 돌아왔을 때는 다시 타이핑하지 않고 바로 보여준다
      s.lines.forEach((t, i) => { const q = el.querySelector<HTMLElement>(`[data-l="${i}"]`); if (q) q.textContent = t; });
      line = s.lines.length - 1;
      typing = false;
      const btn = el.querySelector<HTMLElement>('[data-k=next]')!;
      btn.textContent = slide === CUTSCENE.length - 1 ? finalLabel : '다음 ▶';
      btn.classList.add('ready');
      return;
    }
    typeLine();
  };
  const back = () => {
    if (finished || slide === 0) return;
    typing = false;
    clearTimeout(timer);
    slide--;
    sound.sfx('select');
    render(true);
  };

  const p = () => el.querySelector<HTMLElement>(`[data-l="${line}"]`)!;
  const typeLine = () => {
    const text = CUTSCENE[slide].lines[line];
    shown = 0;
    typing = true;
    p().classList.add('typing');
    if (reduce) { shown = text.length; endLine(); return; }
    const step = () => {
      if (!typing) return;
      shown++;
      p().textContent = text.slice(0, shown);
      const ch = text[shown - 1];
      if (ch && ch !== ' ') sound.typeTick();
      if (shown >= text.length) { endLine(); return; }
      timer = window.setTimeout(step, 1000 / CPS + (/[,.?!]/.test(ch) ? 140 : Math.random() * 18));
    };
    step();
  };
  const endLine = () => {
    typing = false;
    clearTimeout(timer);
    p().textContent = CUTSCENE[slide].lines[line];
    p().classList.remove('typing');
    if (line < CUTSCENE[slide].lines.length - 1) {
      timer = window.setTimeout(() => { line++; typeLine(); }, 380);
    } else {
      sound.sfx('ping');
      const btn = el.querySelector<HTMLElement>('[data-k=next]')!;
      btn.textContent = slide === CUTSCENE.length - 1 ? finalLabel : '다음 ▶';
      btn.classList.add('ready');
    }
  };
  /** 타이핑 중이면 이 장의 모든 문장을 즉시 완성, 다 나왔으면 다음 장 */
  const advance = () => {
    if (finished) return;
    const lines = CUTSCENE[slide].lines;
    const allDone = !typing && line === lines.length - 1;
    if (!allDone) {
      typing = false;
      clearTimeout(timer);
      lines.forEach((t, i) => { const q = el.querySelector<HTMLElement>(`[data-l="${i}"]`); if (q) { q.textContent = t; q.classList.remove('typing'); } });
      line = lines.length - 1;
      endLine();
      return;
    }
    if (slide < CUTSCENE.length - 1) { slide++; sound.sfx('select'); render(); } else finish();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); advance(); }
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); back(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    typing = false;
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('out');
    window.setTimeout(() => { el.remove(); onDone(); }, 350);
  };
  el.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) advance(); });
  window.addEventListener('keydown', onKey, true);
  render();
}
