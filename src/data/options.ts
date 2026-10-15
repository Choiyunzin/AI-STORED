import type { Cost } from '../types';

/** 게임 균형 수치. 작업 여유 = 게임 속 업무 비용(칸), AI 이용권 = 입력 분량·생성·재작업을 나타내는 가상 단위 */
export const INITIAL = { slack: 18, ai: 100 };
/** 이용권이 모자랄 때, 모자란 분량 8점마다 사람이 직접 처리하는 작업 여유 1칸으로 대체 */
export const AI_SHORTFALL_PER_SLACK = 8;
export const AI_LOW_THRESHOLD = 30;

export interface Option {
  id: string;
  label: string;
  cost: Cost;
  /** 선택 전에 보여주는 알려진 조건 */
  note: string;
}

// ── 사건 ① ─────────────────────────────────────────────
export type Ev1Mode = 'human' | 'draft' | 'full';

export const EV1_MODES: { id: Ev1Mode; label: string; short: string }[] = [
  { id: 'human', label: '사람이 직접', short: '직접' },
  { id: 'draft', label: 'AI 초안 + 사람 확인', short: 'AI초안+확인' },
  { id: 'full', label: 'AI 전체 처리', short: 'AI전체' },
];

export const EV1_TASKS = {
  A: {
    title: '업무 A · 안내문 세 줄 수정',
    desc: '이미 검토가 끝난 안내문에서 장소·시간 세 줄만 바꾼다. 바꿀 내용이 명확하다.',
    options: {
      human: { id: 'human', label: '사람이 직접', cost: { slack: 1, ai: 0 }, note: '세 줄만 고치고 바로 확인.' },
      draft: { id: 'draft', label: 'AI 초안 + 사람 확인', cost: { slack: 1, ai: 6 }, note: '요청·확인 시간이 직접 수정과 비슷하다.' },
      full: { id: 'full', label: 'AI 전체 재작성', cost: { slack: 2, ai: 10 }, note: '검토가 끝난 문장도 다시 쓰여 전체 재검토가 필요하다.' },
    } as Record<Ev1Mode, Option>,
  },
  B: {
    title: '업무 B · 자유응답 300건 분석',
    desc: '이전 차수의 가상 자유응답 300건에서 반복 불편을 묶고 대표 근거를 찾는다.',
    options: {
      human: { id: 'human', label: '사람이 직접', cost: { slack: 6, ai: 0 }, note: '300건을 하나씩 읽고 분류. 정확하지만 오래 걸린다.' },
      draft: { id: 'draft', label: 'AI 초안 + 사람 확인', cost: { slack: 2, ai: 16 }, note: 'AI가 분류 초안을 만들고, 사람이 표본·원문으로 확인한다.' },
      full: { id: 'full', label: 'AI 분류 그대로 확정', cost: { slack: 1, ai: 12 }, note: '원문 확인 없이 확정한다. 묶음 오류가 남을 수 있다.' },
    } as Record<Ev1Mode, Option>,
  },
};

export type Ev1Scope = 'related' | 'all';
export const EV1_SCOPE: Record<Ev1Scope, { label: string; note: string; perAiTask: Cost; extra: Cost }> = {
  related: { label: '관련 자료만 전달', note: '해당 안내문 / 응답 원문만 넘긴다.', perAiTask: { slack: 0, ai: 0 }, extra: { slack: 0, ai: 0 } },
  all: { label: '전체 자료 묶음 전달', note: '지난 차수 폴더 전체를 넘긴다. 입력 분량이 늘고 걸러낼 내용이 생긴다.', perAiTask: { slack: 0, ai: 6 }, extra: { slack: 1, ai: 0 } },
};

