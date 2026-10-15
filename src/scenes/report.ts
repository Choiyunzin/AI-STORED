import type { Scene } from './ctx';
import { costChip, sceneHeader } from './ctx';
import { REPORT, REPORT_CORRECTION, type ReportChoice } from '../data/options';
import { commitReport, deliverables } from '../logic/game';
import { esc } from '../data/files';

const KIND_LABEL = { done: '완료', proto: '시제품', pending: '연계 대기', issue: '확인 필요', excluded: '범위 제외' } as const;

export const reportScene: Scene = {
  render: (root, ctx) => {
    const s = ctx.store.state;
    const dv = deliverables(s);
    const done = !!s.decisions.ev_report;
    root.innerHTML = `${sceneHeader('최종 승인', '무엇을 완료했고, 무엇이 아직인가', '홍팀장이 최종 승인 전에 산출물 상태를 확인합니다.')}
      <table class="tbl status-tbl"><thead><tr><th>산출물</th><th>실제 상태</th><th>구분</th></tr></thead><tbody>
      ${dv.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.status)}</td><td><span class="tag ${x.kind === 'done' ? 'ok' : x.kind === 'issue' ? 'danger' : 'warn'}">${KIND_LABEL[x.kind]}</span></td></tr>`).join('')}
      </tbody></table>
      ${done ? `<div class="result-card"><p>${s.decisions.ev_report === 'honest' ? '상태를 구분해 보고했습니다. 홍팀장이 시제품·연계 대기 항목의 다음 일정을 정했습니다.' : '“전부 완료”로 보고했다가, 시제품과 저장 상태를 질문받고 정정했습니다. 정정에 작업 여유 1칸이 들었습니다.'}</p></div>
        <div class="actions"><button type="button" class="btn primary big" data-testid="to-ending">회고 보기 ▶</button></div>`
      : `<div class="cards3 two">${(Object.keys(REPORT) as ReportChoice[]).map((k) => `<article class="choice-card"><h4>${REPORT[k].label}</h4><p>${REPORT[k].note}</p>${costChip(REPORT[k].cost)}
          ${k === 'over' ? `<small class="muted">홍팀장은 상태표를 직접 확인합니다. 사실과 다르면 정정 비용(${costChip(REPORT_CORRECTION)})이 생깁니다.</small>` : ''}
          <button type="button" class="btn ${k === 'honest' ? 'primary' : ''}" data-r="${k}" data-testid="report-${k}">이렇게 보고</button></article>`).join('')}</div>`}`;
    root.querySelectorAll<HTMLButtonElement>('[data-r]').forEach((b) => b.addEventListener('click', () => {
      const lines = ctx.act((st) => commitReport(st, b.dataset.r as ReportChoice));
      ctx.sound.sfx(b.dataset.r === 'honest' ? 'good' : 'warn');
      ctx.dlg.play(lines);
    }));
    root.querySelector('[data-testid=to-ending]')?.addEventListener('click', () => ctx.go('ending'));
  },
};
