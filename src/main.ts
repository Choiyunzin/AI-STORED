import './style.css';
import type { SceneId } from './types';
import type { Ctx, Scene } from './scenes/ctx';
import { Store } from './ui/store';
import { VoiceManager } from './audio/voice';
import { SoundManager } from './audio/sound';
import { DialogueController } from './ui/dialogue';
import { buildShell, renderRoster, renderTop, renderFiles, openFileModal, openProfile, openSettings, closeModal, setRosterExpression, toast, $ } from './ui/shell';
import { setScene, SCENE_LABEL } from './logic/game';
import { introScene } from './scenes/intro';
import { ev1Scene } from './scenes/ev1';
import { ev2Scene } from './scenes/ev2';
import { ev3Scene } from './scenes/ev3';
import { afterScene } from './scenes/after';
import { reportScene } from './scenes/report';
import { endingScene } from './scenes/ending';
import { avatarEl } from './ui/avatar';
import { SPEAKER_ORDER } from './data/characters';
import { MAPS } from './data/maps';
import { OfficeMap } from './ui/map';
import { playCutscene } from './ui/cutscene';

const SCENES: Partial<Record<SceneId, Scene>> = {
  intro: introScene, ev1: ev1Scene, ev2: ev2Scene, ev3: ev3Scene, after: afterScene, report: reportScene, ending: endingScene,
};

const app = document.getElementById('app')!;
buildShell(app);

const store = new Store();
const voice = new VoiceManager();
const sound = new SoundManager();
const dlg = new DialogueController($('#dialogue'), $('#left .messenger'), voice, sound);
let fileTab: 'mine' | 'shared' = 'mine';
let highlight: string | undefined;
let map: OfficeMap | null = null;
let goSeq = 0;

const ctx: Ctx = {
  store, dlg, sound, voice,
  go: (scene) => go(scene),
  rerender: () => renderScene(),
  openFile: (id) => openFileModal(store, id),
  act: (fn) => {
    const before = new Set(store.state.files.map((f) => f.id));
    const res0 = { slack: store.state.slack, ai: store.state.ai };
    const r = store.update(fn);
    floatCost(store.state.slack - res0.slack, store.state.ai - res0.ai);
    const fresh = store.state.files.filter((f) => !before.has(f.id));
    if (fresh.length) {
      highlight = fresh[fresh.length - 1].id;
      fileTab = fresh[fresh.length - 1].location;
      toast(`📄 새 파일: ${fresh.map((f) => f.name).join(', ')}`);
      renderFilesPanel();
      highlight = undefined; // 새 파일 강조 애니메이션은 한 번만
      document.body.classList.add('files-pulse');
      setTimeout(() => document.body.classList.remove('files-pulse'), 900);
    }
    renderScene();
    return r;
  },
};

dlg.openSettings = () => openSettings(voice, sound, dlg, () => renderTop(store.state, voice));
dlg.onSpeakerChange = (id, expr) => setRosterExpression(id, expr);

/** 자원 변화가 상단 계기판으로 떠오르는 애니메이션 */
function floatCost(dSlack: number, dAi: number) {
  const show = (sel: string, text: string, good: boolean) => {
    const anchor = $(sel);
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = `float-cost ${good ? 'good' : 'bad'}`;
    f.textContent = text;
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.bottom + 4}px`;
    document.body.appendChild(f);
    anchor.closest('.res-item')?.classList.add('bump');
    setTimeout(() => { f.remove(); anchor.closest('.res-item')?.classList.remove('bump'); }, 1400);
  };
  if (dSlack) show('#topbar .slack-n', `⏱ ${dSlack > 0 ? '+' : ''}${dSlack}칸`, dSlack > 0);
  if (dAi) show('#topbar .ai-n', `✦ ${dAi > 0 ? '+' : ''}${dAi}`, dAi > 0);
}

function renderFilesPanel() {
  renderFiles(store.state, fileTab, (id) => openFileModal(store, id), highlight);
}

store.subscribe(() => { renderTop(store.state, voice); renderFilesPanel(); });

function renderScene() {
  if (map) return;
  const scene = SCENES[store.state.scene];
  if (!scene) return;
  const ws = $('#workspace');
  let root = ws.querySelector<HTMLElement>(':scope > .pc-window > .pc-body');
  if (!root) {
    ws.innerHTML = `<div class="pc-window"><div class="pc-titlebar"><span class="dots"><i></i><i></i><i></i></span><b class="pc-title"></b><span class="pc-user">👩‍💼 윤진의 PC · 사내망</span></div><div class="pc-body"></div></div>`;
    root = ws.querySelector<HTMLElement>('.pc-body')!;
  }
  ws.querySelector('.pc-title')!.textContent = `🗂 AX 업무 보드 — ${SCENE_LABEL[store.state.scene]}`;
  // 다시 그릴 때 포커스 유지
  const active = document.activeElement as HTMLElement | null;
  const key = active && root.contains(active) ? (active.dataset.testid || active.getAttribute('data-assign') || (active as HTMLInputElement).value) : null;
  const scroll = root.scrollTop;
  scene.render(root, ctx);
  root.scrollTop = scroll;
  if (key) {
    const el = root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(key)}"], [data-assign="${CSS.escape(key)}"]`);
    if (el && !(el as HTMLButtonElement).disabled) el.focus();
    else root.querySelector<HTMLElement>('.scene-title')?.focus();
  }
}

