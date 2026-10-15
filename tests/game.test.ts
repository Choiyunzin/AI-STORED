import { describe, expect, it } from 'vitest';
import {
  newState, commitEv1, commitEv2Method, commitEv2Flow, commitEv2Collect,
  commitEv3Version, commitEv3Level, commitEv3Share, commitEv3Pii, commitEv3Key, ev3Complete, applyEv3ToFiles,
  selectFollowups, resolveFollowup, followupDone, afterComplete, commitReport, deliverables, usage, needsKeyDecision, setScene,
} from '../src/logic/game';
import { FOLLOWUP_BY_ID } from '../src/data/followups';
import { buildRetro, RETRO_RULES } from '../src/data/retro';
import dialogue from '../src/data/dialogue.json';
import type { GameState } from '../src/types';

const LINE_IDS = new Set((dialogue as { id: string }[]).map((l) => l.id));
const ev1Modes = ['human', 'draft', 'full'] as const;

interface Path {
  a: (typeof ev1Modes)[number]; b: (typeof ev1Modes)[number]; scope: 'related' | 'all';
  method: 'quick' | 'prd' | 'reuse'; input: 'old' | 'notice'; timing: 'sequential' | 'parallel'; verify: 'none' | 'ai' | 'ai_heeyeon';
  collect: 'survey' | 'request' | 'exclude';
  openFiles: boolean; version: 'v1' | 'v2' | 'v3'; level: '1' | '2' | '3';
  storage: 'mine' | 'shared'; scopeShare: 'team' | 'edu' | 'company'; pii: 'team' | 'clean' | 'company'; key: 'remove' | 'keep';
  fuPick: number; report: 'honest' | 'over';
}

function play(p: Path): { s: GameState; lines: string[] } {
  const s = newState('subtitle');
  const lines: string[] = [];
  setScene(s, 'ev1');
  lines.push(...commitEv1(s, p.a, p.b, p.scope));
  setScene(s, 'ev2');
  lines.push(...commitEv2Method(s, p.method));
  lines.push(...commitEv2Flow(s, p.input, p.timing, p.verify).lines);
  lines.push(...commitEv2Collect(s, p.collect));
  setScene(s, 'ev3');
  if (p.openFiles) s.opened.push('v1', 'v2', 'v3');
  lines.push(...commitEv3Version(s, p.version));
  lines.push(...commitEv3Level(s, p.level));
  lines.push(...commitEv3Share(s, p.storage, p.scopeShare));
  lines.push(...commitEv3Pii(s, p.pii));
  if (needsKeyDecision(s)) lines.push(...commitEv3Key(s, p.key));
  expect(ev3Complete(s)).toBe(true);
  applyEv3ToFiles(s);
  setScene(s, 'after');
  const fus = selectFollowups(s);
  for (const id of fus) {
    const f = FOLLOWUP_BY_ID[id];
    lines.push(...f.intro);
    if (f.kind === 'steps') for (const o of f.options) lines.push(...resolveFollowup(s, id, o.id));
    else lines.push(...resolveFollowup(s, id, f.options[p.fuPick % f.options.length].id));
    expect(followupDone(s, id)).toBe(true);
  }
  expect(afterComplete(s)).toBe(true);
  setScene(s, 'report');
  lines.push(...commitReport(s, p.report));
  return { s, lines };
}

