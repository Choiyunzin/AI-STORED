import type { FileItem, GameState } from '../types';
import { CHARACTERS } from './characters';
import { EV3_VERSIONS } from '../logic/game';
import { EV3_SCOPE } from './options';

/** 파일 미리보기 내용. 모든 인명·연락처·키는 가상 데이터다. */

const OLD_ENTRY = '정문 안내데스크에서 임시 출입증을 받은 뒤 입장 (작년 절차)';
const NEW_ENTRY = '모바일 사원증 앱으로 QR 등록 후 동문 게이트 입장 (올해 절차)';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function previewTaskA(): string {
  return `<p class="muted">검토가 끝난 안내문 (요청: 3줄만 수정)</p>
  <ol class="doc">
    <li>신입사원 여러분, 입사를 환영합니다.</li>
    <li class="chg">교육 장소: <del>본관 3층 대회의실</del> → <ins>연수동 2층 201호</ins></li>
    <li class="chg">시작 시간: <del>09:30</del> → <ins>09:00</ins></li>
    <li class="chg">점심: <del>지하 1층 식당</del> → <ins>연수동 1층 라운지 (도시락)</ins></li>
    <li>준비물: 신분증, 개인 노트북(선택)</li>
    <li>문의: 교육팀 공용 메신저 채널</li>
  </ol>`;
}

const SAMPLES = [
  ['#014', '주차할 곳을 못 찾아서 첫날 지각했어요.'],
  ['#087', '점심 장소가 멀어서 오후 교육에 늦었습니다.'],
  ['#121', '출입증이 늦게 나와서 30분 기다렸어요.'],
  ['#156', '주차 안내가 전날 밤에 와서 확인을 못 했어요.'],
  ['#203', '식사는 맛있었는데 줄이 너무 길었어요.'],
  ['#245', '자료를 어디서 받는지 몰랐습니다.'],
];

export function previewTaskB(): string {
  return `<p class="muted">작년 신입사원 온보딩 교육 만족도 조사 · 주관식 응답 300건 중 일부 (가상 데이터)</p>
  <ul class="samples">${SAMPLES.map(([n, t]) => `<li><b>${n}</b> ${esc(t)}</li>`).join('')}<li class="muted">… 외 294건</li></ul>`;
}

