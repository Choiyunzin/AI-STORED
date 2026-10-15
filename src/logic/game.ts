import type { Cost, FileItem, GameState, SceneId, ShareScope } from '../types';
import {
  AI_SHORTFALL_PER_SLACK, INITIAL,
  EV1_TASKS, EV1_SCOPE, type Ev1Mode, type Ev1Scope,
  EV2_METHODS, EV2_INPUT, EV2_TIMING, EV2_VERIFY, EV2_REWORK, EV2_FIX, EV2_LINKFIX, EV2_COLLECT,
  type Ev2Method, type Ev2Input, type Ev2Timing, type Ev2Verify, type Ev2Collect,
  EV3_LEVEL, EV3_STORAGE, EV3_PII, EV3_KEY, EV3_SCOPE, type Ev3Level, type Ev3Storage, type Ev3Pii, type Ev3Key,
  REPORT, REPORT_CORRECTION, type ReportChoice,
} from '../data/options';
import { FOLLOWUPS, FOLLOWUP_BY_ID } from '../data/followups';

export const SCENE_ORDER: SceneId[] = ['intro', 'ev1', 'ev2', 'ev3', 'after', 'report', 'ending'];
export const SCENE_LABEL: Record<SceneId, string> = {
  title: '시작', intro: '도입', ev1: '사건 ①', ev2: '사건 ②', ev3: '사건 ③', after: '누적 결과', report: '최종 승인', ending: '회고',
};

export function newState(audioMode: 'voice' | 'subtitle' = 'voice'): GameState {
  return {
    version: 1, scene: 'intro', audioMode,
    slack: INITIAL.slack, ai: INITIAL.ai, overtime: 0, aiShortfall: 0,
    decisions: {}, flags: {}, files: [], opened: [], log: [], followups: [], lastLines: {}, clock: 0,
  };
}

export const add = (a: Cost, b: Cost): Cost => ({ slack: a.slack + b.slack, ai: a.ai + b.ai });
export const ZERO: Cost = { slack: 0, ai: 0 };

/**
 * 비용 차감. 진행 불능을 막기 위해
 * - 이용권이 모자라면 남은 만큼만 쓰고, 모자란 분량은 사람이 직접 처리(작업 여유)로 바꾼다.
 * - 작업 여유가 모자라면 0에서 멈추고 초과분을 '일정 초과'로 기록한다.
 * 음수 slack 은 여유를 되돌려 받는다.
 */
export function spend(s: GameState, cost: Cost): { slack: number; ai: number; note?: string } {
  let slack = cost.slack;
  let ai = cost.ai;
  let note: string | undefined;
  if (ai > s.ai) {
    const short = ai - s.ai;
    const extra = Math.ceil(short / AI_SHORTFALL_PER_SLACK);
    s.aiShortfall += short;
    ai = s.ai;
    slack += extra;
    note = `이용권 부족분 ${short}점은 사람이 직접 처리 (작업 여유 +${extra})`;
  }
  s.ai -= ai;
  if (slack > 0 && slack > s.slack) {
    const over = slack - s.slack;
    s.overtime += over;
    note = (note ? note + ' · ' : '') + `작업 여유 초과 ${over}칸 (일정 지연으로 기록)`;
    s.slack = 0;
  } else {
    s.slack -= slack;
  }
  return { slack, ai, note };
}

/** 같은 결정은 한 번만 기록·차감된다(중복 클릭 방지). 이미 결정됐으면 false */
export function decide(s: GameState, decision: string, option: string, label: string, cost: Cost, note?: string): boolean {
  if (s.decisions[decision] !== undefined) return false;
  s.decisions[decision] = option;
  const paid = spend(s, cost);
  s.log.push({ scene: s.scene, decision, option, label, slack: paid.slack, ai: paid.ai, note: [note, paid.note].filter(Boolean).join(' · ') || undefined });
  return true;
}