function* allPaths(): Generator<Path> {
  // 전 조합은 너무 많으므로, 사건별 전 조합 × 다른 사건 대표값 + 무작위 표본을 돈다
  const base: Path = { a: 'human', b: 'draft', scope: 'related', method: 'prd', input: 'notice', timing: 'sequential', verify: 'ai_heeyeon', collect: 'survey', openFiles: true, version: 'v3', level: '2', storage: 'shared', scopeShare: 'team', pii: 'clean', key: 'remove', fuPick: 0, report: 'honest' };
  for (const a of ev1Modes) for (const b of ev1Modes) for (const scope of ['related', 'all'] as const) yield { ...base, a, b, scope };
  for (const method of ['quick', 'prd', 'reuse'] as const) for (const input of ['old', 'notice'] as const) for (const timing of ['sequential', 'parallel'] as const)
    for (const verify of ['none', 'ai', 'ai_heeyeon'] as const) for (const collect of ['survey', 'request', 'exclude'] as const) yield { ...base, method, input, timing, verify, collect };
  for (const openFiles of [true, false]) for (const version of ['v1', 'v2', 'v3'] as const) for (const level of ['1', '2', '3'] as const)
    for (const storage of ['mine', 'shared'] as const) for (const pii of ['team', 'clean', 'company'] as const) for (const key of ['remove', 'keep'] as const)
      for (const fuPick of [0, 1]) for (const report of ['honest', 'over'] as const) yield { ...base, openFiles, version, level, storage, pii, key, fuPick, report };
  // AI를 과도하게 쓴 경로
  yield { ...base, a: 'full', b: 'draft', scope: 'all', level: '3', timing: 'parallel' };
  yield { ...base, a: 'full', b: 'draft', scope: 'all', level: '3', timing: 'parallel', fuPick: 1 };
  yield { ...base, method: 'quick', level: '3' };
  yield { ...base, method: 'quick', level: '3', fuPick: 1 };
  // 무작위 전체 경로
  let seed = 7;
  const rnd = <T,>(xs: readonly T[]) => { seed = (seed * 1103515245 + 12345) % 2147483648; return xs[seed % xs.length]; };
  for (let i = 0; i < 4000; i++) {
    yield {
      a: rnd(ev1Modes), b: rnd(ev1Modes), scope: rnd(['related', 'all'] as const), method: rnd(['quick', 'prd', 'reuse'] as const),
      input: rnd(['old', 'notice'] as const), timing: rnd(['sequential', 'parallel'] as const), verify: rnd(['none', 'ai', 'ai_heeyeon'] as const),
      collect: rnd(['survey', 'request', 'exclude'] as const), openFiles: rnd([true, false]), version: rnd(['v1', 'v2', 'v3'] as const),
      level: rnd(['1', '2', '3'] as const), storage: rnd(['mine', 'shared'] as const), scopeShare: rnd(['team', 'edu', 'company'] as const),
      pii: rnd(['team', 'clean', 'company'] as const), key: rnd(['remove', 'keep'] as const), fuPick: rnd([0, 1]), report: rnd(['honest', 'over'] as const),
    };
  }
}

describe('전체 경로', () => {
  it('모든 경로가 진행 불능 없이 끝나고 불변식을 지킨다', () => {
    let n = 0;
    const seenFollowups = new Set<string>();
    const seenRules = new Set<string>();
    for (const p of allPaths()) {
      const { s, lines } = play(p);
      n++;
      for (const id of lines) expect(LINE_IDS.has(id), `대사 ID 누락: ${id}`).toBe(true);
      expect(s.ai).toBeGreaterThanOrEqual(0);
      expect(s.slack).toBeGreaterThanOrEqual(0);
      expect(s.followups.length).toBeGreaterThanOrEqual(1);
      expect(s.followups.length).toBeLessThanOrEqual(2);
      s.followups.forEach((f) => seenFollowups.add(f));
      // 로그의 비용 합 = 실제 자원 변화
      const sumAi = s.log.reduce((t, l) => t + l.ai, 0);
      expect(sumAi).toBe(100 - s.ai);
      const sumSlack = s.log.reduce((t, l) => t + l.slack, 0);
      expect(sumSlack).toBe(18 - s.slack + s.overtime);
      // 회고: 잘한 행동 2개, 바꿔볼 행동 0~2개, 실제로 참인 규칙만
      const r = buildRetro(s);
      expect(r.good.length).toBe(2);
      expect(r.change.length).toBeLessThanOrEqual(2);
      for (const rule of RETRO_RULES) if (rule.when(s)) seenRules.add(rule.id);
      // 미완성 기능 과장 보고는 절대 이득이 아니다: 정정 비용이 든다
      if (p.report === 'over') expect(s.log.some((l) => l.decision === 'cost:report_fix')).toBe(true);
      // 수집 기능: 화면만 있는 HTML이 '자동 취합 완료'로 남지 않는다
      const tool = s.files.find((f) => f.id === 'f_tool')!;
      expect(tool.status).not.toMatch(/자동 취합 완료/);
      if (p.collect === 'request') expect(tool.status).toMatch(/요청 중/);
      // 산출물 상태와 결정이 일치
      const dv = deliverables(s);
      expect(dv.find((x) => x.name === 'HTML 첫날 안내 도구')!.status).toMatch(/^데모 버전/);
    }
    expect(n).toBeGreaterThan(4000);
    // 모든 후속 사건과 회고 규칙이 어떤 경로에서든 한 번 이상 나온다
    for (const id of Object.keys(FOLLOWUP_BY_ID)) expect(seenFollowups.has(id), `후속 사건 미도달: ${id}`).toBe(true);
    for (const r of RETRO_RULES) expect(seenRules.has(r.id), `회고 규칙 미도달: ${r.id}`).toBe(true);
  });
});