// ── 사건 ② ─────────────────────────────────────────────
export type Ev2Method = 'quick' | 'prd' | 'reuse';
export const EV2_METHODS: Record<Ev2Method, Option & { pros: string; cons: string; tag: string }> = {
  quick: {
    id: 'quick', tag: 'A', label: '짧은 요청으로 즉시 시제품', cost: { slack: 1, ai: 12 },
    note: '한 줄 요청으로 화면부터 띄운다.', pros: '빠르게 화면을 확인하고 의견을 받을 수 있다.', cons: '조건이 빠졌는지는 나중에 확인해야 한다.',
  },
  prd: {
    id: 'prd', tag: 'B', label: '미니 PRD 4칸 정리 후 제작', cost: { slack: 2, ai: 14 },
    note: '대상·목적 / 필수 기능 / 사내 실행·저장 조건 / 완료 기준을 먼저 적는다.', pros: '복잡한 조건의 누락을 줄이고 완료 기준이 생긴다.', cons: '선행 정리 비용이 든다.',
  },
  reuse: {
    id: 'reuse', tag: 'C', label: '승인된 기존 도구부터 찾아 고치기', cost: { slack: 1, ai: 6 },
    note: '작년에 승인된 안내 도구를 찾아 필요한 부분만 바꾼다.', pros: '재사용 가치가 크고 비용이 적다.', cons: '기존 기능의 한계와 자료의 최신성을 확인해야 한다.',
  },
};

export type Ev2Input = 'old' | 'notice';
export type Ev2Timing = 'sequential' | 'parallel';
export type Ev2Verify = 'none' | 'ai' | 'ai_heeyeon';

export const EV2_INPUT: Record<Ev2Input, Option> = {
  old: { id: 'old', label: '종윤의 기존 자료만', cost: { slack: 0, ai: 0 }, note: '작년 안내자료. 추가 검색 없음.' },
  notice: { id: 'notice', label: '기존 자료 + 올해 최신 공지', cost: { slack: 0, ai: 4 }, note: '사내 공지 검색 비용(이용권 4)이 든다.' },
};
export const EV2_TIMING: Record<Ev2Timing, Option> = {
  sequential: { id: 'sequential', label: '변경 분석을 기다린 뒤 작성', cost: { slack: 1, ai: 0 }, note: '대기 시간 1칸.' },
  parallel: { id: 'parallel', label: '분석과 작성을 병렬로', cost: { slack: 0, ai: 0 }, note: '대기 없음. 분석 결과에 변경이 있으면 재작업(여유 1, 이용권 8).' },
};
export const EV2_VERIFY: Record<Ev2Verify, Option> = {
  none: { id: 'none', label: '검증 생략', cost: { slack: 0, ai: 0 }, note: '바로 승인 요청.' },
  ai: { id: 'ai', label: '검증 AI', cost: { slack: 0, ai: 6 }, note: '입력된 자료·요구사항과 결과를 비교한다. 입력에 없는 기준은 모른다.' },
  ai_heeyeon: { id: 'ai_heeyeon', label: '검증 AI + 희연 요구사항 확인', cost: { slack: 1, ai: 6 }, note: '사람이 요구사항 목록과 대조한다.' },
};
export const EV2_REWORK: Cost = { slack: 1, ai: 8 };
export const EV2_FIX: Cost = { slack: 1, ai: 4 };
export const EV2_LINKFIX: Cost = { slack: 0, ai: 2 };

export type Ev2Collect = 'survey' | 'request' | 'exclude';
export const EV2_COLLECT: Record<Ev2Collect, Option & { status: string }> = {
  survey: {
    id: 'survey', label: '승인된 기존 설문 도구와 연결', cost: { slack: 1, ai: 0 },
    note: 'HTML에는 설문 링크만 두고, 응답은 승인 설문 도구에 저장된다.', status: '승인 설문 도구에 저장 (연결 완료)',
  },
  request: {
    id: 'request', label: '사내 API/DB 연계 지원 요청', cost: { slack: 2, ai: 0 },
    note: '정보보호·IT 승인이 필요하다. 승인 전에는 저장되지 않는다.', status: '사내 API/DB 연계 요청 중 (현재 저장 안 됨)',
  },
  exclude: {
    id: 'exclude', label: '이번 시제품에서 수집 기능 제외', cost: { slack: 0, ai: 0 },
    note: '화면에 "의견 수집은 별도 설문으로"라고 명확히 표시한다.', status: '수집 기능 없음 (화면에 명시)',
  },
};