/** 장면 전환: 방 이름이 지나가는 전환 효과 → 탐색 화면(방향키 이동) → 자리에 도착하면 업무 화면 */
function go(scene: SceneId) {
  dlg.stopAll();
  closeModal();
  store.update((s) => setScene(s, scene));
  const def = MAPS[scene];
  const seq = ++goSeq;
  transition(def ? `📍 ${def.room}` : '', def?.time || '', () => {
    if (seq !== goSeq) return;
    if (def && !store.state.flags[`map_${scene}`]) openMap(scene);
    else openDesk(scene);
  });
}

function openMap(scene: SceneId) {
  const def = MAPS[scene]!;
  map?.destroy();
  const root = $('#workspace');
  root.classList.add('map-mode');
  root.scrollTop = 0;
  map = new OfficeMap(root, def, dlg, sound, () => {
    store.update((s) => { s.flags[`map_${scene}`] = true; });
    openDesk(scene);
  });
  (window as any).__axgame.map = map;
}

function openDesk(scene: SceneId) {
  map?.destroy();
  map = null;
  const root = $('#workspace');
  root.classList.remove('map-mode');
  root.innerHTML = '';
  root.classList.add('desk-in');
  setTimeout(() => root.classList.remove('desk-in'), 400);
  renderScene();
  root.querySelector<HTMLElement>('.pc-body')?.scrollTo(0, 0);
  root.querySelector<HTMLElement>('.scene-title')?.focus();
  SCENES[scene]?.enter?.(ctx);
}

function transition(title: string, sub: string, mid: () => void) {
  const el = $('#transition');
  if (!title) { mid(); return; }
  el.innerHTML = `<div><b>${title}</b><span>${sub}</span></div>`;
  el.classList.remove('run');
  void el.offsetWidth;
  el.classList.add('run');
  sound.sfx('select');
  setTimeout(mid, 450);
  setTimeout(() => el.classList.remove('run'), 1300);
}

// ── 시작 화면 ─────────────────────────────────────────
function showTitle() {
  const saved = Store.loadSaved();
  const t = document.createElement('div');
  t.id = 'title';
  t.innerHTML = `<div class="title-card" role="dialog" aria-labelledby="title-h">
    <p class="kicker">교육팀 협업 시뮬레이션 · 약 8~10분</p>
    <h1 id="title-h">입사 D-7,<br/>우리 팀의 AX 작전</h1>
    <p class="lead">당신은 팀에 합류한 지 얼마 안 됐지만 AI를 잘 쓰는 <b>윤진 매니저</b>입니다.<br/>신입사원 30명의 온보딩을 일주일 안에 준비하세요.</p>
    <div class="title-team">${SPEAKER_ORDER.map((id) => avatarEl(id, 'smile', 52)).join('')}</div>
    <div class="title-btns">
      ${saved && saved.scene !== 'ending' ? `<button type="button" class="btn primary big" data-t="resume" data-testid="resume">이어하기 <small>(${saved.scene})</small></button>` : ''}
      <button type="button" class="btn ${saved && saved.scene !== 'ending' ? '' : 'primary'} big" data-t="voice" data-testid="start-voice">🔊 소리 켜고 시작</button>
      <button type="button" class="btn big" data-t="natural" data-testid="start-natural" title="Edge·Chrome의 온라인 신경망 음성을 씁니다. 대사 텍스트가 브라우저 제조사의 음성 서비스로 전송됩니다.">🎙 자연스러운 음성으로 시작 <small>(온라인 음성)</small></button>
      <button type="button" class="btn big" data-t="subtitle" data-testid="start-subtitle">💬 자막으로 시작</button>
      <button type="button" class="btn ghost" data-intro data-testid="title-intro">🎬 게임 소개 먼저 보기</button>
    </div>
    <p class="muted small">가상의 업무 환경입니다. 외부 AI 호출·실제 업로드·개인정보 수집이 없으며, 모든 인명·연락처·키는 가상 데이터입니다.<br/>선택 기록은 이 브라우저(localStorage)에만 저장됩니다.</p>
  </div>`;
  document.body.appendChild(t);
  (t.querySelector('.btn.primary') as HTMLElement)?.focus();
  t.querySelector('[data-intro]')!.addEventListener('click', () => { sound.init(); playCutscene(sound, () => (t.querySelector('.btn.primary') as HTMLElement)?.focus()); });
  t.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.t!;
    // 사용자 클릭 안에서 오디오 초기화
    sound.init();
    if (kind === 'resume' && saved) {
      store.state = saved;
      voice.voiceOn = saved.audioMode === 'voice';
    } else {
      store.reset(kind === 'subtitle' ? 'subtitle' : 'voice');
      voice.voiceOn = kind !== 'subtitle';
      if (kind === 'natural' || kind === 'voice') { voice.allowRemote = kind === 'natural'; voice.persist(); voice.refreshVoiceList(); }
      $('#left .messenger').innerHTML = '';
    }
    if (voice.voiceOn && voice.ttsSupported) {
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* noop */ }
    }
    t.remove();
    renderTop(store.state, voice);
    renderFilesPanel();
    const begin = () => go(store.state.scene === 'title' ? 'intro' : store.state.scene);
    // 새 게임은 상황·규칙을 설명하는 도입 컷신부터 (타자기 효과, 음성 없음)
    if (kind === 'resume') begin(); else playCutscene(sound, begin);
    if (voice.voiceOn && voice.status === 'no-korean') toast('이 PC에서 사용할 수 있는 한국어 음성을 찾지 못했습니다. 자막으로 진행합니다.');
    else if (kind === 'natural' && !voice.hasNatural()) toast('이 브라우저에는 자연스러운 한국어 음성이 없어요. Microsoft Edge에서 열면 사람 같은 음성(SunHi·InJoon 등)을 쓸 수 있어요.');
  }));
}

