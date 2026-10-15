import type { Scene } from './ctx';
import { costChip, sceneHeader } from './ctx';
import { buildRetro, DISCUSSION_QUESTIONS } from '../data/retro';
import { deliverables, usage } from '../logic/game';
import { EV3_SCOPE, INITIAL } from '../data/options';
import { esc } from '../data/files';
import type { GameState } from '../types';

export const endingScene: Scene = {
  render: (root, ctx) => {
    const s = ctx.store.state;
    const r = buildRetro(s);
    const u = usage(s);
    const dv = deliverables(s);
    root.innerHTML = `${sceneHeader('회고 · 약 1분 30초', '우리 팀의 일을 어떻게 연결했나', '점수나 순위가 아니라, 실제 선택 기록을 근거로 돌아봅니다.')}
      <div class="retro-grid">
        <section class="retro-card"><h3>✅ 잘 연결한 행동</h3><ol>${r.good.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></section>
        <section class="retro-card change"><h3>🔁 다음에 바꿔볼 행동</h3>${r.change.length ? `<ol>${r.change.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : '<p>이번 플레이에서는 뒤에 문제로 돌아온 선택이 없었습니다. 이 흐름을 팀 규칙으로 문서화해 보세요.</p>'}</section>
        <section class="retro-card"><h3>📦 사용한 자원</h3>
          <p>작업 여유 <b>${u.slack}칸</b> / ${INITIAL.slack}칸 사용 ${s.overtime ? `<span class="tag warn">초과 ${s.overtime}칸</span>` : ''} · 남은 여유 ${s.slack}칸</p>
          <p>AI 이용권 <b>${u.ai}점</b> / ${INITIAL.ai}점 사용 · 남은 이용권 ${s.ai}점 ${s.aiShortfall ? `<span class="tag warn">부족분 ${s.aiShortfall}점은 직접 처리</span>` : ''}</p></section>
        <section class="retro-card"><h3>📋 완료한 업무와 상태</h3><ul class="compact">${dv.map((x) => `<li><b>${esc(x.name)}</b> — ${esc(x.status)}</li>`).join('')}</ul></section>
      </div>
      <section class="retro-card"><h3>🗂 최종 파일함</h3>
        <table class="tbl"><thead><tr><th>파일</th><th>위치·범위</th><th>검토 상태</th><th>재사용</th></tr></thead><tbody>
        ${s.files.slice().sort((a, b) => a.createdAt - b.createdAt).map((f) => `<tr><td><button type="button" class="linkbtn" data-open="${f.id}">${esc(f.name)}</button></td><td>${f.location === 'shared' ? '공유함' : '내 작업함'}${f.scope ? ` · ${EV3_SCOPE[f.scope].label}` : ''}</td><td>${esc(f.review)}</td><td><span class="tag ${f.reusable ? 'ok' : 'warn'}">${f.reusable ? '가능' : '어려움'}</span> <small class="muted">${esc(f.reuseNote)}</small></td></tr>`).join('')}
        </tbody></table></section>
      <details class="retro-card"><summary><b>🧾 선택 기록 전체 (${s.log.length}건)</b></summary>
        <ol class="log">${s.log.map((l) => `<li>${esc(l.label)} ${costChip({ slack: l.slack, ai: l.ai })}${l.note ? ` <small class="muted">${esc(l.note)}</small>` : ''}</li>`).join('')}</ol></details>
      <section class="retro-card discuss"><h3>💬 팀 토의 질문</h3><ol>${DISCUSSION_QUESTIONS.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></section>
      <div class="actions">
        <button type="button" class="btn" data-dl="txt" data-testid="dl-txt">회고 텍스트 내려받기</button>
        <button type="button" class="btn" data-dl="json" data-testid="dl-json">선택 기록 JSON 내려받기</button>
        <button type="button" class="btn primary" data-testid="restart">처음부터 다시</button>
      </div>
      <p class="muted center">내려받기는 이 브라우저에서 파일을 만들 뿐, 어디로도 전송되지 않습니다.</p>`;
    root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.openFile(b.dataset.open!)));
    root.querySelectorAll<HTMLButtonElement>('[data-dl]').forEach((b) => b.addEventListener('click', () => download(s, b.dataset.dl as 'txt' | 'json')));
    root.querySelector('[data-testid=restart]')!.addEventListener('click', () => document.dispatchEvent(new CustomEvent('game:restart')));
  },
};

export function retroText(s: GameState): string {
  const r = buildRetro(s);
  const u = usage(s);
  return [
    '입사 D-7, 우리 팀의 AX 작전 — 회고',
    '',
    '[잘 연결한 행동]', ...r.good.map((t, i) => `${i + 1}. ${t}`),
    '', '[다음에 바꿔볼 행동]', ...(r.change.length ? r.change.map((t, i) => `${i + 1}. ${t}`) : ['- 없음']),
    '', `[사용한 자원] 작업 여유 ${u.slack}/${INITIAL.slack}칸 (초과 ${s.overtime}), AI 이용권 ${u.ai}/${INITIAL.ai}점`,
    '', '[산출물 상태]', ...deliverables(s).map((x) => `- ${x.name}: ${x.status}`),
    '', '[선택 기록]', ...s.log.map((l, i) => `${i + 1}. ${l.label} (여유 ${l.slack}, 이용권 ${l.ai})${l.note ? ` - ${l.note}` : ''}`),
    '', '[팀 토의 질문]', ...DISCUSSION_QUESTIONS.map((q, i) => `${i + 1}. ${q}`),
  ].join('\n');
}

function download(s: GameState, kind: 'txt' | 'json') {
  const data = kind === 'txt' ? retroText(s) : JSON.stringify({ retro: buildRetro(s), usage: usage(s), deliverables: deliverables(s), decisions: s.decisions, log: s.log, files: s.files }, null, 2);
  const blob = new Blob([data], { type: kind === 'txt' ? 'text/plain;charset=utf-8' : 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = kind === 'txt' ? 'ax-game-retro.txt' : 'ax-game-record.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
