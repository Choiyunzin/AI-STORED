import type { Scene, Ctx } from './ctx';
import { costChip, sceneHeader, stepper, icon } from './ctx';
import { EV3_LEVEL, EV3_STORAGE, EV3_SCOPE, EV3_PII, EV3_KEY, type Ev3Level, type Ev3Storage, type Ev3Pii, type Ev3Key } from '../data/options';
import {
  EV3_VERSIONS, markOpened, commitEv3Version, commitEv3Level, commitEv3Share, commitEv3Pii, commitEv3Key,
  needsKeyDecision, ev3Complete, applyEv3ToFiles,
} from '../logic/game';
import { CHARACTERS } from '../data/characters';
import { versionPreview, rosterPreview, promptMemoPreview } from '../data/files';
import { openModal } from '../ui/shell';
import type { ShareScope } from '../types';

const ui: { storage: Ev3Storage | null; scope: ShareScope; piiAnnounced: boolean; keyAnnounced: boolean } = { storage: null, scope: 'team', piiAnnounced: false, keyAnnounced: false };

export const ev3Scene: Scene = {
  enter: (ctx) => {
    Object.assign(ui, { storage: null, scope: 'team', piiAnnounced: !!ctx.store.state.decisions.ev3_pii, keyAnnounced: !!ctx.store.state.decisions.ev3_key });
  },
  render: (root, ctx) => {
    const s = ctx.store.state;
    const d = s.decisions;
    const head = sceneHeader('사건 ③ · 약 2분', '파일은 많은데, 쓸 수가 없다', '결과물이 각자의 작업함에 흩어졌습니다. 기준본을 고르고, 무엇을 어디까지 남길지 정하세요.')
      + stepper(['최신본', '남길 것', '저장 위치', '운영 명단', ...(needsKeyDecision(s) ? ['키 문자열'] : []), '공유 실행'],
        !d.ev3_version ? 0 : !d.ev3_level ? 1 : !d.ev3_storage ? 2 : !d.ev3_pii ? 3 : needsKeyDecision(s) ? (!d.ev3_key ? 4 : 5) : 4);
    const done = (k: string) => d[k] !== undefined;
    const stepCls = (k: string, enabled: boolean) => `step ${done(k) ? 'done' : enabled ? 'active' : 'locked'}`;

    // 1. 기준본
    const opened = (id: string) => s.opened.includes(id);
    const s1 = `<section class="${stepCls('ev3_version', true)}"><h3 class="step-t">1. 최신본 고르기 <small class="muted">이름만으로 정하지 말고 열어서 검토 상태·작성 시각·변경 내용을 확인하세요 (열기는 비용 없음)</small></h3>
      <div class="filegrid">${EV3_VERSIONS.map((v) => `<div class="vfile ${d.ev3_version === v.id ? 'chosen' : ''}">
        <span class="ficon">📝</span><div><b>${v.name}</b><small>${CHARACTERS[v.owner].name}의 작업함${opened(v.id) ? ` · ${v.time} · ${v.review}` : ''}</small></div>
        <button type="button" class="btn small ghost" data-ver-open="${v.id}" data-testid="ev3-open-${v.id}">${opened(v.id) ? '다시 보기' : '열기'}</button>
        ${done('ev3_version') ? (d.ev3_version === v.id ? '<span class="tag ok">기준본</span>' : '') : `<button type="button" class="btn small" data-ver="${v.id}" data-testid="ev3-pick-${v.id}">기준본으로</button>`}</div>`).join('')}</div></section>`;

    // 2. 정리 수준
    const s2 = `<section class="${stepCls('ev3_level', done('ev3_version'))}"><h3 class="step-t">2. 무엇을 남길까 <small class="muted">정리를 많이 하면 지금 비용이 들지만 다음 업무의 재사용·수정 비용이 줄어듭니다</small></h3>
      <div class="cards3">${(Object.keys(EV3_LEVEL) as Ev3Level[]).map((k) => `<article class="choice-card ${d.ev3_level === k ? 'chosen' : ''}">${icon({ '1': '📄', '2': '📘', '3': '🧰' }[k])}<p class="tagline">${k}</p><h4>${EV3_LEVEL[k].label}</h4><p>${EV3_LEVEL[k].note}</p>${costChip(EV3_LEVEL[k].cost, s)}
        ${done('ev3_level') ? (d.ev3_level === k ? '<span class="tag ok">선택함</span>' : '') : `<button type="button" class="btn primary" data-level="${k}" data-testid="ev3-level-${k}" ${done('ev3_version') ? '' : 'disabled'}>선택</button>`}</article>`).join('')}</div></section>`;

    // 3. 저장 위치·열람 범위
    const canS3 = done('ev3_level');
    const st = ui.storage;
    const s3 = `<section class="${stepCls('ev3_storage', canS3)}"><h3 class="step-t">3. 어디에, 누구까지</h3>
      ${done('ev3_storage') ? `<p>저장 위치: <b>${EV3_STORAGE[d.ev3_storage as Ev3Storage].label}</b>${d.ev3_storage === 'shared' ? ` · 열람 범위 <b>${EV3_SCOPE[d.ev3_scope as ShareScope].label}</b>` : ''}</p>` : `
      <div class="row-wrap">${(Object.keys(EV3_STORAGE) as Ev3Storage[]).map((k) => `<label class="radio-card"><input type="radio" name="storage" value="${k}" ${st === k ? 'checked' : ''} ${canS3 ? '' : 'disabled'} data-testid="ev3-storage-${k}"/><span><b>${EV3_STORAGE[k].label}</b><small>${EV3_STORAGE[k].note}</small></span></label>`).join('')}</div>
      ${st === 'shared' ? `<div class="row-wrap"><span class="lbl">열람 범위</span>${(Object.keys(EV3_SCOPE) as ShareScope[]).map((k) => `<label class="mini-radio ${ui.scope === k ? 'on' : ''}"><input type="radio" name="scope" value="${k}" ${ui.scope === k ? 'checked' : ''} data-testid="ev3-scope-${k}"/><span><b>${EV3_SCOPE[k].label}</b><small>${EV3_SCOPE[k].note}</small></span></label>`).join('')}</div>` : ''}
      <button type="button" class="btn primary" data-testid="ev3-share" ${canS3 && st ? '' : 'disabled'}>저장 위치 확정</button>`}</section>`;

    // 4. 보안: 운영 명단
    const canS4 = done('ev3_storage');
    const s4 = `<section class="${stepCls('ev3_pii', canS4)}"><h3 class="step-t">4. 함께 올릴 운영 명단 <small class="muted">미리보기와 정보 등급을 먼저 확인할 수 있어요</small></h3>
      <div class="vfile"><span class="ficon">📊</span><div><b>운영명단_원본.xlsx</b><small>총무팀에서 받은 파일 · <span class="tag danger">정보 등급: 대외비 · 개인정보 포함</span></small></div><button type="button" class="btn small ghost" data-roster data-testid="ev3-roster">미리보기</button></div>
      <div class="cards3">${(Object.keys(EV3_PII) as Ev3Pii[]).map((k) => `<article class="choice-card ${d.ev3_pii === k ? 'chosen' : ''}">${icon({ team: '👥', clean: '✂️', company: '🌐' }[k])}<h4>${EV3_PII[k].label}</h4><p>${EV3_PII[k].note}</p>${costChip(EV3_PII[k].cost, s)}
        ${done('ev3_pii') ? (d.ev3_pii === k ? '<span class="tag ok">선택함</span>' : '') : `<button type="button" class="btn primary" data-pii="${k}" data-testid="ev3-pii-${k}" ${canS4 ? '' : 'disabled'}>선택</button>`}</article>`).join('')}</div></section>`;

    // 5. 키 문자열 (정리 수준 3일 때만)
    const needKey = needsKeyDecision(s);
    const canS5 = done('ev3_pii');
    const s5 = needKey ? `<section class="${stepCls('ev3_key', canS5)}"><h3 class="step-t">5. 재사용 프롬프트 메모 확인</h3>
      ${promptMemoPreview(d.ev3_key === 'remove')}
      <div class="row-wrap">${(Object.keys(EV3_KEY) as Ev3Key[]).map((k) => done('ev3_key') ? (d.ev3_key === k ? `<span class="tag ${k === 'remove' ? 'ok' : 'warn'}">${EV3_KEY[k].label}</span>` : '') : `<button type="button" class="btn ${k === 'remove' ? 'primary' : ''}" data-key="${k}" data-testid="ev3-key-${k}" ${canS5 ? '' : 'disabled'}>${EV3_KEY[k].label} ${costChip(EV3_KEY[k].cost)}</button>`).join('')}</div>
      <p class="muted">게임 속 가상 문자열입니다. 실제 자격증명은 쓰이지 않습니다.</p></section>` : '';

    const complete = ev3Complete(s);
    const applied = !!s.flags.ev3_applied;
    const s6 = complete ? `<section class="step ${applied ? 'done' : 'active'}">
      ${applied ? `<h3 class="step-t">정리 완료</h3><p>${d.ev3_storage === 'shared' ? '사내 승인 공유함으로 이동했습니다. 오른쪽 <b>팀 공유함</b> 탭에서 배지(검토 상태·열람 범위·재사용 가능 여부)를 확인하세요.' : '내 작업함에 정리했습니다. 다른 팀원은 이 자료를 찾을 수 없습니다.'}</p>
        <div class="actions"><button type="button" class="btn primary big" data-testid="to-after">새 교육 차수로 ▶</button></div>`
        : `<div class="actions"><button type="button" class="btn primary big" data-testid="ev3-apply">📤 정리·공유 실행</button></div>`}</section>` : '';

    root.innerHTML = `${head}${s1}${s2}${s3}${s4}${s5}${s6}`;

    // 이벤트
    root.querySelectorAll<HTMLButtonElement>('[data-ver-open]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.verOpen!;
      ctx.act((st2) => markOpened(st2, id));
      const v = EV3_VERSIONS.find((x) => x.id === id)!;
      openModal(`📝 ${v.name}`, versionPreview(id), done('ev3_version') ? [] : [{ label: '이 파일을 기준본으로', cls: 'primary', testid: `ev3-modal-pick-${id}`, onClick: () => pickVersion(ctx, id) }]);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => pickVersion(ctx, b.dataset.ver!)));
    root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => b.addEventListener('click', () => {
      ctx.dlg.play(ctx.act((st2) => commitEv3Level(st2, b.dataset.level as Ev3Level)));
      ctx.sound.sfx('confirm');
    }));
    root.querySelectorAll<HTMLInputElement>('input[name=storage]').forEach((r) => r.addEventListener('change', () => { ui.storage = r.value as Ev3Storage; ctx.sound.sfx('select'); ctx.rerender(); }));
    root.querySelectorAll<HTMLInputElement>('input[name=scope]').forEach((r) => r.addEventListener('change', () => { ui.scope = r.value as ShareScope; ctx.sound.sfx('select'); ctx.rerender(); }));
    root.querySelector('[data-testid=ev3-share]')?.addEventListener('click', () => {
      if (!ui.storage) return;
      const lines = ctx.act((st2) => commitEv3Share(st2, ui.storage!, ui.scope));
      ctx.sound.sfx('confirm');
      ui.piiAnnounced = true;
      ctx.dlg.play([...lines, 'ev3_pii_found']);
    });
    root.querySelector('[data-roster]')?.addEventListener('click', () => openModal('📊 운영명단_원본.xlsx', rosterPreview(false)));
    root.querySelectorAll<HTMLButtonElement>('[data-pii]').forEach((b) => b.addEventListener('click', () => {
      const lines = ctx.act((st2) => commitEv3Pii(st2, b.dataset.pii as Ev3Pii));
      ctx.sound.sfx(b.dataset.pii === 'company' ? 'warn' : 'confirm');
      const extra = needsKeyDecision(ctx.store.state) && !ui.keyAnnounced ? ['ev3_key_found'] : [];
      ui.keyAnnounced = ui.keyAnnounced || extra.length > 0;
      ctx.dlg.play([...lines, ...extra]);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => b.addEventListener('click', () => {
      ctx.dlg.play(ctx.act((st2) => commitEv3Key(st2, b.dataset.key as Ev3Key)));
      ctx.sound.sfx('confirm');
    }));
    root.querySelector('[data-testid=ev3-apply]')?.addEventListener('click', () => {
      ctx.act((st2) => { if (!st2.flags.ev3_applied) { applyEv3ToFiles(st2); st2.flags.ev3_applied = true; } });
      ctx.sound.sfx('file');
      const sh = ctx.store.state.decisions.ev3_storage === 'shared';
      ctx.dlg.systemMessage(sh ? '자료가 사내 승인 공유함 › 교육팀 폴더로 이동했습니다 (가상)' : '자료를 내 작업함에 정리했습니다', 'file');
      document.dispatchEvent(new CustomEvent('files:tab', { detail: sh ? 'shared' : 'mine' }));
    });
    root.querySelector('[data-testid=to-after]')?.addEventListener('click', () => ctx.go('after'));
  },
};

function pickVersion(ctx: Ctx, id: string) {
  const lines = ctx.act((st) => commitEv3Version(st, id));
  ctx.sound.sfx('confirm');
  ctx.dlg.play(lines);
}

