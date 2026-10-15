import type { Scene } from './ctx';
import { costChip, sceneHeader } from './ctx';
import {
  EV2_METHODS, EV2_INPUT, EV2_TIMING, EV2_VERIFY, EV2_COLLECT,
  type Ev2Method, type Ev2Input, type Ev2Timing, type Ev2Verify, type Ev2Collect,
} from '../data/options';
import { commitEv2Method, commitEv2Flow, commitEv2Collect, ev2FlowPreview, type FlowResult } from '../logic/game';
import { esc } from '../data/files';

const ui: { input: Ev2Input; timing: Ev2Timing; verify: Ev2Verify; collect: Ev2Collect | null; animate: boolean } = {
  input: 'old', timing: 'parallel', verify: 'ai', collect: null, animate: false,
};

export const ev2Scene: Scene = {
  enter: (ctx) => {
    void ctx;
    Object.assign(ui, { input: 'old', timing: 'parallel', verify: 'ai', collect: null, animate: false });
  },
  render: (root, ctx) => {
    const s = ctx.store.state;
    const d = s.decisions;
    const head = sceneHeader('사건 ② · 약 2분', '일단 만들었는데, 무엇을 위한 도구지?', '신입사원이 첫날 정보를 찾고 간단한 의견을 남길 수 있는 HTML 안내 도구를 준비합니다.');
    const conditions = `<div class="known"><b>알려진 조건</b><ul>
      <li>사내 접속에서만 열려야 함</li><li>올해 바뀐 출입 절차 반영</li><li>담당자가 문구를 직접 수정할 수 있어야 함</li>
      <li>여러 사람의 의견을 자동 취합하려면 <b>별도의 승인된 수집 경로</b>가 필요</li></ul></div>`;

    // 1단계: 일하는 방식
    if (!d.ev2_method) {
      root.innerHTML = `${head}${conditions}
      <h3 class="step-t">1. 일하는 방식 고르기</h3>
      <div class="cards3">${(Object.keys(EV2_METHODS) as Ev2Method[]).map((k) => {
        const m = EV2_METHODS[k];
        return `<article class="choice-card"><p class="tagline">${m.tag}</p><h4>${m.label}</h4><p>${m.note}</p>
          <p class="pro">＋ ${m.pros}</p><p class="con">－ ${m.cons}</p>${costChip(m.cost, s)}
          <button type="button" class="btn primary" data-m="${k}" data-testid="ev2-method-${k}">이 방식으로</button></article>`;
      }).join('')}</div>
      <p class="hint">어느 방식이든 뒤 단계에서 보완하면 성공할 수 있어요. PRD가 유일한 정답은 아닙니다.</p>`;
      root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => {
        const lines = ctx.act((st) => commitEv2Method(st, b.dataset.m as Ev2Method));
        ctx.sound.sfx('file');
        ctx.dlg.systemMessage('첫날_안내도구.html 시제품이 내 작업함에 생성됐습니다', 'file');
        ctx.dlg.play([...lines, 'ev2_flow_hint']);
      }));
      return;
    }

    const m = d.ev2_method as Ev2Method;
    const methodOut = m === 'prd'
      ? `<div class="prd mini"><div><h5>대상·목적</h5><p>신입사원 30명, 첫날 정보 찾기 + 의견</p></div><div><h5>필수 기능</h5><p>안내 / 의견 남기기 / 담당자 수정</p></div><div><h5>실행·저장 조건</h5><p>사내 접속 · 승인된 저장 경로</p></div><div><h5>완료 기준</h5><p>올해 출입 절차 · 요구사항 확인 · 승인</p></div></div>`
      : m === 'quick'
        ? `<div class="warn-box">시제품이 바로 떴습니다. 화면에 <b>“의견 제출 → 자동 취합 완료”</b> 버튼이 있지만, 실제 저장 경로는 정한 적이 없습니다.</div>`
        : `<div class="info-box">작년 승인 도구를 복사했습니다. 화면 구조는 재사용, <b>의견 남기기 기능 없음</b>·<b>출입 절차는 작년 기준</b>이라 확인이 필요합니다.</div>`;
    const methodBar = `<div class="method-bar"><span>선택한 방식: <b>${EV2_METHODS[m].tag}. ${EV2_METHODS[m].label}</b></span><button type="button" class="btn small" data-open="f_tool">🌐 시제품 보기</button>${m === 'prd' ? '<button type="button" class="btn small" data-open="f_prd">미니 PRD</button>' : m === 'quick' ? '<button type="button" class="btn small" data-open="f_req">요청 기록</button>' : '<button type="button" class="btn small" data-open="f_reuse">재사용 기록</button>'}</div>${methodOut}`;

    // 2단계: 오케스트레이션
    if (!d.ev2_input) {
      const preview = ev2FlowPreview(ui.input, ui.timing, ui.verify);
      const radio = <T extends string>(name: string, opts: Record<T, { label: string; cost: any; note: string }>, cur: T) =>
        (Object.keys(opts) as T[]).map((k) => `<label class="mini-radio ${cur === k ? 'on' : ''}"><input type="radio" name="${name}" value="${k}" ${cur === k ? 'checked' : ''} data-testid="ev2-${name}-${k}"/>
          <span><b>${opts[k].label}</b>${costChip(opts[k].cost)}<small>${opts[k].note}</small></span></label>`).join('');
      root.innerHTML = `${head}${methodBar}
      <h3 class="step-t">2. AI 흐름 구성 <small class="muted">기본 흐름에서 연결 2~3개만 바꿔보세요</small></h3>
      <div class="pipeline">
        <div class="stage"><div class="st-h"><b>① 자료 확보</b><small>무엇을 AI에 넣을까</small></div><div class="st-c">${radio('input', EV2_INPUT, ui.input)}</div></div>
        <div class="conn" aria-hidden="true">↓</div>
        <div class="stage ai"><div class="st-h"><b>② 변경사항 분석 AI</b><small>입력 자료끼리 비교해 바뀐 내용을 찾는다</small></div><div class="st-c"><p class="muted">고정 단계 · 입력에 없는 기준은 알 수 없음</p></div></div>
        <div class="conn link"><span aria-hidden="true">↓</span><div class="st-c">${radio('timing', EV2_TIMING, ui.timing)}</div></div>
        <div class="stage ai"><div class="st-h"><b>③ 작성/코딩 AI</b><small>HTML 안내 도구를 고친다</small></div><div class="st-c"><p class="muted">고정 단계 · 비용은 일하는 방식에 포함</p></div></div>
        <div class="conn" aria-hidden="true">↓</div>
        <div class="stage"><div class="st-h"><b>④ 검증</b><small>누가 무엇과 대조할까</small></div><div class="st-c">${radio('verify', EV2_VERIFY, ui.verify)}</div></div>
        <div class="conn" aria-hidden="true">↓</div>
        <div class="stage human"><div class="st-h"><b>⑤ 사람의 최종 승인 🔒</b><small>윤진 → 홍팀장</small></div><div class="st-c"><p>검증 AI도 틀릴 수 있어 <b>최종 확인 책임은 사람</b>에게 있습니다. 이 단계는 뺄 수 없습니다.</p></div></div>
      </div>
      <div class="confirm-bar"><span>흐름 비용 ${costChip(preview, s)} <small class="muted">+ 실행 중 발견되는 수정 비용</small></span>
        <button type="button" class="btn primary" data-testid="ev2-run">▶ 흐름 실행</button></div>`;
      root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => r.addEventListener('change', () => {
        (ui as any)[r.name] = r.value;
        ctx.sound.sfx('select');
        ctx.rerender();
      }));
      root.querySelector('[data-testid=ev2-run]')!.addEventListener('click', () => {
        const res = ctx.act((st) => {
          const r = commitEv2Flow(st, ui.input, ui.timing, ui.verify);
          st.lastLines.ev2nodes = r.nodes.map((n) => JSON.stringify(n));
          return r;
        });
        ui.animate = true;
        ctx.sound.sfx('confirm');
        ctx.dlg.systemMessage('검토기록이 생성됐습니다', 'file');
        ctx.rerender();
        ctx.dlg.play(res.lines);
      });
      bindOpen(root, ctx);
      return;
    }

    const nodes: FlowResult['nodes'] = (s.lastLines.ev2nodes || []).map((x) => JSON.parse(x));
    const flowResult = `<div class="flow ran ${ui.animate ? 'animate' : ''}">${nodes.map((n, i) => `${i ? '<div class="edge" aria-hidden="true"><span class="packet" style="--i:' + i + '"></span>→</div>' : ''}
      <div class="node res ${n.state}" style="--i:${i}"><h5>${esc(n.label)}</h5><p>${esc(n.text)}</p></div>`).join('')}</div>`;
    ui.animate = false;

    // 3단계: 응답 수집
    if (!d.ev2_collect) {
      root.innerHTML = `${head}${methodBar}<h3 class="step-t">2. 흐름 실행 결과</h3>${flowResult}
      <h3 class="step-t">3. 의견은 어디에 모이나요? <small class="muted">HTML을 공유함에 올리는 것과 응답을 서버/DB에 모으는 것은 다른 기능입니다</small></h3>
      <div class="cards3">${(Object.keys(EV2_COLLECT) as Ev2Collect[]).map((k) => `<article class="choice-card"><h4>${EV2_COLLECT[k].label}</h4><p>${EV2_COLLECT[k].note}</p>
        <p class="muted">표시될 상태: ${EV2_COLLECT[k].status}</p>${costChip(EV2_COLLECT[k].cost, s)}
        <button type="button" class="btn primary" data-c="${k}" data-testid="ev2-collect-${k}">선택</button></article>`).join('')}
        <article class="choice-card disabled" aria-disabled="true"><h4>외부 무료 설문·폼 서비스</h4><p>사내 정책상 사용 불가</p><p class="muted">게임에서도 선택할 수 없습니다.</p><button type="button" class="btn" disabled>사용 불가</button></article>
      </div>`;
      root.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((b) => b.addEventListener('click', () => {
        const lines = ctx.act((st) => commitEv2Collect(st, b.dataset.c as Ev2Collect));
        ctx.sound.sfx('file');
        if (b.dataset.c === 'request') ctx.dlg.systemMessage('사내API_DB_연계_지원요청.txt 생성 · 상태: 요청 중', 'file');
        ctx.dlg.play(lines);
      }));
      bindOpen(root, ctx);
      return;
    }

    const tool = s.files.find((f) => f.id === 'f_tool');
    const logs = s.log.filter((l) => l.decision.startsWith('ev2_') || l.decision.startsWith('cost:ev2'));
    root.innerHTML = `${head}${methodBar}${flowResult}
      <div class="result-card"><h3>사건 ② 산출물</h3>
        <ul class="result-list">${logs.map((l) => `<li>${esc(l.label)} ${costChip({ slack: l.slack, ai: l.ai })}</li>`).join('')}</ul>
        <p><b>HTML 시제품</b> · 검토: ${esc(tool?.review || '')}<br/><b>응답 저장 상태</b>: <span class="tag ${d.ev2_collect === 'survey' ? 'ok' : 'warn'}">${esc(tool?.status || '')}</span></p>
        <div class="row-btns"><button type="button" class="btn small" data-open="f_tool">🌐 시제품</button><button type="button" class="btn small" data-open="f_review">🗒 검토 기록</button>${d.ev2_collect === 'request' ? '<button type="button" class="btn small" data-open="f_api">🗒 지원 요청</button>' : ''}</div>
      </div>
      <div class="actions"><button type="button" class="btn primary big" data-testid="to-ev3">사건 ③으로 ▶</button></div>`;
    bindOpen(root, ctx);
    root.querySelector('[data-testid=to-ev3]')!.addEventListener('click', () => ctx.go('ev3'));
  },
};

function bindOpen(root: HTMLElement, ctx: Parameters<Scene['render']>[1]) {
  root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) => b.addEventListener('click', () => ctx.openFile(b.dataset.open!)));
}