function analysisTable(s: GameState): string {
  const b = s.decisions.ev1_B;
  const checked = b !== 'full' || s.decisions.fu_unverified === 'check';
  const rows = checked
    ? [['출입·주차 안내 늦음', 92, '#156 주차 안내가 전날 밤에 와서…'], ['점심 동선·대기', 71, '#087 점심 장소가 멀어서…'], ['자료 위치 모름', 54, '#245 자료를 어디서 받는지…'], ['기타', 83, '—']]
    : [['식사 불만', 128, '(대표 근거 없음)'], ['자료 위치 모름', 54, '(대표 근거 없음)'], ['기타', 118, '—']];
  return `<table class="tbl"><thead><tr><th>묶음</th><th>건수</th><th>대표 근거</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${esc(String(r[2]))}</td></tr>`).join('')}</tbody></table>
  ${checked ? '' : '<p class="warn-box">⚠ 원문 미확인: 주차 관련 응답이 "식사 불만"에 섞여 있음</p>'}
  ${b === 'human' ? '<p class="muted">300건 수작업 분류 · 작업 여유 6칸 사용</p>' : ''}`;
}

function noticeDoc(s: GameState): string {
  if (s.decisions.ev1_A === 'full') {
    return `<p class="warn-box">AI 전체 재작성: 검토가 끝난 문장 3개도 바뀌어 전체 재검토를 했습니다.</p>
    <ol class="doc">
      <li class="chg"><del>신입사원 여러분, 입사를 환영합니다.</del> → <ins>새로운 여정을 시작하는 여러분을 진심으로 환영합니다!</ins></li>
      <li class="chg">교육 장소: 연수동 2층 201호</li><li class="chg">시작 시간: 09:00</li><li class="chg">점심: 연수동 1층 라운지 (도시락)</li>
      <li class="chg"><del>준비물: 신분증, 개인 노트북(선택)</del> → <ins>필수 준비물: 신분증과 노트북</ins> <span class="tag warn">의미 변경 → 원래대로 되돌림</span></li>
      <li class="chg"><del>문의: 교육팀 공용 메신저 채널</del> → <ins>문의 사항은 언제든 편하게 연락 주세요</ins></li>
    </ol>`;
  }
  return `<ol class="doc"><li>신입사원 여러분, 입사를 환영합니다.</li>
    <li class="chg">교육 장소: 연수동 2층 201호</li><li class="chg">시작 시간: 09:00</li><li class="chg">점심: 연수동 1층 라운지 (도시락)</li>
    <li>준비물: 신분증, 개인 노트북(선택)</li><li>문의: 교육팀 공용 메신저 채널</li></ol>
    <p class="muted">${s.decisions.ev1_A === 'human' ? '치안 매니저가 직접 수정 · 바뀐 3줄만 확인' : 'AI 초안 3줄 + 사람 확인'}</p>`;
}

/** HTML 데모 버전 미리보기 (sandbox iframe srcdoc, 스크립트 없음) */
export function toolSrcdoc(s: GameState): string {
  const entry = s.flags.stale_html ? OLD_ENTRY : (s.decisions.ev2_input ? NEW_ENTRY : (s.decisions.ev2_method === 'reuse' ? OLD_ENTRY : '확인 중'));
  const c = s.decisions.ev2_collect;
  const collect = !c
    ? (s.decisions.ev2_method === 'quick'
      ? '<button class="fake">의견 제출 → 자동 취합 완료</button><p class="note">⚠ AI가 데모 버전에 넣은 버튼입니다. 실제 저장 경로는 없습니다.</p>'
      : '<p class="note">응답 저장 방식 미정</p>')
    : c === 'survey' ? '<a href="#" onclick="return false">의견 남기기 (승인 설문 도구로 이동)</a><p class="note">응답은 승인된 설문 도구에 저장됩니다.</p>'
    : c === 'request' ? '<p class="note">의견 수집: 사내 시스템 연결 요청 중 — 현재 이 화면에서는 저장되지 않습니다.</p>'
    : '<p class="note">이 안내 도구는 의견을 수집하지 않습니다. 의견은 교육 종료 후 설문으로 받습니다.</p>';
  const link = s.flags.link_bug ? '<a href="#" onclick="return false" class="broken">교육 일정표 (링크 오류)</a>' : '<a href="#" onclick="return false">교육 일정표</a>';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  body{font-family:system-ui,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;margin:0;background:#f6f8fc;color:#222;font-size:14px}
  header{background:#3f4f8f;color:#fff;padding:12px 16px;font-weight:700}
  main{padding:12px 16px}details{background:#fff;border:1px solid #dde3ef;border-radius:8px;margin:8px 0;padding:8px 12px}
  summary{cursor:pointer;font-weight:600}.note{color:#555;font-size:12px}.fake{background:#2e9b6a;color:#fff;border:0;border-radius:6px;padding:8px 12px}
  .broken{color:#c33;text-decoration:line-through}a{color:#2d5bd3}
  </style></head><body><header>첫날 안내 · 신입사원 온보딩 (데모 버전)</header><main>
  <details open><summary>어디로 들어가나요?</summary><p>${entry}</p></details>
  <details><summary>교육은 어디서, 언제?</summary><p>연수동 2층 201호 · 09:00 시작</p></details>
  <details><summary>점심은?</summary><p>연수동 1층 라운지 (도시락)</p></details>
  <details><summary>자료는 어디서?</summary><p>${link}</p></details>
  <details open><summary>의견 남기기</summary>${collect}</details>
  ${s.flags.missing_req ? '<p class="note">※ 문구가 코드 안에 들어 있어 담당자가 직접 고치기 어렵습니다.</p>' : '<p class="note">※ 안내 문구는 표 파일(안내문구.csv)에서 담당자가 수정합니다.</p>'}
  </main></body></html>`;
}