/** 결정과 별개로 생기는 비용(재작업·수정 등) */
export function charge(s: GameState, key: string, label: string, cost: Cost) {
  const k = `cost:${key}`;
  if (s.decisions[k] !== undefined) return;
  s.decisions[k] = 'paid';
  const paid = spend(s, cost);
  s.log.push({ scene: s.scene, decision: k, option: 'paid', label, slack: paid.slack, ai: paid.ai, note: paid.note });
}

export function upsertFile(s: GameState, f: Omit<FileItem, 'createdAt'> & { createdAt?: number }) {
  const i = s.files.findIndex((x) => x.id === f.id);
  const item: FileItem = { createdAt: f.createdAt ?? ++s.clock, ...f } as FileItem;
  if (i >= 0) s.files[i] = { ...s.files[i], ...item, createdAt: s.files[i].createdAt };
  else s.files.push(item);
}

export function setScene(s: GameState, scene: SceneId) {
  s.scene = scene;
}

export function markOpened(s: GameState, fileId: string) {
  if (!s.opened.includes(fileId)) s.opened.push(fileId);
}

// ── 사건 ① ─────────────────────────────────────────────
export function ev1Preview(a: Ev1Mode | null, b: Ev1Mode | null, scope: Ev1Scope): Cost {
  let c = ZERO;
  if (a) c = add(c, EV1_TASKS.A.options[a].cost);
  if (b) c = add(c, EV1_TASKS.B.options[b].cost);
  const aiTasks = (a && a !== 'human' ? 1 : 0) + (b && b !== 'human' ? 1 : 0);
  if (aiTasks > 0) {
    const sc = EV1_SCOPE[scope];
    c = add(c, { slack: sc.extra.slack, ai: sc.perAiTask.ai * aiTasks });
  }
  return c;
}

export function commitEv1(s: GameState, a: Ev1Mode, b: Ev1Mode, scope: Ev1Scope): string[] {
  if (s.decisions.ev1_A) return [];
  const aiTasks = (a !== 'human' ? 1 : 0) + (b !== 'human' ? 1 : 0);
  decide(s, 'ev1_A', a, `업무 A: ${EV1_TASKS.A.options[a].label}`, EV1_TASKS.A.options[a].cost);
  decide(s, 'ev1_B', b, `업무 B: ${EV1_TASKS.B.options[b].label}`, EV1_TASKS.B.options[b].cost);
  if (aiTasks > 0) {
    const sc = EV1_SCOPE[scope];
    decide(s, 'ev1_scope', scope, `전달 자료: ${sc.label}`, { slack: sc.extra.slack, ai: sc.perAiTask.ai * aiTasks });
  }

  upsertFile(s, {
    id: 'f_notice', name: '신입사원_안내문_v2.docx', kind: 'doc', owner: 'yunjin', location: 'mine',
    review: a === 'full' ? '전체 재검토 후 사람 확인' : '사람 확인 완료',
    reusable: false, reuseNote: '아직 공유 정리 전',
  });
  upsertFile(s, {
    id: 'f_analysis', name: '자유응답_분석표.xlsx', kind: 'sheet', owner: 'yunjin', location: 'mine',
    review: b === 'human' ? '수작업 분류 (사람 확인)' : b === 'draft' ? 'AI 분류 초안 + 원문 표본 확인' : 'AI 분류 (원문 미확인)',
    reusable: false, reuseNote: '아직 공유 정리 전',
  });

  const lines: string[] = [];
  lines.push(a === 'human' ? 'ev1_res_a_human' : a === 'draft' ? 'ev1_res_a_draft' : 'ev1_res_a_full');
  if (a === 'full') lines.push('ev1_res_a_full_2');
  lines.push(b === 'human' ? 'ev1_res_b_human' : b === 'draft' ? 'ev1_res_b_draft' : 'ev1_res_b_full');
  if (b === 'draft') lines.push('ev1_res_b_draft_2');
  if (b === 'full') lines.push('ev1_res_b_full_2');
  if (aiTasks > 0) lines.push(scope === 'all' ? 'ev1_res_scope_all' : 'ev1_res_scope_rel');
  lines.push('ev1_res_heoin');
  s.lastLines.ev1 = lines;
  return lines;
}

