export type SpeakerId = 'hong' | 'sujin' | 'jongyun' | 'chian' | 'heeyeon' | 'heoin' | 'yunjin';

export type SceneId = 'title' | 'intro' | 'ev1' | 'ev2' | 'ev3' | 'after' | 'report' | 'ending';

export type Expression =
  | 'neutral' | 'smile' | 'happy' | 'bright' | 'focused' | 'calm' | 'sharp' | 'serious'
  | 'worried' | 'sheepish' | 'excited' | 'smirk' | 'surprised' | 'thinking' | 'tired';

export interface Line {
  id: string;
  sceneId: SceneId;
  speakerId: SpeakerId;
  text: string;
  expression: Expression;
  /** 사람이 읽는 출력 조건(설명용). 실제 분기는 logic/game.ts 가 대사 ID를 골라 반환한다. */
  condition: string;
  nextId: string;
}

export interface Cost {
  slack: number;
  ai: number;
}

export type FileLocation = 'mine' | 'shared';
export type ShareScope = 'team' | 'edu' | 'company';

export interface FileItem {
  id: string;
  name: string;
  kind: 'doc' | 'sheet' | 'html' | 'record' | 'prompt' | 'guide';
  owner: SpeakerId;
  location: FileLocation;
  scope?: ShareScope;
  /** 검토 상태(사람이 읽는 문장) */
  review: string;
  /** 재사용 가능 여부와 이유 */
  reusable: boolean;
  reuseNote: string;
  /** 응답 저장 상태 등 추가 상태 */
  status?: string;
  createdAt: number;
}

export interface LogEntry {
  scene: SceneId;
  decision: string;
  option: string;
  label: string;
  slack: number;
  ai: number;
  note?: string;
}

export interface GameState {
  version: 1;
  scene: SceneId;
  audioMode: 'voice' | 'subtitle';
  slack: number;
  ai: number;
  /** 작업 여유를 다 쓴 뒤 추가로 든 칸 수(일정 초과) */
  overtime: number;
  /** 이용권이 모자라 사람이 대신 처리한 분량 기록 */
  aiShortfall: number;
  decisions: Record<string, string>;
  flags: Record<string, boolean>;
  files: FileItem[];
  opened: string[];
  log: LogEntry[];
  followups: string[];
  /** 마지막으로 재생한 결과 대사(이어하기 시 결과 패널 문구에 사용) */
  lastLines: Record<string, string[]>;
  clock: number;
}