describe('개별 규칙', () => {
  it('같은 결정을 두 번 눌러도 비용은 한 번만 차감된다', () => {
    const s = newState();
    commitEv1(s, 'human', 'draft', 'related');
    const after = { slack: s.slack, ai: s.ai };
    expect(commitEv1(s, 'full', 'full', 'all')).toEqual([]);
    expect({ slack: s.slack, ai: s.ai }).toEqual(after);
    commitEv2Method(s, 'quick');
    const a2 = s.ai;
    commitEv2Method(s, 'prd');
    expect(s.ai).toBe(a2);
    expect(s.decisions.ev2_method).toBe('quick');
  });

  it('작은 수정은 사람이, 대량 분석은 AI 초안+확인이 효율적이다', () => {
    const cost = (a: any, b: any) => { const s = newState(); commitEv1(s, a, b, 'related'); return usage(s); };
    expect(cost('human', 'draft').slack).toBeLessThanOrEqual(cost('full', 'draft').slack);
    expect(cost('human', 'draft').ai).toBeLessThan(cost('draft', 'draft').ai);
    expect(cost('human', 'draft').slack).toBeLessThan(cost('human', 'human').slack);
  });

  it('최신 공지 없이 검증 AI만 쓰면 작년 절차가 남고, 희연 확인이 잡아낸다', () => {
    const run = (verify: any) => { const s = newState(); commitEv1(s, 'human', 'draft', 'related'); commitEv2Method(s, 'prd'); commitEv2Flow(s, 'old', 'sequential', verify); return s; };
    expect(run('ai').flags.stale_html).toBe(true);
    expect(run('ai_heeyeon').flags.stale_html).toBe(false);
  });

  it('병렬 작성은 변경이 있을 때만 재작업이 생긴다', () => {
    const run = (input: any) => { const s = newState(); commitEv2Method(s, 'prd'); commitEv2Flow(s, input, 'parallel', 'ai'); return s.log.some((l) => l.decision === 'cost:ev2_rework'); };
    expect(run('notice')).toBe(true);
    expect(run('old')).toBe(false);
  });

  it('세 방식(A/B/C) 모두 보완하면 문제 없이 끝난다', () => {
    for (const m of ['quick', 'prd', 'reuse'] as const) {
      const s = newState();
      commitEv2Method(s, m);
      commitEv2Flow(s, 'notice', 'sequential', 'ai_heeyeon');
      expect(s.flags.stale_html).toBe(false);
      expect(s.flags.missing_req).toBe(false);
      expect(s.flags.link_bug).toBe(false);
    }
  });

  it('이용권이 바닥나도 사람이 대신 처리해 진행된다', () => {
    const s = newState();
    s.ai = 3;
    commitEv1(s, 'full', 'draft', 'all');
    expect(s.ai).toBe(0);
    expect(s.aiShortfall).toBeGreaterThan(0);
    expect(s.log.some((l) => l.note?.includes('사람이 직접'))).toBe(true);
  });

  it('작업 여유가 바닥나면 0에서 멈추고 초과분이 기록된다', () => {
    const s = newState();
    s.slack = 2;
    commitEv1(s, 'full', 'human', 'all');
    expect(s.slack).toBe(0);
    expect(s.overtime).toBeGreaterThan(0);
  });

  it('보안 사고 수습은 세 단계를 모두 해야 끝난다', () => {
    const s = newState();
    s.decisions.ev3_pii = 'company';
    s.followups = ['fu_pii'];
    resolveFollowup(s, 'fu_pii', 'restrict');
    expect(followupDone(s, 'fu_pii')).toBe(false);
    resolveFollowup(s, 'fu_pii', 'replace');
    const l = resolveFollowup(s, 'fu_pii', 'report');
    expect(followupDone(s, 'fu_pii')).toBe(true);
    expect(l).toContain('fu_pii_done');
  });

  it('키 결정은 정리 수준 3일 때만 필요하다', () => {
    const s = newState();
    commitEv3Version(s, 'v3'); commitEv3Level(s, '2'); commitEv3Share(s, 'shared', 'team'); commitEv3Pii(s, 'clean');
    expect(ev3Complete(s)).toBe(true);
    expect(commitEv3Key(s, 'keep')).toEqual([]);
  });

  it('회고는 선택하지 않은 일을 했다고 말하지 않는다', () => {
    const { s } = play({ a: 'full', b: 'human', scope: 'all', method: 'quick', input: 'old', timing: 'parallel', verify: 'none', collect: 'exclude', openFiles: false, version: 'v2', level: '1', storage: 'mine', scopeShare: 'team', pii: 'company', key: 'keep', fuPick: 1, report: 'over' });
    const r = buildRetro(s);
    const all = [...r.good, ...r.change].join('\n');
    expect(all).not.toMatch(/희연 매니저의 요구사항 확인을 붙여/);
    expect(all).not.toMatch(/미니 PRD/);
    expect(all).not.toMatch(/표본을 확인해/);
    expect(r.change[0]).toMatch(/전사 공개함/);
  });
});