// ── 사건 ② ─────────────────────────────────────────────
export function commitEv2Method(s: GameState, m: Ev2Method): string[] {
  if (s.decisions.ev2_method) return [];
  const opt = EV2_METHODS[m];
  decide(s, 'ev2_method', m, `일하는 방식: ${opt.tag}. ${opt.label}`, opt.cost);
  if (m === 'prd') {
    upsertFile(s, { id: 'f_prd', name: '안내도구_미니PRD.md', kind: 'record', owner: 'yunjin', location: 'mine', review: '희연 요구사항 검토', reusable: false, reuseNote: '아직 공유 정리 전' });
  } else if (m === 'quick') {
    upsertFile(s, { id: 'f_req', name: '안내도구_요청기록.txt', kind: 'record', owner: 'yunjin', location: 'mine', review: '요청 1줄 (요구사항 없음)', reusable: false, reuseNote: '아직 공유 정리 전' });
  } else {
    upsertFile(s, { id: 'f_reuse', name: '기존도구_재사용기록.txt', kind: 'record', owner: 'yunjin', location: 'mine', review: '종윤 제공 · 작년 승인본', reusable: false, reuseNote: '아직 공유 정리 전' });
  }
  upsertFile(s, {
    id: 'f_tool', name: '첫날_안내도구.html', kind: 'html', owner: 'yunjin', location: 'mine', review: '데모 버전 · 검증 전',
    reusable: false, reuseNote: '아직 공유 정리 전', status: m === 'quick' ? 'AI가 "자동 취합 완료" 버튼을 만듦 (실제 저장 경로 없음)' : '응답 저장 방식 미정',
  });
  const lines = m === 'quick' ? ['ev2_m_quick', 'ev2_m_quick_2'] : m === 'prd' ? ['ev2_m_prd', 'ev2_m_prd_2'] : ['ev2_m_reuse', 'ev2_m_reuse_2'];
  s.lastLines.ev2m = lines;
  return lines;
}

export interface FlowResult {
  lines: string[];
  nodes: { id: string; label: string; state: 'ok' | 'warn' | 'fix' | 'skip'; text: string }[];
}

export function ev2FlowPreview(input: Ev2Input, timing: Ev2Timing, verify: Ev2Verify): Cost {
  return add(add(EV2_INPUT[input].cost, EV2_TIMING[timing].cost), EV2_VERIFY[verify].cost);
}