// ── 사건 ③ ─────────────────────────────────────────────
export type Ev3Level = '1' | '2' | '3';
export const EV3_LEVEL: Record<Ev3Level, Option> = {
  '1': { id: '1', label: '결과 파일만 공유', cost: { slack: 0, ai: 0 }, note: '정리 비용 없음. 사용법·검토 상태는 남지 않는다.' },
  '2': { id: '2', label: '결과 + 목적·사용법 + 담당자 + 검토 상태·버전', cost: { slack: 2, ai: 4 }, note: 'AI로 사용법 초안을 만들고 사람이 확인.' },
  '3': { id: '3', label: '② + 재사용 프롬프트·요구사항·변경 이유', cost: { slack: 3, ai: 8 }, note: '다음 차수에서 다시 만들 수 있게 근거까지 남긴다.' },
};

export type Ev3Storage = 'mine' | 'shared';
export const EV3_STORAGE: Record<Ev3Storage, Option> = {
  mine: { id: 'mine', label: '내 작업함에 보관', cost: { slack: 0, ai: 0 }, note: '나만 볼 수 있다. 요청이 오면 개별 전달.' },
  shared: { id: 'shared', label: '사내 승인 공유함 · 교육팀 폴더', cost: { slack: 0, ai: 0 }, note: '열람 범위를 함께 정한다.' },
};
export const EV3_SCOPE: Record<'team' | 'edu' | 'company', { label: string; note: string }> = {
  team: { label: '교육팀', note: '교육팀 7명' },
  edu: { label: '교육팀 + 운영 협력부서', note: '총무·출입 담당 포함' },
  company: { label: '전사 공개', note: '모든 임직원' },
};

export type Ev3Pii = 'team' | 'clean' | 'company';
export const EV3_PII: Record<Ev3Pii, Option> = {
  team: { id: 'team', label: '팀 제한 공유 (원본 그대로)', cost: { slack: 0, ai: 0 }, note: '교육팀 전원이 연락처 원본을 본다.' },
  clean: { id: 'clean', label: '불필요 정보 제거 후 운영 담당에게만 공유', cost: { slack: 1, ai: 2 }, note: '연락처는 운영 담당 2명만, 무관한 메모는 삭제.' },
  company: { id: 'company', label: '전사 공개함에 원본 공유', cost: { slack: 0, ai: 0 }, note: '찾기는 가장 쉽다. 정보 등급: 대외비(개인정보 포함).' },
};

export type Ev3Key = 'remove' | 'keep';
export const EV3_KEY: Record<Ev3Key, Option> = {
  remove: { id: 'remove', label: '키 줄 삭제 + 폐기 요청', cost: { slack: 1, ai: 0 }, note: '보안 담당에게 가상 키 폐기를 요청한다.' },
  keep: { id: 'keep', label: '그대로 공유', cost: { slack: 0, ai: 0 }, note: '정리 시간이 들지 않는다.' },
};

// ── 최종 보고 ───────────────────────────────────────────
export type ReportChoice = 'honest' | 'over';
export const REPORT: Record<ReportChoice, Option> = {
  honest: { id: 'honest', label: '완료 / 시제품 / 연계 대기를 구분해 보고', cost: { slack: 0, ai: 0 }, note: '현재 상태 그대로.' },
  over: { id: 'over', label: '“전부 완료했습니다”로 보고', cost: { slack: 0, ai: 0 }, note: '보고서가 짧아진다.' },
};
export const REPORT_CORRECTION: Cost = { slack: 1, ai: 0 };
