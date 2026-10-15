import type { FileItem, GameState, SpeakerId } from '../types';
import { CHARACTERS, SPEAKER_ORDER } from '../data/characters';
import { INITIAL, EV3_SCOPE } from '../data/options';
import { SCENE_LABEL, SCENE_ORDER, markOpened } from '../logic/game';
import { avatarEl } from './avatar';
import { esc, fileContent } from '../data/files';
import type { Store } from './store';
import type { VoiceManager } from '../audio/voice';
import type { SoundManager } from '../audio/sound';
import type { DialogueController } from './dialogue';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function buildShell(app: HTMLElement) {
  app.innerHTML = `
  <header id="topbar">
    <div class="brand"><span class="logo" aria-hidden="true">D-7</span><span class="brand-t">입사 D-7, 우리 팀의 AX 작전</span></div>
    <ol class="stepper" aria-label="진행 단계"></ol>
    <div class="res" aria-live="polite">
      <div class="res-item" title="게임 속 업무 비용입니다. 실제 시간이 아닙니다."><span class="res-l">작업 여유</span><span class="slack-cells"></span><b class="slack-n"></b></div>
      <div class="res-item" title="입력 분량·생성·재작업을 나타내는 가상 단위입니다. 실제 토큰 요금이 아닙니다."><span class="res-l">AI 이용권</span><span class="ai-bar"><i></i></span><b class="ai-n"></b></div>
    </div>
    <div class="top-btns">
      <button type="button" class="btn icon" id="btn-mute" title="음성 켜기/끄기 (M)" aria-pressed="false">🔊</button>
      <button type="button" class="btn icon" id="btn-settings" title="음성·소리 설정">⚙</button>
      <button type="button" class="btn icon only-narrow" id="btn-left" title="메신저 열기">💬</button>
      <button type="button" class="btn icon only-mid" id="btn-right" title="파일함 열기">🗂</button>
    </div>
  </header>
  <aside id="left" aria-label="팀 메신저와 팀원">
    <section class="roster" aria-label="팀원 목록"><h2>교육팀</h2><ul></ul></section>
    <section class="messenger-wrap"><h2>팀 메신저</h2><div class="messenger" role="log" aria-label="메신저 기록"></div></section>
  </aside>
  <main id="center">
    <section id="workspace" tabindex="-1"></section>
    <section id="dialogue" aria-label="대화"></section>
  </main>
  <aside id="right" aria-label="파일함">
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="mine" aria-selected="true">내 작업함</button>
      <button type="button" role="tab" data-tab="shared" aria-selected="false">팀 공유함</button>
    </div>
    <div class="filelist" role="tabpanel"></div>
    <p class="right-note">‘사내 승인 공유함’은 게임 속 가상 저장소입니다. 실제 업로드·네트워크 요청은 없습니다.</p>
  </aside>
  <div id="drawer-scrim" hidden></div>
  <div id="modal-root"></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="transition" aria-hidden="true"></div>`;
}

export function renderRoster(onPick: (id: SpeakerId) => void) {
  const ul = $('#left .roster ul');
  ul.innerHTML = SPEAKER_ORDER.map((id) => {
    const c = CHARACTERS[id];
    return `<li><button type="button" class="roster-item" data-id="${id}" title="${c.name} 정보 보기">${avatarEl(id, 'neutral', 34)}<span><b>${c.name}</b><small>${c.strengths[0]}</small></span></button></li>`;
  }).join('');
  ul.querySelectorAll<HTMLButtonElement>('.roster-item').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.id as SpeakerId)));
}

export function setRosterExpression(id: SpeakerId | null, expr?: string) {
  document.querySelectorAll<HTMLElement>('.roster-item').forEach((el) => el.classList.toggle('speaking', el.dataset.id === id));
  void expr;
}