export function commitEv2Flow(s: GameState, input: Ev2Input, timing: Ev2Timing, verify: Ev2Verify): FlowResult {
  const res: FlowResult = { lines: [], nodes: [] };
  if (s.decisions.ev2_input || !s.decisions.ev2_method) return res;
  const m = s.decisions.ev2_method as Ev2Method;
  decide(s, 'ev2_input', input, `자료 확보: ${EV2_INPUT[input].label}`, EV2_INPUT[input].cost);
  decide(s, 'ev2_timing', timing, `작성 시점: ${EV2_TIMING[timing].label}`, EV2_TIMING[timing].cost);
  decide(s, 'ev2_verify', verify, `검증: ${EV2_VERIFY[verify].label}`, EV2_VERIFY[verify].cost);

  const hasNotice = input === 'notice';
  const heeyeon = verify === 'ai_heeyeon';
  const verifyAi = verify !== 'none';

  res.nodes.push({ id: 'src', label: '자료 확보', state: hasNotice ? 'ok' : 'warn', text: hasNotice ? '기존 자료 + 올해 공지' : '작년 자료만 (올해 공지 없음)' });
  res.nodes.push({
    id: 'diff', label: '변경사항 분석 AI', state: hasNotice ? 'ok' : 'warn',
    text: hasNotice ? '출입 절차 변경 1건 발견' : '비교할 최신 자료가 없어 "변경 없음"으로 판단',
  });
  if (hasNotice) res.lines.push('ev2_f_notice');

  // 병렬 작성: 변경이 있으면 재작업
  if (timing === 'parallel' && hasNotice) {
    charge(s, 'ev2_rework', '재작업: 변경 분석 전에 작성된 출입 절차 부분', EV2_REWORK);
    res.nodes.push({ id: 'write', label: '작성/코딩 AI', state: 'fix', text: '분석 전에 작성 → 출입 절차 부분 재작업' });
    res.lines.push('ev2_f_rework');
  } else {
    res.nodes.push({ id: 'write', label: '작성/코딩 AI', state: 'ok', text: timing === 'parallel' ? '병렬 작성 (분석 결과에 변경 없음)' : '분석 결과를 받아 작성' });
  }

  // 오래된 출입 절차: 최신 공지가 없으면 남는다. 희연의 요구사항 확인만 잡아낸다.
  let stale = !hasNotice;
  // 요구사항 누락(담당자 수정 가능): 즉시 제작 방식에서 생긴다. 요구사항 목록과 대조하는 사람만 잡아낸다.
  let missingReq = m === 'quick';
  const vtexts: string[] = [];
  if (heeyeon && missingReq) {
    charge(s, 'ev2_fix_req', '수정: 담당자 수정 가능 조건 반영', EV2_FIX);
    missingReq = false;
    res.lines.push('ev2_f_req_caught');
    vtexts.push('희연: 수정 가능 조건 누락 → 반영');
  }
  if (heeyeon && stale) {
    charge(s, 'ev2_fix_stale', '수정: 올해 출입 절차 확인 후 반영', EV2_FIX);
    stale = false;
    res.lines.push('ev2_f_stale_caught');
    vtexts.push('희연: 작년 출입 절차 → 올해 기준으로 수정');
  }
  if (verifyAi) {
    charge(s, 'ev2_linkfix', '수정: 깨진 링크', EV2_LINKFIX);
    res.lines.push('ev2_f_verify_ai');
    vtexts.unshift('검증 AI: 깨진 링크 1건 수정');
    if (stale) vtexts.push('검증 AI: 입력 자료끼리는 일치 → 통과 (작년 절차인지 모름)');
  } else {
    res.lines.push('ev2_f_no_verify');
  }
  res.nodes.push({
    id: 'verify', label: heeyeon ? '검증 AI + 희연 확인' : verifyAi ? '검증 AI' : '검증 (생략)',
    state: verify === 'none' ? 'skip' : stale ? 'warn' : vtexts.length ? 'fix' : 'ok',
    text: verify === 'none' ? '검증 없이 통과' : vtexts.join(' / '),
  });
  res.nodes.push({ id: 'approve', label: '사람의 최종 승인', state: 'ok', text: '윤진 → 홍팀장 (최종 확인 책임은 사람)' });

  s.flags.stale_html = stale;
  s.flags.missing_req = missingReq;
  s.flags.link_bug = !verifyAi;
  s.flags.review_flow = heeyeon || (hasNotice && verifyAi);

  const review = verify === 'none' ? '검증 없음 · 승인 대기' : heeyeon ? '검증 AI + 요구사항 확인 · 승인 대기' : '검증 AI 통과 · 승인 대기';
  upsertFile(s, { id: 'f_tool', name: '첫날_안내도구.html', kind: 'html', owner: 'yunjin', location: 'mine', review, reusable: false, reuseNote: '아직 공유 정리 전', status: s.files.find((f) => f.id === 'f_tool')?.status });
  upsertFile(s, { id: 'f_review', name: '안내도구_검토기록.txt', kind: 'record', owner: 'yunjin', location: 'mine', review: '기록', reusable: false, reuseNote: '아직 공유 정리 전' });
  s.lastLines.ev2f = res.lines;
  return res;
}