function prd(s: GameState): string {
  return `<div class="prd">
  <div><h5>대상·목적</h5><p>신입사원 30명이 첫날 필요한 정보를 스스로 찾고, 의견을 남긴다.</p></div>
  <div><h5>필수 기능</h5><p>출입·장소·시간·식사·자료 안내 / 의견 남기기 / 담당자가 문구 수정 가능</p></div>
  <div><h5>사내 실행·저장 조건</h5><p>사내 접속에서만 열림. 응답 저장은 승인된 경로만 (HTML 공유 ≠ 응답 수집)</p></div>
  <div><h5>완료 기준</h5><p>올해 출입 절차 반영 · 희연 요구사항 확인 · 홍팀장 승인${s.decisions.ev2_collect ? ` · 수집: ${esc(s.files.find((f) => f.id === 'f_tool')?.status || '')}` : ''}</p></div></div>`;
}

function reviewRecord(s: GameState): string {
  const rows = s.log.filter((l) => l.decision.startsWith('ev2_') || l.decision.startsWith('cost:ev2'));
  return `<ul class="rec">${rows.map((l) => `<li>${esc(l.label)} <span class="muted">(${costText(l)})</span></li>`).join('')}</ul>
  <p class="muted">AI 검토는 입력된 자료 안에서만 비교합니다. 최종 확인 책임은 사람에게 있습니다.</p>`;
}

export const costText = (c: { slack: number; ai: number }) => {
  const p: string[] = [];
  if (c.slack) p.push(`여유 ${c.slack > 0 ? '-' : '+'}${Math.abs(c.slack)}`);
  if (c.ai) p.push(`이용권 -${c.ai}`);
  return p.join(', ') || '비용 없음';
};

export function versionPreview(id: string): string {
  const v = EV3_VERSIONS.find((x) => x.id === id)!;
  const entry = id === 'v3' ? NEW_ENTRY : OLD_ENTRY;
  return `<dl class="meta">
    <dt>작성/올린 사람</dt><dd>${CHARACTERS[v.owner].name}</dd>
    <dt>시각</dt><dd>${v.time}</dd>
    <dt>검토 상태</dt><dd><span class="tag ${v.review.includes('완료') ? 'ok' : v.review === '미검토' ? 'warn' : ''}">${v.review}</span></dd>
    <dt>변경 내용</dt><dd>${esc(v.change)}</dd></dl>
    <div class="doc-box"><b>출입 안내</b><p>${entry}</p><b>교육 장소</b><p>${id === 'v3' ? '연수동 2층 201호' : '본관 3층 대회의실'}</p></div>`;
}

export function rosterPreview(clean: boolean): string {
  const rows = [
    ['신입 A', '영업1팀', '010-0000-1111', '알레르기: 땅콩 / 지난 면접 메모: 연봉 협상 길었음'],
    ['신입 B', '재무팀', '010-0000-2222', '주말 연락 선호 안 함'],
    ['신입 C', '개발팀', '010-0000-3333', '기숙사 신청'],
  ];
  return `<p><span class="tag ${clean ? 'ok' : 'danger'}">정보 등급: ${clean ? '내부용 (정리본)' : '대외비 · 개인정보 포함'}</span> <span class="muted">모든 내용은 가상 데이터</span></p>
  <table class="tbl"><thead><tr><th>이름</th><th>배치</th><th>연락처</th><th>메모</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${clean ? '<span class="muted">(운영 담당만)</span>' : `<mark>${r[2]}</mark>`}</td><td>${clean ? (r[3].includes('알레르기') ? '식사: 땅콩 제외' : r[3].includes('기숙사') ? '기숙사 신청' : '—') : `<mark>${esc(r[3])}</mark>`}</td></tr>`).join('')}
  </tbody></table>`;
}

export function promptMemoPreview(removed: boolean): string {
  return `<pre class="code">[신입 안내 도구 프롬프트 v3]
