import type { Cost, GameState } from '../types';
import { AI_LOW_THRESHOLD } from './options';

export interface FollowupOption {
  id: string;
  label: string;
  /** 음수 slack 은 여유를 되돌려 받는 것 */
  cost: Cost;
  note: string;
  lines: string[];
  flag?: string;
}

export interface Followup {
  id: string;
  title: string;
  positive: boolean;
  /** 숫자가 작을수록 먼저 */
  priority: number;
  /** 원인 설명(어떤 선택 때문인지) */
  cause: (s: GameState) => string;
  when: (s: GameState) => boolean;
  intro: string[];
  /** steps: 모든 단계를 처리해야 끝나는 수습, choice: 하나를 고르는 대응 */
  kind: 'choice' | 'steps';
  options: FollowupOption[];
  doneLines?: string[];
}

const d = (s: GameState, k: string) => s.decisions[k];
export const isStale = (s: GameState) => !!s.flags.stale_html || (!!d(s, 'ev3_version') && d(s, 'ev3_version') !== 'v3');

export const FOLLOWUPS: Followup[] = [
  {
    id: 'fu_pii', title: '전사 공개함의 개인 연락처', positive: false, priority: 0, kind: 'steps',
    cause: () => '사건 ③에서 연락처가 든 원본을 전사 공개함에 올렸습니다.',
    when: (s) => d(s, 'ev3_pii') === 'company',
    intro: ['fu_pii', 'fu_pii_2'],
    options: [
      { id: 'restrict', label: '① 접근 제한', cost: { slack: 1, ai: 0 }, note: '공개 범위를 즉시 운영 담당으로 줄인다.', lines: [] },
      { id: 'replace', label: '② 자료 교체', cost: { slack: 1, ai: 0 }, note: '연락처·무관한 메모를 지운 버전으로 교체.', lines: [] },
      { id: 'report', label: '③ 담당자 보고', cost: { slack: 1, ai: 0 }, note: '정보보호 담당에게 경위와 조치를 보고.', lines: [] },
    ],
    doneLines: ['fu_pii_done'],
  },
  {
    id: 'fu_key', title: '공유된 메모의 키 문자열', positive: false, priority: 1, kind: 'choice',
    cause: () => '사건 ③에서 키 문자열이 든 프롬프트 메모를 그대로 공유했습니다.',
    when: (s) => d(s, 'ev3_key') === 'keep',
    intro: ['fu_key'],
    options: [
      { id: 'report', label: '보안 담당에게 알리고 폐기 요청 + 메모 교체', cost: { slack: 1, ai: 0 }, note: '가상 키 폐기 요청. 실제 자격증명은 쓰이지 않는다.', lines: ['fu_key_done'] },
    ],
  },
  {
    id: 'fu_stale', title: '배포 직전, 작년 출입 절차 발견', positive: false, priority: 2, kind: 'choice',
    cause: (s) => s.flags.stale_html
      ? '사건 ②에서 올해 공지 없이 만들고, 요구사항 확인 없이 검증했습니다.'
      : '사건 ③에서 검토 기록이 아닌 이름으로 기준본을 골랐습니다.',
    when: isStale,
    intro: ['fu_stale', 'fu_stale_2'],
    options: [
      { id: 'fix', label: '올해 공지 기준으로 수정 후 재배포', cost: { slack: 2, ai: 4 }, note: '원본을 바로잡는다.', lines: ['fu_stale_fix'] },
      { id: 'errata', label: '정오표 공지로 우선 대응', cost: { slack: 1, ai: 0 }, note: '원본 교체는 나중으로 미룬다.', lines: ['fu_stale_errata'], flag: 'errata' },
    ],
  },
  {
    id: 'fu_unverified', title: '분석표 근거 질문', positive: false, priority: 3, kind: 'choice',
    cause: () => '사건 ①에서 AI 분류를 원문 확인 없이 확정했습니다.',
    when: (s) => d(s, 'ev1_B') === 'full',
    intro: ['fu_unverified'],
    options: [
      { id: 'check', label: '원문 표본 30건 확인 후 분석표 수정', cost: { slack: 1, ai: 0 }, note: '종윤이 당시 맥락을 함께 본다.', lines: ['fu_unverified_check'] },
      { id: 'skip', label: '근거 없이 그대로 제출', cost: { slack: 0, ai: 0 }, note: '분석표에 "원문 미확인" 표시가 남는다.', lines: ['fu_unverified_skip'], flag: 'unverified_kept' },
    ],
  },
  {
    id: 'fu_dup', title: '같은 자료를 다시 만든 수진', positive: false, priority: 4, kind: 'choice',
    cause: () => '사건 ③에서 결과를 개인 작업함에만 두었습니다.',
    when: (s) => d(s, 'ev3_storage') === 'mine',
    intro: ['fu_dup'],
    options: [
      { id: 'merge', label: '두 자료를 합치고 공유함으로 이동', cost: { slack: 1, ai: 0 }, note: '중복된 작업 비용은 이미 들었다.', lines: ['fu_dup_merge'], flag: 'merged' },
      { id: 'keep', label: '각자 버전 유지', cost: { slack: 0, ai: 0 }, note: '지금은 시간이 안 든다.', lines: ['fu_dup_keep'], flag: 'dup_kept' },
    ],
  },
  {
    id: 'fu_usage', title: '윤진에게 몰리는 문의', positive: false, priority: 5, kind: 'choice',
    cause: () => '사건 ③에서 결과 파일만 공유하고 사용법·실행 조건을 남기지 않았습니다.',
    when: (s) => d(s, 'ev3_level') === '1',
    intro: ['fu_usage'],
    options: [
      { id: 'write', label: '지금 사용법·실행 조건 한 장 작성', cost: { slack: 1, ai: 2 }, note: 'AI 초안 + 직접 확인.', lines: ['fu_usage_write'], flag: 'usage_written' },
      { id: 'answer', label: '문의에 한 명씩 직접 답변', cost: { slack: 2, ai: 0 }, note: '다음 차수에도 같은 문의가 온다.', lines: ['fu_usage_answer'] },
    ],
  },
  {
    id: 'fu_edit', title: '담당자가 고칠 수 없는 HTML', positive: false, priority: 6, kind: 'choice',
    cause: () => '사건 ②에서 요구사항 정리 없이 데모 버전을 만들고, 요구사항 확인을 거치지 않았습니다.',
    when: (s) => !!s.flags.missing_req,
    intro: ['fu_edit', 'fu_edit_2'],
    options: [
      { id: 'direct', label: '이번엔 윤진이 직접 수정', cost: { slack: 1, ai: 0 }, note: '다음 수정도 윤진에게 돌아온다.', lines: ['fu_edit_direct'] },
      { id: 'rebuild', label: '문구를 표 파일로 분리해 담당자 수정 가능하게', cost: { slack: 1, ai: 8 }, note: '허인의 아이디어. 이후엔 담당자가 직접 고친다.', lines: ['fu_edit_rebuild'], flag: 'editable_fixed' },
    ],
  },
  {
    id: 'fu_ai', title: 'AI 이용권 부족', positive: false, priority: 2.5, kind: 'choice',
    cause: (s) => `앞선 작업에서 이용권을 ${100 - s.ai}점 사용해, 남은 이용권이 ${s.ai}점입니다.`,
    when: (s) => s.ai < AI_LOW_THRESHOLD,
    intro: ['fu_ai'],
    options: [
      { id: 'reduce', label: '수정 범위 축소 (필수 안내만)', cost: { slack: 0, ai: 0 }, note: '나머지는 다음 차수로.', lines: ['fu_ai_reduce'], flag: 'scope_reduced' },
      { id: 'manual', label: '사람이 직접 수정', cost: { slack: 2, ai: 0 }, note: '이용권 없이 처리.', lines: ['fu_ai_manual'] },
    ],
  },
  {
    id: 'fu_bulk', title: '마감 임박', positive: false, priority: 8, kind: 'choice',
    cause: () => '사건 ①에서 300건 분석을 전부 수작업으로 처리해 작업 여유 6칸을 썼습니다.',
    when: (s) => d(s, 'ev1_B') === 'human',
    intro: ['fu_bulk'],
    options: [
      { id: 'focus', label: '핵심 업무 우선 (설문 문항 축소)', cost: { slack: 0, ai: 0 }, note: '설문 일부가 다음 차수로 밀린다.', lines: ['fu_bulk_focus'], flag: 'scope_reduced' },
      { id: 'overtime', label: '늦게까지 남아 전부 마감', cost: { slack: 2, ai: 0 }, note: '여유가 없으면 일정 초과로 기록된다.', lines: ['fu_bulk_overtime'] },
    ],
  },
  {
    id: 'fu_prompt', title: '같은 프롬프트, 다른 결과', positive: false, priority: 3.5, kind: 'choice',
    cause: () => '사건 ②에서 요구사항 없이 즉시 만든 뒤, 사건 ③에서 프롬프트만 남겼습니다(근거 자료 없음).',
    when: (s) => d(s, 'ev3_level') === '3' && d(s, 'ev2_method') === 'quick',
    intro: ['fu_prompt'],
    options: [
      { id: 'fix', label: '근거 자료를 붙여 다시 생성·검증', cost: { slack: 1, ai: 6 }, note: '', lines: ['fu_prompt_fix'] },
      { id: 'keep', label: '이전 결과 사용 + "근거 미첨부" 표시', cost: { slack: 0, ai: 0 }, note: '', lines: ['fu_prompt_keep'], flag: 'prompt_unsourced' },
    ],
  },
  // ── 좋은 선택이 돌아오는 경우 ──
  {
    id: 'fu_reuse', title: '다음 차수 담당자가 바로 재사용', positive: true, priority: 20, kind: 'choice',
    cause: () => '사건 ③에서 사용법·검토 상태와 함께 공유함에 올렸습니다.',
    when: (s) => d(s, 'ev3_storage') === 'shared' && d(s, 'ev3_level') !== '1' && d(s, 'ev3_pii') !== 'company',
    intro: ['fu_reuse', 'fu_reuse_2'],
    options: [
      { id: 'quiz', label: '되찾은 여유로 허인의 퀴즈 카드 시도', cost: { slack: -1, ai: 4 }, note: '재사용으로 여유 +2, 퀴즈 제작에 1칸 사용.', lines: ['fu_reuse_quiz'], flag: 'quiz' },
      { id: 'keep', label: '여유로 남겨두기', cost: { slack: -2, ai: 0 }, note: '재사용으로 아낀 여유 +2.', lines: ['fu_reuse_keep'] },
    ],
  },
  {
    id: 'fu_review', title: '검토 흐름이 다시 잡아낸 오류', positive: true, priority: 21, kind: 'choice',
    cause: (s) => d(s, 'ev2_verify') === 'ai_heeyeon'
      ? '사건 ②에서 검증 AI 뒤에 희연의 요구사항 확인을 붙였습니다.'
      : '사건 ②에서 최신 공지를 입력하고 검증 AI를 거쳤습니다.',
    when: (s) => !!s.flags.review_flow,
    intro: ['fu_review'],
    options: [
      { id: 'adopt', label: '검토 흐름을 팀 표준으로 등록', cost: { slack: -1, ai: 0 }, note: '재작업이 줄어 여유 +1.', lines: ['fu_review_go'], flag: 'flow_adopted' },
    ],
  },
];

export const FOLLOWUP_BY_ID = Object.fromEntries(FOLLOWUPS.map((f) => [f.id, f])) as Record<string, Followup>;