export function commitEv2Collect(s: GameState, c: Ev2Collect): string[] {
  if (s.decisions.ev2_collect || !s.decisions.ev2_input) return [];
  const opt = EV2_COLLECT[c];
  decide(s, 'ev2_collect', c, `응답 수집: ${opt.label}`, opt.cost);
  const tool = s.files.find((f) => f.id === 'f_tool');
  if (tool) tool.status = opt.status;
  if (c === 'request') {
    upsertFile(s, { id: 'f_api', name: '사내API_DB_연계_지원요청.txt', kind: 'record', owner: 'yunjin', location: 'mine', review: '요청 중 (승인·연결 전)', reusable: false, reuseNote: '아직 공유 정리 전', status: '요청 중' });
  }
  const lines = [c === 'survey' ? 'ev2_c_survey' : c === 'request' ? 'ev2_c_request' : 'ev2_c_exclude'];
  s.lastLines.ev2c = lines;
  return lines;
}

// ── 사건 ③ ─────────────────────────────────────────────
export const EV3_VERSIONS = [
  { id: 'v1', name: '안내자료_최종.docx', owner: 'jongyun' as const, time: '10/05 14:20', review: '사람 확인 (작년 기준)', change: '첫 초안. 출입 절차는 작년 기준.' },
  { id: 'v2', name: '안내자료_최종2.docx', owner: 'heoin' as const, time: '10/08 18:02 업로드', review: '미검토', change: '허인이 다시 올린 파일. 내용은 "최종"과 같음(수정 전 파일).' },
  { id: 'v3', name: '안내자료_수정본.docx', owner: 'heeyeon' as const, time: '10/08 16:40 작성', review: '희연 확인 완료', change: '올해 출입 절차·장소 변경 반영.' },
];

export function commitEv3Version(s: GameState, v: string): string[] {
  if (s.decisions.ev3_version) return [];
  const f = EV3_VERSIONS.find((x) => x.id === v)!;
  const openedAny = EV3_VERSIONS.some((x) => s.opened.includes(x.id));
  decide(s, 'ev3_version', v, `기준본: ${f.name}${openedAny ? '' : ' (파일을 열어보지 않고 선택)'}`, ZERO);
  s.flags.version_checked = openedAny;
  const lines = v === 'v3' ? [openedAny ? 'ev3_v_right' : 'ev3_v_right_lucky'] : ['ev3_v_other'];
  s.lastLines.ev3v = lines;
  return lines;
}

export function commitEv3Level(s: GameState, l: Ev3Level): string[] {
  if (s.decisions.ev3_level) return [];
  decide(s, 'ev3_level', l, `정리 수준: ${EV3_LEVEL[l].label}`, EV3_LEVEL[l].cost);
  const lines = [`ev3_l_${l}`];
  s.lastLines.ev3l = lines;
  return lines;
}

export function commitEv3Share(s: GameState, storage: Ev3Storage, scope: ShareScope): string[] {
  if (s.decisions.ev3_storage) return [];
  decide(s, 'ev3_storage', storage, `저장 위치: ${EV3_STORAGE[storage].label}${storage === 'shared' ? ` · 열람 범위 ${EV3_SCOPE[scope].label}` : ''}`, ZERO);
  if (storage === 'shared') s.decisions.ev3_scope = scope;
  const lines = [storage === 'mine' ? 'ev3_s_mine' : 'ev3_s_shared'];
  s.lastLines.ev3s = lines;
  return lines;
}

export function commitEv3Pii(s: GameState, p: Ev3Pii): string[] {
  if (s.decisions.ev3_pii) return [];
  decide(s, 'ev3_pii', p, `운영 명단: ${EV3_PII[p].label}`, EV3_PII[p].cost);
  const lines = [p === 'clean' ? 'ev3_p_clean' : p === 'team' ? 'ev3_p_team' : 'ev3_p_company'];
  s.lastLines.ev3p = lines;
  return lines;
}

