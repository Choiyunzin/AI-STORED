import type { SceneId, SpeakerId } from '../types';

/** 탐색 화면(방) 데이터. 좌표는 월드 픽셀(880×520), 캐릭터 좌표는 발 위치. */
export interface Furn { x: number; y: number; w: number; h: number; label?: string; kind: 'desk' | 'table' | 'shelf' | 'plant' | 'sofa' | 'server' | 'board' | 'bar' | 'misc'; solid?: boolean }
export interface MapNpc { id: SpeakerId; x: number; y: number; lines: string[]; required: boolean }
export interface MapDef {
  scene: SceneId;
  room: string;
  time: string;
  floor: 'office' | 'meeting' | 'archive' | 'leader' | 'lounge';
  hint: string;
  furniture: Furn[];
  npcs: MapNpc[];
  /** 필수 대화를 모두 들은 뒤 이어지는 대사(주로 윤진) */
  afterAll?: string[];
  goal: { x: number; y: number; w: number; h: number; label: string };
  start: { x: number; y: number };
}

export const WORLD = { w: 880, h: 520, top: 64 };

const officeFurniture: Furn[] = [
  { x: 730, y: 70, w: 120, h: 48, label: '팀장 책상', kind: 'desk' },
  { x: 60, y: 90, w: 120, h: 46, label: '수진', kind: 'desk' },
  { x: 220, y: 90, w: 120, h: 46, label: '종윤', kind: 'desk' },
  { x: 380, y: 90, w: 120, h: 46, label: '치안', kind: 'desk' },
  { x: 540, y: 90, w: 120, h: 46, label: '희연', kind: 'desk' },
  { x: 60, y: 290, w: 120, h: 46, label: '허인', kind: 'desk' },
  { x: 220, y: 290, w: 120, h: 46, label: '빈 자리', kind: 'desk' },
  { x: 410, y: 296, w: 56, h: 40, label: '🖨', kind: 'misc' },
  { x: 640, y: 290, w: 140, h: 46, label: '🖥 내 자리', kind: 'desk' },
  { x: 826, y: 440, w: 36, h: 36, label: '🪴', kind: 'plant' },
  { x: 20, y: 436, w: 64, h: 52, label: '☕', kind: 'bar' },
];
const officePos: Record<SpeakerId, { x: number; y: number }> = {
  hong: { x: 790, y: 152 }, sujin: { x: 120, y: 172 }, jongyun: { x: 280, y: 172 }, chian: { x: 440, y: 172 },
  heeyeon: { x: 600, y: 172 }, heoin: { x: 120, y: 372 }, yunjin: { x: 710, y: 372 },
};
const myPc = { x: 650, y: 344, w: 120, h: 56, label: '🖥 내 자리 PC' };
const amb = (scene: string, id: SpeakerId, pos: { x: number; y: number }): MapNpc => ({ id, ...pos, lines: [`amb_${scene}_${id}`], required: false });
const req = (id: SpeakerId, pos: { x: number; y: number }, lines: string[]): MapNpc => ({ id, ...pos, lines, required: true });