너는 교육팀 안내 도구를 만드는 도우미다.
대상: 신입사원 30명 / 사내 접속 전용 / 문구는 표 파일로 분리
출입 절차는 반드시 '올해 공지'를 근거로 작성
${removed ? '<span class="muted"># (키 줄 삭제됨 · 폐기 요청 완료)</span>' : '<mark>AI_KEY=DEMO-KEY-0000-가상값-실제키아님</mark>'}
</pre>`;
}

export function fileContent(f: FileItem, s: GameState): string {
  switch (f.id) {
    case 'f_notice': return noticeDoc(s);
    case 'f_analysis': return analysisTable(s);
    case 'f_prd': return prd(s);
    case 'f_req': return `<pre class="code">"신입사원 첫날 안내 도구 HTML로 만들어줘. 의견 받는 버튼도."</pre><p class="muted">대상·조건·완료 기준이 없는 한 줄 요청 기록</p>`;
    case 'f_reuse': return `<p>작년 승인된 "첫날 안내" 도구를 복사해 수정.</p><ul><li>재사용: 화면 구조, 질문 목록</li><li>한계: 의견 남기기 기능 없음 → 추가 필요</li><li>최신성: 출입 절차가 작년 기준 → 확인 필요</li></ul>`;
    case 'f_tool': return `<p class="muted">데모 버전 미리보기 · 응답 저장 상태: <b>${esc(f.status || '미정')}</b></p><iframe class="proto" sandbox="" title="HTML 데모 버전 미리보기" srcdoc="${esc(toolSrcdoc(s))}"></iframe>`;
    case 'f_review': return reviewRecord(s);
    case 'f_api': return `<dl class="meta"><dt>요청</dt><dd>신입사원 의견 응답을 사내 DB에 저장하는 시스템 연결</dd><dt>상태</dt><dd><span class="tag warn">요청 중 · 승인/연결 전</span></dd><dt>예상</dt><dd>정보보호·IT 검토 후 2주 (가상 일정)</dd></dl><p class="muted">승인 전까지 HTML은 응답을 저장하지 않습니다.</p>`;
    case 'f_guide_base': return versionPreview(s.decisions.ev3_version || 'v3') + (s.decisions.fu_stale === 'fix' ? '<p class="ok-box">사후 수정: 올해 출입 절차로 교체됨</p>' : '');
    case 'f_readme': return `<h4>첫날 안내 도구 · 사용법</h4><ul><li>목적: 신입사원 첫날 정보 안내${s.decisions.ev2_collect ? ` / 수집: ${esc(s.files.find((x) => x.id === 'f_tool')?.status || '')}` : ''}</li><li>여는 법: 사내 접속 → 사내 승인 공유함 › 교육팀 › 첫날_안내도구.html</li><li>수정: ${s.flags.missing_req ? '현재 코드 직접 수정 필요 (윤진 문의)' : '안내문구.csv 수정'}</li><li>담당자: 윤진 매니저 / 검토: ${esc(s.files.find((x) => x.id === 'f_tool')?.review || '')}</li><li>버전: v1.0 (${s.decisions.ev3_level === '3' ? '변경 이유는 재사용 문서 참고' : '변경 이유 미기록'})</li></ul>`;
    case 'f_promptpack': return promptMemoPreview(s.decisions.ev3_key !== 'keep' || s.decisions.fu_key !== undefined) + `<p>${s.decisions.ev2_method === 'quick' && s.decisions.fu_prompt !== 'fix' ? '<span class="tag warn">근거 자료(요구사항) 없음</span>' : '요구사항: 업무 정의서 / 검토 기록 첨부 · 변경 이유: 올해 출입 절차 변경'}</p>`;
    case 'f_roster': return rosterPreview(s.decisions.ev3_pii === 'clean' || s.decisions['fu_pii:replace'] !== undefined) + `<p class="muted">열람 범위: ${f.scope ? EV3_SCOPE[f.scope].label : '-'}${f.status ? ` · ${esc(f.status)}` : ''}</p>`;
    default: return '<p class="muted">미리보기 없음</p>';
  }
}