export const needsKeyDecision = (s: GameState) => s.decisions.ev3_level === '3';

export function commitEv3Key(s: GameState, k: Ev3Key): string[] {
  if (s.decisions.ev3_key || !needsKeyDecision(s)) return [];
  decide(s, 'ev3_key', k, `프롬프트 메모의 키 문자열: ${EV3_KEY[k].label}`, EV3_KEY[k].cost);
  const lines = [k === 'remove' ? 'ev3_k_remove' : 'ev3_k_keep'];
  s.lastLines.ev3k = lines;
  return lines;
}

export function ev3Complete(s: GameState): boolean {
  const base = !!(s.decisions.ev3_version && s.decisions.ev3_level && s.decisions.ev3_storage && s.decisions.ev3_pii);
  return base && (!needsKeyDecision(s) || !!s.decisions.ev3_key);
}

/** 사건 ③ 선택을 파일함 상태에 반영 */
export function applyEv3ToFiles(s: GameState) {
  if (!ev3Complete(s)) return;
  const shared = s.decisions.ev3_storage === 'shared';
  const scope = (s.decisions.ev3_scope as ShareScope) || 'team';
  const level = s.decisions.ev3_level as Ev3Level;
  const stale = s.decisions.ev3_version !== 'v3';
  const mine = s.files.filter((f) => f.owner === 'yunjin');
  for (const f of mine) {
    f.location = shared ? 'shared' : 'mine';
    f.scope = shared ? scope : undefined;
    f.reusable = shared && level !== '1';
    f.reuseNote = !shared ? '개인 작업함에만 있음 (다른 사람은 찾을 수 없음)'
      : level === '1' ? '사용법·검토 상태 없음 (열 수는 있지만 이어받기 어려움)'
      : level === '2' ? '사용법·담당자·검토 상태 포함'
      : '사용법 + 재사용 프롬프트·요구사항·변경 이유 포함';
  }
  upsertFile(s, {
    id: 'f_guide_base', name: EV3_VERSIONS.find((v) => v.id === s.decisions.ev3_version)!.name, kind: 'doc', owner: 'yunjin',
    location: shared ? 'shared' : 'mine', scope: shared ? scope : undefined,
    review: stale ? '기준본 (검토 기록 미확인)' : '기준본 · 희연 확인 완료', reusable: shared && level !== '1',
    reuseNote: stale ? '작년 출입 절차가 들어 있음' : '올해 기준 반영',
  });
  if (level !== '1') {
    upsertFile(s, { id: 'f_readme', name: '사용법_README.md', kind: 'guide', owner: 'yunjin', location: shared ? 'shared' : 'mine', scope: shared ? scope : undefined, review: '사람 확인', reusable: shared, reuseNote: '목적·사용법·담당자·검토 상태·버전' });
  }
  if (level === '3') {
    upsertFile(s, {
      id: 'f_promptpack', name: '재사용_프롬프트·요구사항.md', kind: 'prompt', owner: 'yunjin', location: shared ? 'shared' : 'mine', scope: shared ? scope : undefined,
      review: s.decisions.ev3_key === 'keep' ? '키 문자열 포함 (위험)' : '키 문자열 제거됨', reusable: shared,
      reuseNote: s.decisions.ev2_method === 'quick' ? '프롬프트는 있으나 근거 자료(요구사항) 없음' : '프롬프트 + 요구사항 + 변경 이유',
    });
  }
  const pii = s.decisions.ev3_pii as Ev3Pii;
  upsertFile(s, {
    id: 'f_roster', name: pii === 'clean' ? '운영명단_정리본.xlsx' : '운영명단_원본.xlsx', kind: 'sheet', owner: 'yunjin',
    location: 'shared', scope: pii === 'company' ? 'company' : pii === 'team' ? 'team' : 'edu',
    review: pii === 'clean' ? '불필요 정보 제거 · 운영 담당 2명만 열람' : pii === 'team' ? '원본 (연락처 포함) · 교육팀 전체 열람' : '원본 (연락처 포함) · 전사 공개',
    reusable: pii === 'clean', reuseNote: pii === 'clean' ? '운영에 필요한 정보만' : '개인정보 포함',
    status: pii === 'company' ? '과도한 공유' : undefined,
  });
}