export const MAPS: Partial<Record<SceneId, MapDef>> = {
  intro: {
    scene: 'intro', room: '교육팀 사무실', time: '월요일 09:00 · 입사 D-7', floor: 'office',
    hint: '화살표를 따라가 보세요. 팀원 가까이 가면 저절로 대화가 시작돼요.',
    furniture: officeFurniture, goal: myPc, start: { x: 440, y: 480 },
    npcs: [
      req('hong', officePos.hong, ['intro_hong_01']), req('sujin', officePos.sujin, ['intro_sujin_01']),
      amb('intro', 'jongyun', officePos.jongyun), amb('intro', 'chian', officePos.chian), amb('intro', 'heeyeon', officePos.heeyeon), amb('intro', 'heoin', officePos.heoin),
    ],
    afterAll: ['intro_yunjin_01'],
  },
  ev1: {
    scene: 'ev1', room: '교육팀 사무실', time: '월요일 10:30 · 업무 두 건 도착', floor: 'office',
    hint: '치안 매니저와 희연 매니저의 이야기를 듣고, 내 자리 PC에서 업무를 배치하세요.',
    furniture: officeFurniture, goal: myPc, start: { x: 710, y: 420 },
    npcs: [
      req('chian', officePos.chian, ['ev1_chian_01']), req('heeyeon', officePos.heeyeon, ['ev1_heeyeon_01']),
      amb('ev1', 'hong', officePos.hong), amb('ev1', 'sujin', officePos.sujin), amb('ev1', 'jongyun', officePos.jongyun), amb('ev1', 'heoin', officePos.heoin),
    ],
    afterAll: ['ev1_yunjin_01'],
  },
  ev2: {
    scene: 'ev2', room: '회의실', time: '화요일 14:00 · 안내 도구 회의', floor: 'meeting',
    hint: '허인·희연·종윤의 의견을 듣고, 회의 테이블의 노트북으로 가세요.',
    furniture: [
      { x: 270, y: 200, w: 340, h: 120, label: '회의 테이블', kind: 'table' },
      { x: 300, y: 50, w: 280, h: 26, label: '화이트보드: 첫날 안내 도구?', kind: 'board' },
      { x: 30, y: 70, w: 36, h: 36, label: '🪴', kind: 'plant' },
      { x: 812, y: 70, w: 36, h: 36, label: '🪴', kind: 'plant' },
      { x: 760, y: 420, w: 90, h: 56, label: '🖨 프로젝터', kind: 'misc' },
    ],
    goal: { x: 380, y: 326, w: 120, h: 54, label: '💻 회의실 노트북' }, start: { x: 120, y: 470 },
    npcs: [
      req('heoin', { x: 340, y: 186 }, ['ev2_heoin_01', 'ev2_yunjin_01']), req('heeyeon', { x: 540, y: 186 }, ['ev2_heeyeon_01']),
      req('jongyun', { x: 660, y: 290 }, ['ev2_jongyun_01']),
      amb('ev2', 'sujin', { x: 220, y: 290 }), amb('ev2', 'chian', { x: 640, y: 450 }),
    ],
  },
  ev3: {
    scene: 'ev3', room: '자료실', time: '수요일 16:00 · 흩어진 파일들', floor: 'archive',
    hint: '수진·허인·치안의 이야기를 듣고, 공유 PC에서 파일을 정리하세요.',
    furniture: [
      { x: 60, y: 80, w: 220, h: 40, label: '📚 지난 차수 자료', kind: 'shelf' },
      { x: 60, y: 200, w: 220, h: 40, label: '📚 운영 서류', kind: 'shelf' },
      { x: 60, y: 320, w: 220, h: 40, label: '📚 교안', kind: 'shelf' },
      { x: 720, y: 70, w: 110, h: 120, label: '🗄 사내 승인 공유함', kind: 'server' },
      { x: 560, y: 300, w: 150, h: 46, label: '🖥 공유 PC', kind: 'desk' },
    ],
    goal: { x: 570, y: 352, w: 130, h: 54, label: '🖥 공유 PC' }, start: { x: 440, y: 490 },
    npcs: [
      req('sujin', { x: 370, y: 170 }, ['ev3_sujin_01']), req('heoin', { x: 340, y: 300 }, ['ev3_heoin_01']),
      req('chian', { x: 470, y: 420 }, ['ev3_chian_01']),
      amb('ev3', 'heeyeon', { x: 620, y: 180 }), amb('ev3', 'jongyun', { x: 170, y: 450 }),
    ],
  },
  after: {
    scene: 'after', room: '교육팀 사무실', time: '한 달 뒤 · 다음 교육 차수', floor: 'office',
    hint: '다음 차수 담당자가 지난 자료를 찾고 있어요. 팀원들의 이야기를 들어보고 내 자리로 가세요.',
    furniture: officeFurniture, goal: myPc, start: { x: 440, y: 480 },
    npcs: (['hong', 'sujin', 'jongyun', 'chian', 'heeyeon', 'heoin'] as SpeakerId[]).map((id) => amb('after', id, officePos[id])),
  },
  report: {
    scene: 'report', room: '팀장실', time: '금요일 17:00 · 최종 승인', floor: 'leader',
    hint: '홍팀장에게 다가가 최종 보고를 시작하세요.',
    furniture: [
      { x: 360, y: 110, w: 160, h: 56, label: '팀장 책상', kind: 'desk' },
      { x: 60, y: 70, w: 160, h: 36, label: '📚', kind: 'shelf' },
      { x: 640, y: 300, w: 160, h: 60, label: '🛋', kind: 'sofa' },
      { x: 820, y: 70, w: 36, h: 36, label: '🪴', kind: 'plant' },
    ],
    goal: { x: 380, y: 236, w: 120, h: 54, label: '📋 보고 자리' }, start: { x: 440, y: 480 },
    npcs: [req('hong', { x: 440, y: 200 }, ['rp_hong_01'])],
  },
  ending: {
    scene: 'ending', room: '라운지', time: '금요일 18:00 · 회고', floor: 'lounge',
    hint: '홍팀장에게 다가가 이야기를 나누고, 회고 보드로 가세요.',
    furniture: [
      { x: 100, y: 280, w: 180, h: 56, label: '🛋', kind: 'sofa' },
      { x: 600, y: 280, w: 180, h: 56, label: '🛋', kind: 'sofa' },
      { x: 60, y: 66, w: 200, h: 40, label: '☕ 커피', kind: 'bar' },
      { x: 560, y: 48, w: 260, h: 30, label: '📌 회고 보드', kind: 'board' },
    ],
    goal: { x: 610, y: 84, w: 200, h: 50, label: '📌 회고 보드' }, start: { x: 440, y: 490 },
    npcs: [
      req('hong', { x: 440, y: 210 }, ['end_hong_01']),
      amb('ending', 'sujin', { x: 190, y: 250 }), amb('ending', 'jongyun', { x: 690, y: 250 }), amb('ending', 'chian', { x: 300, y: 430 }),
      amb('ending', 'heeyeon', { x: 590, y: 430 }), amb('ending', 'heoin', { x: 440, y: 340 }),
    ],
    afterAll: ['end_yunjin_01'],
  },
};
