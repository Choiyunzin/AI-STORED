import type { Scene } from './ctx';
import { costChip, sceneHeader, stepper } from './ctx';
import { EV1_MODES, EV1_TASKS, EV1_SCOPE, type Ev1Mode, type Ev1Scope } from '../data/options';
import { commitEv1, ev1Preview } from '../logic/game';
import { previewTaskA, previewTaskB } from '../data/files';
import { openModal } from '../ui/shell';

type Task = 'A' | 'B';
const ui: { A: Ev1Mode | null; B: Ev1Mode | null; scope: Ev1Scope } = { A: null, B: null, scope: 'related' };

export const ev1Scene: Scene = {
  enter: (ctx) => {
    void ctx;
    ui.A = null; ui.B = null; ui.scope = 'related';
  },
  render: (root, ctx) => {
    const s = ctx.store.state;
    const done = !!s.decisions.ev1_A;
    const head = sceneHeader('사건 ① · 약 2분', 'AI를 어디에 쓸까?', '두 업무가 동시에 도착했습니다. 업무마다 처리 방식을 배치하고, AI에게 넘길 자료를 고르세요.')
      + stepper(['업무 A 방식', '업무 B 방식', '넘길 자료', '결과'], done ? 3 : !ui.A ? 0 : !ui.B ? 1 : 2);

    if (done) {
      const a = s.decisions.ev1_A as Ev1Mode, b = s.decisions.ev1_B as Ev1Mode;
      const logs = s.log.filter((l) => l.decision.startsWith('ev1_'));
      root.innerHTML = `${head}
      <div class="result-card">
        <h3>배치 결과</h3>
        <ul class="result-list">${logs.map((l) => `<li><b>${l.label}</b> ${costChip({ slack: l.slack, ai: l.ai })}${l.note ? ` <small class="muted">${l.note}</small>` : ''}</li>`).join('')}</ul>
        <div class="outcomes">
          <div class="outcome ${a === 'full' ? 'bad' : a === 'human' ? 'good' : 'meh'}"><h4>업무 A · 안내문</h4><p>${a === 'human' ? '바뀐 세 줄만 정확히 수정됐습니다.' : a === 'draft' ? '결과는 정확하지만, 요청·확인 시간이 직접 수정과 비슷했고 이용권이 들었습니다.' : '검토가 끝난 문장까지 바뀌어 전체를 다시 검토했습니다. 의미가 바뀐 문장 1개를 되돌렸습니다.'}</p>
            <button type="button" class="btn small" data-open="f_notice">📝 수정 안내문 열기</button></div>
          <div class="outcome ${b === 'draft' ? 'good' : b === 'full' ? 'bad' : 'meh'}"><h4>업무 B · 300건 분석</h4><p>${b === 'draft' ? 'AI 분류 초안을 원문 표본으로 확인해, 반복 불편과 대표 근거가 정리됐습니다.' : b === 'human' ? '정확하게 분류했지만 작업 여유 6칸을 썼습니다. 뒤에 남은 업무가 빠듯해집니다.' : '빠르게 끝났지만 원문을 보지 않아 주차 불편이 "식사 불만"에 묶였습니다. 분석표에 "원문 미확인"이 남습니다.'}</p>
            <button type="button" class="btn small" data-open="f_analysis">📊 의견 분석표 열기</button></div>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn primary big" data-testid="to-ev2">사건 ②로 ▶</button></div>`;
      root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((bt) => bt.addEventListener('click', () => ctx.openFile(bt.dataset.open!)));
      root.querySelector('[data-testid=to-ev2]')!.addEventListener('click', () => ctx.go('ev2'));
      return;
    }

    const aiTasks = (ui.A && ui.A !== 'human' ? 1 : 0) + (ui.B && ui.B !== 'human' ? 1 : 0);
    const total = ev1Preview(ui.A, ui.B, ui.scope);
    const card = (t: Task) => {
      const task = EV1_TASKS[t];
      const cur = ui[t];
      return `<article class="task-card ${cur ? 'placed' : ''}" draggable="true" data-task="${t}" aria-label="${task.title}">
        <header><span class="task-ic" aria-hidden="true">${t === 'A' ? '📝' : '📊'}</span><b>${task.title}</b><button type="button" class="btn tiny ghost" data-preview="${t}">자료 보기</button></header>
        <p>${task.desc}</p>
        <div class="seg" role="group" aria-label="${task.title} 처리 방식">
          ${EV1_MODES.map((m) => `<button type="button" class="seg-b" data-assign="${t}:${m.id}" aria-pressed="${cur === m.id}" data-testid="ev1-${t}-${m.id}">
            <span class="seg-ic" aria-hidden="true">${{ human: '🧑‍💼', draft: '🤖+🧑', full: '🤖' }[m.id]}</span><span>${task.options[m.id].label}</span>${costChip(task.options[m.id].cost)}<small>${task.options[m.id].note}</small></button>`).join('')}
        </div></article>`;
    };
    const lane = (m: (typeof EV1_MODES)[number]) => {
      const here = (['A', 'B'] as Task[]).filter((t) => ui[t] === m.id);
      const ic = { human: '🧑‍💼', draft: '🤖✍️ ➜ 🧑‍💼', full: '🤖' }[m.id];
      return `<div class="lane lane-${m.id}" data-lane="${m.id}" aria-label="${m.label} 칸"><h4><span class="lane-ic">${ic}</span>${m.label}</h4>
        ${here.map((t) => `<div class="lane-chip">${t === 'A' ? '안내문 3줄' : '응답 300건'} ${costChip(EV1_TASKS[t].options[m.id].cost)}</div>`).join('') || '<p class="drop-hint">카드를 끌어 놓거나<br/>카드의 버튼을 누르세요</p>'}</div>`;
    };

    root.innerHTML = `${head}
      <div class="ev1-grid">
        <div class="tasks">${card('A')}${card('B')}</div>
        <div class="lanes">${EV1_MODES.map(lane).join('')}</div>
      </div>
      <fieldset class="scope ${aiTasks ? '' : 'disabled'}" ${aiTasks ? '' : 'disabled'}>
        <legend>AI에게 넘길 자료 ${aiTasks ? '' : '<small class="muted">(AI를 쓰는 업무가 없으면 필요 없음)</small>'}</legend>
        ${(Object.keys(EV1_SCOPE) as Ev1Scope[]).map((k) => `<label class="radio-card"><input type="radio" name="scope" value="${k}" ${ui.scope === k ? 'checked' : ''} data-testid="ev1-scope-${k}"/>
          <span><b>${EV1_SCOPE[k].label}</b> ${costChip({ slack: EV1_SCOPE[k].extra.slack, ai: EV1_SCOPE[k].perAiTask.ai * Math.max(1, aiTasks) })}<small>${EV1_SCOPE[k].note}${k === 'all' ? ' (AI 업무 1건당 이용권 6)' : ''}</small></span></label>`).join('')}
      </fieldset>
      <div class="confirm-bar">
        <span>예상 합계 ${costChip(total, s)}</span>
        <button type="button" class="btn primary" data-testid="ev1-confirm" ${ui.A && ui.B ? '' : 'disabled'}>배치 확정</button>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-assign]').forEach((b) => b.addEventListener('click', () => {
      const [t, m] = b.dataset.assign!.split(':') as [Task, Ev1Mode];
      ui[t] = m;
      ctx.sound.sfx('select');
      ctx.rerender();
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.preview as Task;
      openModal(EV1_TASKS[t].title, t === 'A' ? previewTaskA() : previewTaskB());
    }));
    root.querySelectorAll<HTMLInputElement>('input[name=scope]').forEach((r) => r.addEventListener('change', () => { ui.scope = r.value as Ev1Scope; ctx.rerender(); }));
    // 드래그 앤 드롭 (버튼으로도 같은 작업 가능)
    root.querySelectorAll<HTMLElement>('.task-card').forEach((c) => c.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', c.dataset.task!); }));
    root.querySelectorAll<HTMLElement>('.lane').forEach((l) => {
      l.addEventListener('dragover', (e) => { e.preventDefault(); l.classList.add('over'); });
      l.addEventListener('dragleave', () => l.classList.remove('over'));
      l.addEventListener('drop', (e) => {
        e.preventDefault();
        const t = e.dataTransfer?.getData('text/plain') as Task;
        if (t === 'A' || t === 'B') { ui[t] = l.dataset.lane as Ev1Mode; ctx.sound.sfx('select'); ctx.rerender(); }
      });
    });
    root.querySelector('[data-testid=ev1-confirm]')!.addEventListener('click', () => {
      if (!ui.A || !ui.B) return;
      const lines = ctx.act((st) => commitEv1(st, ui.A!, ui.B!, ui.scope));
      ctx.sound.sfx('file');
      ctx.dlg.systemMessage('산출물 2개가 내 작업함에 저장됐습니다: 수정 안내문, 의견 분석표', 'file');
      ctx.dlg.play(lines);
    });
  },
};