// ── 누적 결과 ───────────────────────────────────────────
export function selectFollowups(s: GameState): string[] {
  if (s.followups.length) return s.followups;
  const neg = FOLLOWUPS.filter((f) => !f.positive && f.when(s)).sort((a, b) => a.priority - b.priority);
  const pos = FOLLOWUPS.filter((f) => f.positive && f.when(s)).sort((a, b) => a.priority - b.priority);
  const mandatory = neg.filter((f) => f.id === 'fu_pii' || f.id === 'fu_key');
  let picked: string[];
  if (mandatory.length >= 2) picked = mandatory.slice(0, 2).map((f) => f.id);
  else if (neg.length && pos.length) picked = [neg[0].id, pos[0].id];
  else if (neg.length) picked = neg.slice(0, 2).map((f) => f.id);
  else picked = pos.slice(0, 2).map((f) => f.id);
  s.followups = picked;
  return picked;
}

/** 후속 사건이 처리됐는지 */
export function followupDone(s: GameState, id: string): boolean {
  const f = FOLLOWUP_BY_ID[id];
  if (f.kind === 'steps') return f.options.every((o) => s.decisions[`${id}:${o.id}`] !== undefined);
  return s.decisions[id] !== undefined;
}

export function resolveFollowup(s: GameState, id: string, optionId: string): string[] {
  const f = FOLLOWUP_BY_ID[id];
  if (!f || !s.followups.includes(id)) return [];
  const o = f.options.find((x) => x.id === optionId);
  if (!o) return [];
  const key = f.kind === 'steps' ? `${id}:${o.id}` : id;
  const ok = decide(s, key, o.id, `${f.title}: ${o.label}`, o.cost);
  if (!ok) return [];
  if (o.flag) s.flags[o.flag] = true;
  applyFollowupToFiles(s, id, o.id);
  const lines = [...o.lines];
  if (f.kind === 'steps' && followupDone(s, id) && f.doneLines) lines.push(...f.doneLines);
  return lines;
}

function applyFollowupToFiles(s: GameState, id: string, opt: string) {
  const file = (fid: string) => s.files.find((f) => f.id === fid);
  if (id === 'fu_pii' && opt === 'restrict') { const r = file('f_roster'); if (r) { r.scope = 'edu'; r.status = '접근 제한됨'; } }
  if (id === 'fu_pii' && opt === 'replace') { const r = file('f_roster'); if (r) { r.name = '운영명단_정리본.xlsx'; r.review = '불필요 정보 제거 (사고 후 교체)'; } }
  if (id === 'fu_pii' && opt === 'report') { const r = file('f_roster'); if (r) r.status = '정보보호 담당 보고 완료'; }
  if (id === 'fu_key') { const p = file('f_promptpack'); if (p) p.review = '키 문자열 제거 · 폐기 요청 완료'; }
  if (id === 'fu_stale') {
    const g = file('f_guide_base');
    if (g) { g.review = opt === 'fix' ? '올해 공지 기준 수정 완료' : '정오표 공지 (원본 교체 예정)'; g.reuseNote = opt === 'fix' ? '올해 기준 반영' : '원본에 작년 절차 남아 있음'; }
    if (opt === 'fix') s.flags.stale_html = false;
  }
  if (id === 'fu_unverified' && opt === 'check') { const a = file('f_analysis'); if (a) a.review = 'AI 분류 + 사후 표본 확인'; }
  if (id === 'fu_dup' && opt === 'merge') for (const f of s.files.filter((x) => x.owner === 'yunjin' && x.id !== 'f_roster')) { f.location = 'shared'; f.scope = 'team'; f.reuseNote = '병합 후 공유함 이동 (사용법 여부는 정리 수준에 따름)'; }
  if (id === 'fu_usage' && opt === 'write') {
    upsertFile(s, { id: 'f_readme', name: '사용법_README.md', kind: 'guide', owner: 'yunjin', location: s.decisions.ev3_storage === 'shared' ? 'shared' : 'mine', scope: (s.decisions.ev3_scope as ShareScope) || undefined, review: '사후 작성 · 사람 확인', reusable: true, reuseNote: '사용법·실행 조건' });
  }
  if (id === 'fu_edit' && opt === 'rebuild') { const t = file('f_tool'); if (t) t.reuseNote = '문구 표 파일 분리 · 담당자 수정 가능'; s.flags.missing_req = false; }
  if (id === 'fu_prompt' && opt === 'fix') { const p = file('f_promptpack'); if (p) p.reuseNote = '프롬프트 + 근거 자료 첨부'; }
}

