import type { GameState } from '../types';
import { EV2_COLLECT, type Ev2Collect } from './options';
import { EV3_VERSIONS } from '../logic/game';

/**
 * 회고 규칙. 모든 문장은 실제 선택 기록(state.decisions / flags)에서만 나온다.
 * priority 가 작을수록 먼저 보여준다.
 */
export interface RetroRule {
  id: string;
  type: 'good' | 'change';
  priority: number;
  when: (s: GameState) => boolean;
  text: (s: GameState) => string;
}

const d = (s: GameState, k: string) => s.decisions[k];
const aiUsedEv1 = (s: GameState) => d(s, 'ev1_A') !== 'human' || d(s, 'ev1_B') !== 'human';

export const RETRO_RULES: RetroRule[] = [
  // ── 잘 연결한 행동 ──
  { id: 'g_b_draft', type: 'good', priority: 1, when: (s) => d(s, 'ev1_B') === 'draft', text: () => '반복 분석은 AI 분류 초안을 쓰고 원문 표본을 확인해, 사람이 맥락을 판단할 시간을 확보했습니다.' },
  { id: 'g_heeyeon', type: 'good', priority: 2, when: (s) => d(s, 'ev2_verify') === 'ai_heeyeon', text: () => '검증 AI 뒤에 희연 매니저의 요구사항 확인을 붙여, AI가 모르는 기준을 사람이 확인했습니다.' },
  { id: 'g_level', type: 'good', priority: 3, when: (s) => d(s, 'ev3_storage') === 'shared' && d(s, 'ev3_level') !== '1', text: () => '목적·검토 상태·사용법을 함께 남겨, 다음 차수에서 바로 재사용할 수 있었습니다.' },
  { id: 'g_pii_clean', type: 'good', priority: 4, when: (s) => d(s, 'ev3_pii') === 'clean', text: () => '운영 명단에서 불필요한 정보를 지우고 필요한 사람에게만 공유했습니다.' },
  { id: 'g_notice', type: 'good', priority: 5, when: (s) => d(s, 'ev2_input') === 'notice', text: () => '종윤 책임의 기존 자료에 올해 공지를 함께 넣어, 바뀐 출입 절차를 작성 단계에서 반영했습니다.' },
  { id: 'g_a_human', type: 'good', priority: 6, when: (s) => d(s, 'ev1_A') === 'human', text: () => '세 줄 수정은 직접 처리해, 검토가 끝난 문장을 건드리지 않고 작업 여유 1칸으로 끝냈습니다.' },
  { id: 'g_prd', type: 'good', priority: 7, when: (s) => d(s, 'ev2_method') === 'prd', text: () => '조건이 많은 안내 도구는 미니 PRD로 먼저 정리해 요구사항 누락을 막았습니다.' },
  { id: 'g_reuse', type: 'good', priority: 7, when: (s) => d(s, 'ev2_method') === 'reuse', text: (s) => d(s, 'ev2_input') === 'notice' ? '승인된 기존 도구를 재사용하고, 최신 공지로 내용을 갱신해 비용을 줄였습니다.' : '승인된 기존 도구를 재사용해 제작 비용을 줄였습니다.' },
  { id: 'g_quick_checked', type: 'good', priority: 7, when: (s) => d(s, 'ev2_method') === 'quick' && d(s, 'ev2_verify') === 'ai_heeyeon', text: () => '데모 버전을 빠르게 띄운 뒤, 요구사항 확인으로 빠진 조건을 보완했습니다.' },
  { id: 'g_version', type: 'good', priority: 8, when: (s) => d(s, 'ev3_version') === 'v3' && !!s.flags.version_checked, text: () => '파일 이름이 아니라 작성 시각과 검토 기록을 열어보고 최신본을 골랐습니다.' },
  { id: 'g_key', type: 'good', priority: 8, when: (s) => d(s, 'ev3_key') === 'remove', text: () => '프롬프트 메모의 키 문자열을 공유 전에 발견해 지우고 폐기를 요청했습니다.' },
  { id: 'g_scope_rel', type: 'good', priority: 9, when: (s) => aiUsedEv1(s) && d(s, 'ev1_scope') === 'related', text: () => 'AI에게 관련 자료만 넘겨 입력 분량과 검토 범위를 줄였습니다.' },
  { id: 'g_honest', type: 'good', priority: 10, when: (s) => d(s, 'ev_report') === 'honest', text: () => '최종 승인에서 완료·데모 버전·연계 대기를 구분해 보고했습니다.' },
  { id: 'g_recovery', type: 'good', priority: 11, when: (s) => d(s, 'fu_pii:report') !== undefined, text: () => '과도한 공유를 발견한 뒤 접근 제한·자료 교체·담당자 보고를 모두 처리했습니다.' },
  {
    id: 'g_collect', type: 'good', priority: 12, when: (s) => !!d(s, 'ev2_collect'),
    text: (s) => `화면만 있는 HTML을 '자동 취합 완료'로 표시하지 않고, 응답 저장 상태를 "${EV2_COLLECT[d(s, 'ev2_collect') as Ev2Collect].status}"로 명시했습니다.`,
  },

  // ── 다음에 바꿔볼 행동 ──
  { id: 'c_pii_company', type: 'change', priority: 0, when: (s) => d(s, 'ev3_pii') === 'company', text: () => '개인 연락처가 든 원본을 전사 공개함에 올려, 접근 제한·교체·보고에 작업 여유 3칸이 들었습니다. 올리기 전에 정보 등급을 먼저 확인해 보세요.' },
  { id: 'c_key_keep', type: 'change', priority: 1, when: (s) => d(s, 'ev3_key') === 'keep', text: () => '키 문자열이 든 메모를 그대로 공유해, 폐기 요청과 메모 교체가 뒤따랐습니다.' },
  { id: 'c_overclaim', type: 'change', priority: 2, when: (s) => !!s.flags.overclaim, text: () => '데모 버전과 연계 대기 기능까지 "완료"로 보고했다가 정정하는 데 시간이 들었습니다.' },
  { id: 'c_b_full', type: 'change', priority: 3, when: (s) => d(s, 'ev1_B') === 'full', text: (s) => `AI 분류를 원문 확인 없이 확정해 주차 불편이 식사 불만에 묶였습니다.${d(s, 'fu_unverified') === 'check' ? ' (나중에 표본 확인으로 수정)' : ''}` },
  { id: 'c_stale', type: 'change', priority: 4, when: (s) => d(s, 'ev2_input') === 'old' && d(s, 'ev2_verify') !== 'ai_heeyeon', text: () => '올해 공지 없이 검증 AI만 거쳐, 작년 출입 절차가 검증을 통과했습니다. 검증 AI는 넣어준 자료 안에서만 비교합니다.' },
  {
    id: 'c_version', type: 'change', priority: 4, when: (s) => !!d(s, 'ev3_version') && d(s, 'ev3_version') !== 'v3',
    text: (s) => `"${EV3_VERSIONS.find((v) => v.id === d(s, 'ev3_version'))!.name}"을 기준본으로 골라 작년 출입 절차가 남았습니다. 이름보다 작성 시각·검토 기록을 확인해 보세요.`,
  },
  { id: 'c_mine', type: 'change', priority: 5, when: (s) => d(s, 'ev3_storage') === 'mine', text: () => '결과를 개인 작업함에만 두어, 수진 책임이 같은 자료를 다시 만들었습니다.' },
  { id: 'c_level1', type: 'change', priority: 5, when: (s) => d(s, 'ev3_level') === '1', text: () => '결과물은 완성했지만 사용법이 없어, 다음 담당자가 다시 설명을 요청했습니다.' },
  { id: 'c_a_full', type: 'change', priority: 6, when: (s) => d(s, 'ev1_A') === 'full', text: () => '작은 수정에 전체 재작성을 사용해, 작성보다 검토 시간이 더 늘었습니다.' },
  { id: 'c_b_human', type: 'change', priority: 6, when: (s) => d(s, 'ev1_B') === 'human', text: () => '300건을 전부 수작업으로 분류해 작업 여유 6칸을 썼습니다. AI 분류 초안 + 원문 표본 확인도 고려해 보세요.' },
  { id: 'c_missing_req', type: 'change', priority: 6, when: (s) => d(s, 'ev2_method') === 'quick' && d(s, 'ev2_verify') !== 'ai_heeyeon', text: () => '요구사항 정리 없이 데모 버전을 만들고 사람의 요구사항 확인도 없어, "담당자 수정 가능" 조건이 빠졌습니다.' },
  { id: 'c_parallel', type: 'change', priority: 7, when: (s) => d(s, 'ev2_timing') === 'parallel' && d(s, 'ev2_input') === 'notice', text: () => '변경 분석을 기다리지 않고 작성을 시작해, 출입 절차 부분을 다시 만들었습니다.' },
  { id: 'c_no_verify', type: 'change', priority: 7, when: (s) => d(s, 'ev2_verify') === 'none', text: () => '검증 단계를 생략해, 깨진 링크가 남은 채 승인 요청이 갔습니다.' },
  { id: 'c_ai_low', type: 'change', priority: 8, when: (s) => s.ai < 30 || s.aiShortfall > 0, text: (s) => `AI를 여러 단계에서 크게 써서 이용권이 ${s.ai}점만 남았습니다. 작은 작업은 직접 처리해 아껴 보세요.` },
  { id: 'c_scope_all', type: 'change', priority: 8, when: (s) => d(s, 'ev1_scope') === 'all', text: () => '전체 자료 묶음을 넘겨 이용권과 검토 시간이 더 들었습니다.' },
  { id: 'c_a_draft', type: 'change', priority: 9, when: (s) => d(s, 'ev1_A') === 'draft', text: () => '세 줄 수정에도 AI 초안을 거쳐, 직접 고친 것과 같은 시간에 이용권만 더 썼습니다.' },
  { id: 'c_pii_team', type: 'change', priority: 9, when: (s) => d(s, 'ev3_pii') === 'team', text: () => '연락처 원본을 교육팀 전체에 공유했습니다. 필요한 사람만 보도록 걸러내면 더 안전합니다.' },
  { id: 'c_overtime', type: 'change', priority: 3, when: (s) => s.overtime > 0, text: (s) => `작업 여유를 ${s.overtime}칸 초과해 일정이 밀렸습니다. 범위 축소나 기존 자료 활용을 더 일찍 고려해 보세요.` },
];

export const DISCUSSION_QUESTIONS = [
  '우리 업무 중 사람에게 바로 맡길 일과 AI를 활용할 일을 어떻게 구분할까?',
  '각자 만든 문서·프롬프트·HTML·코드를 어디에, 어떤 정보와 함께 모을까?',
  '공유·검토·권한·운영 담당 중 우리 팀이 먼저 정할 최소 규칙은 무엇일까?',
];

export interface Retro { good: string[]; change: string[] }

export function buildRetro(s: GameState): Retro {
  const pick = (type: 'good' | 'change', n: number) =>
    RETRO_RULES.filter((r) => r.type === type && r.when(s)).sort((a, b) => a.priority - b.priority).slice(0, n).map((r) => r.text(s));
  return { good: pick('good', 2), change: pick('change', 2) };
}