// ── 전역 이벤트 ───────────────────────────────────────
renderRoster((id) => openProfile(id, store.state));
document.querySelectorAll<HTMLButtonElement>('#right [role=tab]').forEach((b) => b.addEventListener('click', () => { fileTab = b.dataset.tab as 'mine' | 'shared'; renderFilesPanel(); }));
document.addEventListener('files:tab', (e) => { fileTab = (e as CustomEvent).detail; renderFilesPanel(); });
$('#btn-settings').addEventListener('click', () => dlg.openSettings());
$('#btn-help').addEventListener('click', () => { dlg.stopAll(); playCutscene(sound, () => {}, 3); });
$('#btn-mute').addEventListener('click', () => toggleMute());
const drawer = (side: 'left' | 'right') => {
  const cls = `show-${side}`;
  const on = !document.body.classList.contains(cls);
  document.body.classList.remove('show-left', 'show-right');
  if (on) document.body.classList.add(cls);
  ($('#drawer-scrim') as HTMLElement).hidden = !on;
};
$('#btn-left').addEventListener('click', () => drawer('left'));
$('#btn-right').addEventListener('click', () => drawer('right'));
$('#drawer-scrim').addEventListener('click', () => { document.body.classList.remove('show-left', 'show-right'); ($('#drawer-scrim') as HTMLElement).hidden = true; });

function toggleMute() {
  voice.voiceOn = !voice.voiceOn;
  if (!voice.voiceOn) voice.stop();
  store.update((s) => { s.audioMode = voice.voiceOn ? 'voice' : 'subtitle'; });
  toast(voice.voiceOn ? '음성 켜짐' : '음성 꺼짐 — 자막으로 진행');
}

document.addEventListener('keydown', (e) => {
  if (document.getElementById('title')) return;
  const modalOpen = !!$('#modal-root').innerHTML;
  if (e.key === 'Escape') { closeModal(); document.body.classList.remove('show-left', 'show-right'); return; }
  if (modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target as HTMLElement).tagName;
  const interactive = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY', 'LABEL'].includes(tag);
  if ((e.key === 'Enter' || e.key === ' ') && !interactive) { e.preventDefault(); dlg.next(); }
  else if (interactive && ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  else if (e.key === 'r' || e.key === 'R') dlg.replay();
  else if (e.key === 's' || e.key === 'S') dlg.skip();
  else if (e.key === 'm' || e.key === 'M') toggleMute();
});

document.addEventListener('game:restart', () => {
  dlg.stopAll();
  Store.clearSaved();
  location.reload();
});

voice.onStatus(() => { /* 설정 창이 열려 있지 않으면 상단만 갱신 */ renderTop(store.state, voice); });
void voice.init();
renderTop(store.state, voice);
renderFilesPanel();
showTitle();

voice.onSpeaking((speaking, speaker) => {
  document.querySelectorAll<HTMLElement>('.sprite').forEach((el) => el.classList.toggle('talking', speaking && el.dataset.id === speaker));
});

// 테스트·디버그용 (상태 읽기 전용 노출)
(window as any).__axgame = { get state() { return store.state; }, voice, dlg, map: null as OfficeMap | null };