export function renderTop(s: GameState, voice: VoiceManager) {
  const st = $('#topbar .stepper');
  const cur = SCENE_ORDER.indexOf(s.scene);
  st.innerHTML = SCENE_ORDER.map((sc, i) => `<li class="${i < cur ? 'past' : i === cur ? 'cur' : ''}" ${i === cur ? 'aria-current="step"' : ''}>${SCENE_LABEL[sc]}</li>`).join('');
  const cells = $('#topbar .slack-cells');
  cells.innerHTML = Array.from({ length: INITIAL.slack }, (_, i) => `<i class="${i < s.slack ? 'on' : ''}"></i>`).join('') + (s.slack > INITIAL.slack ? `<em>+${s.slack - INITIAL.slack}</em>` : '');
  $('#topbar .slack-n').textContent = `${s.slack}칸${s.overtime ? ` · 초과 ${s.overtime}` : ''}`;
  $('#topbar .slack-n').classList.toggle('low', s.slack <= 3);
  ($('#topbar .ai-bar i') as HTMLElement).style.width = `${Math.max(0, Math.min(100, s.ai))}%`;
  $('#topbar .ai-n').textContent = `${s.ai}점`;
  $('#topbar .ai-n').classList.toggle('low', s.ai < 30);
  const mute = $('#btn-mute');
  mute.textContent = voice.voiceOn ? '🔊' : '🔇';
  mute.setAttribute('aria-pressed', String(!voice.voiceOn));
  mute.setAttribute('aria-label', voice.voiceOn ? '음성 끄기' : '음성 켜기');
}

const KIND_ICON: Record<FileItem['kind'], string> = { doc: '📝', sheet: '📊', html: '🌐', record: '🗒', prompt: '💡', guide: '📘' };

