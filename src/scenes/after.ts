import type { Scene } from './ctx';
import { costChip, sceneHeader } from './ctx';
import { FOLLOWUP_BY_ID } from '../data/followups';
import { selectFollowups, resolveFollowup, followupDone, afterComplete } from '../logic/game';
import { esc } from '../data/files';

const played = new Set<string>();

export const afterScene: Scene = {
  enter: (ctx) => {
    played.clear();
    ctx.act((s) => selectFollowups(s));
    playCurrent(ctx);
  },
  render: (root, ctx) => {
    const s = ctx.store.state;
    const head = sceneHeader('누적 결과 · 약 2분', '앞선 선택이 돌아온다', '다음 교육 차수 담당자가 기존 산출물을 재사용하려고 합니다. 앞선 선택에 따라 일어난 일에 대응하세요.');
    const cards = s.followups.map((id) => {
      const f = FOLLOWUP_BY_ID[id];
      const isDone = followupDone(s, id);
      const chosen = f.kind === 'steps'
        ? f.options.filter((o) => s.decisions[`${id}:${o.id}`] !== undefined).map((o) => o.label)
        : f.options.filter((o) => s.decisions[id] === o.id).map((o) => o.label);
      return `<article class="fu ${f.positive ? 'pos' : 'neg'} ${isDone ? 'done' : ''}">
        <header><span class="fu-badge">${f.positive ? '좋은 선택이 돌아옴' : '수습 필요'}</span><h3>${esc(f.title)}</h3></header>
        <p class="cause">원인: ${esc(f.cause(s))}</p>
        ${f.kind === 'steps' ? '<p class="muted">세 단계를 모두 처리해야 끝납니다. 각 단계는 작업 여유 1칸.</p>' : ''}
        <div class="fu-opts">${f.options.map((o) => {
          const key = f.kind === 'steps' ? `${id}:${o.id}` : id;
          const taken = f.kind === 'steps' ? s.decisions[key] !== undefined : s.decisions[id] === o.id;
          const disabled = f.kind === 'steps' ? taken : isDone;
          return `<button type="button" class="opt ${taken ? 'taken' : ''}" data-fu="${id}" data-opt="${o.id}" data-testid="fu-${id}-${o.id}" ${disabled ? 'disabled' : ''}>
            <b>${taken ? '✓ ' : ''}${esc(o.label)}</b>${costChip(o.cost, s)}${o.note ? `<small>${esc(o.note)}</small>` : ''}</button>`;
        }).join('')}</div>
        ${isDone ? `<p class="fu-result">대응: ${chosen.map(esc).join(' → ')}</p>` : ''}
      </article>`;
    }).join('');
    const complete = afterComplete(s);
    root.innerHTML = `${head}<div class="fu-list">${cards}</div>
      <div class="actions"><button type="button" class="btn primary big" data-testid="to-report" ${complete ? '' : 'disabled'}>홍팀장에게 최종 승인 요청 ▶</button></div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-fu]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.fu!;
      const lines = ctx.act((st) => resolveFollowup(st, id, b.dataset.opt!));
      const f = FOLLOWUP_BY_ID[id];
      ctx.sound.sfx(f.positive ? 'good' : 'confirm');
      ctx.dlg.play(lines, () => playCurrent(ctx));
    }));
    root.querySelector('[data-testid=to-report]')!.addEventListener('click', () => ctx.go('report'));
  },
};

/** 아직 처리하지 않은 첫 후속 사건의 도입 대사를 한 번 재생 */
function playCurrent(ctx: Parameters<NonNullable<Scene['enter']>>[0]) {
  const s = ctx.store.state;
  const id = s.followups.find((x) => !followupDone(s, x));
  if (!id || played.has(id)) return;
  played.add(id);
  ctx.dlg.play(FOLLOWUP_BY_ID[id].intro);
}