export function afterComplete(s: GameState): boolean {
  return s.followups.length > 0 && s.followups.every((id) => followupDone(s, id));
}

// ── 최종 보고 ───────────────────────────────────────────
export interface Deliverable { name: string; status: string; kind: 'done' | 'proto' | 'pending' | 'issue' | 'excluded' }

export function deliverables(s: GameState): Deliverable[] {
  const d = s.decisions;
  const out: Deliverable[] = [];
  out.push({ name: '수정 안내문', status: d.ev1_A === 'full' ? '완료 (전체 재검토 후)' : '완료', kind: 'done' });
  const unverified = d.ev1_B === 'full' && d.fu_unverified !== 'check';
  out.push({ name: '자유응답 분석표', status: unverified ? '완료했으나 원문 미확인' : '완료 (원문 확인)', kind: unverified ? 'issue' : 'done' });
  const toolIssues: string[] = [];
  if (s.flags.stale_html) toolIssues.push('작년 출입 절차');
  if (s.flags.missing_req) toolIssues.push('담당자 수정 불가');
  if (s.flags.link_bug) toolIssues.push('깨진 링크');
  out.push({ name: 'HTML 첫날 안내 도구', status: `데모 버전${toolIssues.length ? ` · 남은 문제: ${toolIssues.join(', ')}` : ' · 확인된 문제 없음'}`, kind: toolIssues.length ? 'issue' : 'proto' });
  const c = d.ev2_collect as Ev2Collect | undefined;
  if (c) out.push({ name: '의견 수집', status: EV2_COLLECT[c].status, kind: c === 'survey' ? 'done' : c === 'request' ? 'pending' : 'excluded' });
  const base = s.files.find((f) => f.id === 'f_guide_base');
  if (base) out.push({ name: '안내자료 기준본', status: base.review, kind: base.reuseNote.includes('작년') ? 'issue' : 'done' });
  const lvl = d.ev3_level;
  out.push({ name: '공유 정리', status: `${d.ev3_storage === 'shared' ? '공유함' : '개인 작업함'} · 정리 수준 ${lvl}`, kind: 'done' });
  return out;
}

export function commitReport(s: GameState, r: ReportChoice): string[] {
  if (s.decisions.ev_report) return [];
  decide(s, 'ev_report', r, `최종 보고: ${REPORT[r].label}`, REPORT[r].cost);
  if (r === 'over') {
    charge(s, 'report_fix', '정정: 상태를 다시 구분해 보고', REPORT_CORRECTION);
    s.flags.overclaim = true;
    return ['rp_over', 'rp_over_fix'];
  }
  return ['rp_honest'];
}

export function usage(s: GameState) {
  return { slack: INITIAL.slack - s.slack + s.overtime, ai: INITIAL.ai - s.ai };
}