export function renderFiles(s: GameState, tab: 'mine' | 'shared', onOpen: (id: string) => void, highlight?: string) {
  const list = $('#right .filelist');
  document.querySelectorAll<HTMLButtonElement>('#right [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const files = s.files.filter((f) => f.location === tab).sort((a, b) => b.createdAt - a.createdAt);
  if (!files.length) {
    list.innerHTML = `<p class="empty">${tab === 'mine' ? '아직 만든 산출물이 없어요.' : '아직 공유된 자료가 없어요. 사건 ③에서 공유 방식을 정합니다.'}</p>`;
    return;
  }
  list.innerHTML = files.map((f) => `
    <button type="button" class="file ${f.id === highlight ? 'new' : ''}" data-id="${f.id}">
      <span class="ficon" aria-hidden="true">${KIND_ICON[f.kind]}</span>
      <span class="fmain"><b>${esc(f.name)}</b>
        <span class="badges">
          <span class="tag ${/미확인|없음|위험|미검토|작년|요청 중|원본/.test(f.review) ? 'warn' : 'ok'}">${esc(f.review)}</span>
          ${f.scope ? `<span class="tag ${f.scope === 'company' ? 'danger' : ''}">${EV3_SCOPE[f.scope].label}</span>` : ''}
          ${f.location === 'shared' ? `<span class="tag ${f.reusable ? 'ok' : 'warn'}">${f.reusable ? '재사용 가능' : '재사용 어려움'}</span>` : ''}
          ${f.status && f.kind === 'html' ? `<span class="tag info">응답: ${esc(f.status)}</span>` : ''}
        </span></span>
    </button>`).join('');
  list.querySelectorAll<HTMLButtonElement>('.file').forEach((b) => b.addEventListener('click', () => onOpen(b.dataset.id!)));
}

// ── 모달 ───────────────────────────────────────────────
let lastFocus: HTMLElement | null = null;

export function openModal(title: string, bodyHtml: string, actions: { label: string; cls?: string; onClick: () => void; testid?: string }[] = [], wide = false) {
  closeModal();
  lastFocus = document.activeElement as HTMLElement;
  const root = $('#modal-root');
  root.innerHTML = `<div class="scrim" data-close></div><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-t">
    <header><h3 id="modal-t">${title}</h3><button type="button" class="btn icon" data-close aria-label="닫기">✕</button></header>
    <div class="modal-b">${bodyHtml}</div>
    <footer>${actions.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-a="${i}" ${a.testid ? `data-testid="${a.testid}"` : ''}>${a.label}</button>`).join('')}<button type="button" class="btn ghost" data-close>닫기</button></footer></div>`;
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => { const a = actions[Number(b.dataset.a)]; closeModal(); a.onClick(); }));
  const first = root.querySelector<HTMLElement>('footer .btn') || root.querySelector<HTMLElement>('.modal [data-close]');
  first?.focus();
  return root;
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root || !root.innerHTML) return;
  root.innerHTML = '';
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  else (document.getElementById('workspace') as HTMLElement | null)?.focus();
}

export function openFileModal(store: Store, id: string) {
  const s = store.state;
  const f = s.files.find((x) => x.id === id);
  if (!f) return;
  store.update((st) => markOpened(st, id));
  openModal(`${KIND_ICON[f.kind]} ${esc(f.name)}`, `
    <dl class="meta compact">
      <dt>담당</dt><dd>${CHARACTERS[f.owner].name}</dd>
      <dt>위치</dt><dd>${f.location === 'mine' ? '내 작업함' : '사내 승인 공유함'}${f.scope ? ` · ${EV3_SCOPE[f.scope].label}` : ''}</dd>
      <dt>검토 상태</dt><dd>${esc(f.review)}</dd>
      <dt>재사용</dt><dd>${esc(f.reuseNote)}</dd>
      ${f.status ? `<dt>상태</dt><dd>${esc(f.status)}</dd>` : ''}
    </dl><hr/>${fileContent(f, s)}`, [], f.kind === 'html');
}

export function openProfile(id: SpeakerId, s: GameState) {
  const c = CHARACTERS[id];
  const op = c.opinions[s.scene] || c.opinions.intro || '';
  openModal(`${c.name}`, `<div class="profile">${avatarEl(id, 'smile', 96)}<div>
    <p><b>${c.rank}</b> · ${c.gender === 'female' ? '여성' : '남성'} · ${c.dialect}</p>
    <p>${esc(c.personality)}</p>
    <p><b>업무 강점</b> ${c.strengths.map((x) => `<span class="tag">${x}</span>`).join(' ')}</p>
    <p class="opinion">💬 지금 의견: “${esc(op)}”</p></div></div>`);
}

export function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  window.setTimeout(() => t.classList.remove('show'), 2600);
}

// ── 설정 ───────────────────────────────────────────────
export function openSettings(voice: VoiceManager, sound: SoundManager, dlg: DialogueController, onChange: () => void) {
  const render = () => {
    const asg = voice.assignments();
    const usable = voice.usableVoices();
    const statusText = voice.status === 'unsupported' ? '이 브라우저는 음성 합성을 지원하지 않습니다. 자막으로 진행합니다.'
      : voice.status === 'loading' ? '음성 목록을 불러오는 중…'
      : voice.status === 'no-korean' ? '이 PC에서 사용할 수 있는 한국어 음성을 찾지 못했습니다. 자막으로 진행합니다.'
      : `사용 가능한 한국어 음성 ${usable.length}개${voice.allowRemote ? ' (원격 음성 포함)' : ' (이 PC 로컬 음성만)'}`;
    const fileCount = voice.manifest.size;
    return `
    <section class="set-sec"><h4>현재 음성 구현 상태</h4>
      <p>${esc(statusText)}</p>
      <p>음성 파일: <b>${fileCount}개</b> 등록 ${fileCount ? '' : '(아직 제작된 파일 없음 → 파일이 없는 대사는 TTS 또는 자막)'} · 최근 재생: <b>${esc(voice.lastInfo.detail)}</b></p>
      <p class="muted">브라우저 TTS는 높낮이·속도만 바꿀 수 있어 캐릭터의 성별 음색과 광주·경상도 억양을 정확히 표현하지 못합니다. 확정 음색은 음성 파일로 교체하세요.</p>
    </section>
    <section class="set-sec"><h4>소리</h4>
      <label class="row"><input type="checkbox" id="set-voice" ${voice.voiceOn ? 'checked' : ''}/> 캐릭터 음성</label>
      <label class="row">음성 음량 <input type="range" id="set-vol" min="0" max="1" step="0.1" value="${voice.volume}"/></label>
      <label class="row"><input type="checkbox" id="set-bgm" ${sound.bgmOn ? 'checked' : ''}/> 배경음악 (대사 중 자동으로 줄어듦)</label>
      <label class="row"><input type="checkbox" id="set-sfx" ${sound.sfxOn ? 'checked' : ''}/> 효과음 (메신저·파일·선택)</label>
      <label class="row"><input type="checkbox" id="set-auto" ${dlg.autoAdvance ? 'checked' : ''}/> 대사 자동 넘김 (기본 꺼짐)</label>
      <label class="row"><input type="checkbox" id="set-remote" ${voice.allowRemote ? 'checked' : ''}/> 원격(온라인) 음성도 허용 <span class="muted">— 대사 텍스트가 외부 음성 서비스로 전송될 수 있습니다. 사내망 기본값은 꺼짐.</span></label>
    </section>
    <section class="set-sec"><h4>캐릭터별 음성 배정 (실제 적용 상태)</h4>
      <table class="tbl"><thead><tr><th>캐릭터</th><th>연출 방향</th><th>적용 음성</th><th>높낮이/속도</th></tr></thead><tbody>
      ${asg.map((a) => `<tr><td>${CHARACTERS[a.speaker].name}</td><td class="muted">${esc(CHARACTERS[a.speaker].voiceDirection)}</td>
        <td><select data-sp="${a.speaker}" aria-label="${CHARACTERS[a.speaker].name} 음성">
          <option value="">자동</option><option value="none" ${voice.overrides[a.speaker] === 'none' ? 'selected' : ''}>자막만</option>
          ${usable.map((v) => `<option value="${esc(v.voiceURI)}" ${voice.overrides[a.speaker] === v.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
        </select><br/><small>${a.voice ? esc(a.voice.name) : '없음 → 자막'} · ${esc(a.note)}</small></td>
        <td>${a.pitch.toFixed(2)} / ${a.rate.toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      ${usable.length && usable.length < 7 ? `<p class="muted">한국어 음성이 ${usable.length}개뿐이라 여러 캐릭터가 같은 음성을 공유합니다(높낮이로만 구분).</p>` : ''}
    </section>
    <section class="set-sec"><h4>키보드</h4><p class="muted">Enter/Space: 다음 대사(버튼 밖에서) · R: 다시 듣기 · S: 건너뛰기 · M: 음성 켜기/끄기 · Esc: 창 닫기 · Tab: 선택지 이동</p></section>`;
  };
  const root = openModal('음성·소리 설정', render(), [
    { label: '음성 목록 다시 찾기', onClick: async () => { await voice.loadVoices(); openSettings(voice, sound, dlg, onChange); } },
    { label: '테스트 재생', cls: 'primary', onClick: () => { dlg.play(['intro_yunjin_01']); } },
  ], true);
  const bind = () => {
    const q = (id: string) => root.querySelector<HTMLInputElement>(id)!;
    q('#set-voice').addEventListener('change', (e) => { voice.voiceOn = (e.target as HTMLInputElement).checked; if (!voice.voiceOn) voice.stop(); onChange(); });
    q('#set-vol').addEventListener('input', (e) => { voice.volume = Number((e.target as HTMLInputElement).value); voice.persist(); });
    q('#set-bgm').addEventListener('change', (e) => sound.setBgm((e.target as HTMLInputElement).checked));
    q('#set-sfx').addEventListener('change', (e) => sound.setSfx((e.target as HTMLInputElement).checked));
    q('#set-auto').addEventListener('change', (e) => { dlg.autoAdvance = (e.target as HTMLInputElement).checked; });
    q('#set-remote').addEventListener('change', (e) => { voice.allowRemote = (e.target as HTMLInputElement).checked; voice.persist(); voice.refreshVoiceList(); openSettings(voice, sound, dlg, onChange); });
    root.querySelectorAll<HTMLSelectElement>('select[data-sp]').forEach((sel) => sel.addEventListener('change', () => {
      const sp = sel.dataset.sp as SpeakerId;
      if (sel.value) voice.overrides[sp] = sel.value; else delete voice.overrides[sp];
      voice.persist();
      openSettings(voice, sound, dlg, onChange);
    }));
  };
  bind();
}
