import type { SceneId, SpeakerId } from '../types';

export interface Character {
  id: SpeakerId;
  name: string;
  rank: string;
  gender: 'female' | 'male';
  dialect: string;
  personality: string;
  strengths: string[];
  voiceDirection: string;
  /** 브라우저 TTS로 근사할 때의 기본 높낮이·속도(정확한 음색·억양을 보장하지 않음) */
  tts: { pitch: number; rate: number };
  look: {
    bg: string;
    skin: string;
    hair: string;
    hairStyle: 'bob' | 'long' | 'ponytail' | 'wavy' | 'short' | 'sweep' | 'messy';
    shirt: string;
    glasses?: boolean;
  };
  opinions: Partial<Record<SceneId, string>>;
}

export const SPEAKER_ORDER: SpeakerId[] = ['hong', 'sujin', 'jongyun', 'chian', 'heeyeon', 'heoin', 'yunjin'];

export const CHARACTERS: Record<SpeakerId, Character> = {
  hong: {
    id: 'hong', name: '홍팀장', rank: '팀장', gender: 'female', dialect: '표준어',
    personality: '논리적·분석적이며 배움의 의지가 강한 리더. 목표와 우선순위, 판단 근거를 묻고 결정한다.',
    strengths: ['우선순위 결정', '판단 근거 확인', '최종 승인'],
    voiceDirection: '여성, 명료하고 여유 있는 전문적인 말투',
    tts: { pitch: 1.0, rate: 1.0 },
    look: { bg: '#e7ecfb', skin: '#f3d3b8', hair: '#2b2230', hairStyle: 'bob', shirt: '#3f4f8f' },
    opinions: {
      intro: '안내자료·설문·운영 준비를 D-7 안에 끝내는 게 목표예요.',
      ev1: '무엇을 줄이고 무엇은 사람이 확인해야 하는지부터 정해봐요.',
      ev2: '완료 기준이 있어야 승인할 수 있어요.',
      ev3: '공유 범위는 필요한 만큼만.',
      after: '수습 경로가 있으면 괜찮아요. 숨기지만 마세요.',
      report: '완료와 데모 버전, 연계 대기를 구분해서 보고해 주세요.',
      ending: 'AI를 쓴 횟수보다 일이 어떻게 연결됐는지가 중요해요.',
    },
  },
  sujin: {
    id: 'sujin', name: '수진 책임', rank: '책임', gender: 'female', dialect: '표준어',
    personality: '팀장 다음으로 팀원들을 이끄는 선임. 공유와 협업을 중시하고 진행 상황을 조율한다.',
    strengths: ['진행 조율', '중복 작업 발견', '노하우 공유 체계'],
    voiceDirection: '여성, 안정적이고 든든한 선임의 말투',
    tts: { pitch: 0.95, rate: 0.95 },
    look: { bg: '#e6f4ee', skin: '#f1cfb0', hair: '#4a3022', hairStyle: 'long', shirt: '#2f7a62' },
    opinions: {
      intro: '승인된 사내 AI와 도구만 써요. 서로 만든 건 서로 확인하고요.',
      ev1: '남은 업무 시간도 같이 봐야 해요.',
      ev2: '흐름은 기본안이 있어요. 두세 군데만 바꿔보세요.',
      ev3: '결과만 말고 사용법도 같이 남겨요.',
      after: '다음 사람이 바로 이어받을 수 있었는지가 중요해요.',
      ending: '공유함 규칙부터 같이 정해봐요.',
    },
  },
  jongyun: {
    id: 'jongyun', name: '종윤 책임', rank: '책임', gender: 'male', dialect: '표준어',
    personality: '팀에 아주 오래 있었고 교육학을 전공했다. 교육 원리와 과거 운영 사례, 팀 히스토리를 잘 안다.',
    strengths: ['교육 설계 원리', '과거 운영 사례', '팀 히스토리'],
    voiceDirection: '남성, 차분하고 설명이 분명한 말투',
    tts: { pitch: 0.85, rate: 0.92 },
    look: { bg: '#f3efe4', skin: '#eac6a6', hair: '#6d6a66', hairStyle: 'short', shirt: '#7a6a4f', glasses: true },
    opinions: {
      intro: '지난 차수 자료가 꽤 남아 있어요.',
      ev1: '분류가 끝나면 의견이 나온 맥락은 제가 설명할게요.',
      ev2: '작년 자료는 출입 절차가 올해와 달라요.',
      ev3: '변경 이유를 남겨두면 다음에 다시 묻지 않아요.',
      after: '그때도 비슷한 일이 있었죠.',
      ending: '과거 사례도 근거 자료와 같이 남기면 좋겠어요.',
    },
  },
  chian: {
    id: 'chian', name: '치안 매니저', rank: '매니저', gender: 'male', dialect: '광주 사투리',
    personality: '교육팀에 오래 있었고 실무를 잘 안다. 능청스럽고 유머가 있으며 운영 변수와 신입사원 반응을 잘 짚는다.',
    strengths: ['현장 운영 변수', '신입사원 반응 예측', '빠른 직접 처리'],
    voiceDirection: '남성, 광주 억양, 능청스럽고 편안한 리듬',
    tts: { pitch: 0.8, rate: 0.97 },
    look: { bg: '#fdeee3', skin: '#e9bf9b', hair: '#1f1b1a', hairStyle: 'sweep', shirt: '#c0623a' },
    opinions: {
      intro: '계획대로만 되면 좋제. 당일 변수는 늘 있어요.',
      ev1: '세 줄은 손으로 치는 게 빠르겄는디요?',
      ev2: '작년 도구는 의견 남기는 칸이 없었을 거요.',
      ev3: '파일은 있는디 제 컴퓨터에선 안 열려요.',
      after: '현장에서 막히는 건 결국 사소한 데서 나와라.',
      ending: '바로 할 일이랑 맡길 일 구분하는 게 핵심이제.',
    },
  },
  heeyeon: {
    id: 'heeyeon', name: '희연 매니저', rank: '매니저', gender: 'female', dialect: '표준어',
    personality: '목적·목표·논리를 잘 구성하고 똑부러진다. 한 번씩 칼같이 핵심을 짚는다.',
    strengths: ['요구사항 정리', '우선순위·완료 기준', '논리 점검'],
    voiceDirection: '여성, 또렷하고 간결하며 필요할 때 단호한 말투',
    tts: { pitch: 1.1, rate: 1.05 },
    look: { bg: '#f6e8f1', skin: '#f4d6bf', hair: '#3a2420', hairStyle: 'ponytail', shirt: '#8a3e6b' },
    opinions: {
      intro: '해결하려는 문제부터 분명히 하죠.',
      ev1: '두 업무를 같은 방식으로 처리할 필요는 없어요.',
      ev2: '예쁘게 뜨는 것과 운영되는 건 달라요.',
      ev3: '최신본은 이름이 아니라 기록으로 골라요.',
      after: '근거 없는 결론은 다음 기획을 틀어요.',
      ending: '완료 기준을 먼저 합의하면 검토가 빨라져요.',
    },
  },
  heoin: {
    id: 'heoin', name: '허인 매니저', rank: '매니저', gender: 'male', dialect: '광주 사투리',
    personality: '사차원적인 발상으로 예상하지 못한 아이디어를 낸다. 가끔 덤벙대지만 익숙한 전제를 뒤집는 제안으로 기여한다.',
    strengths: ['전제 뒤집기', '새로운 형식 제안', '빠른 시도'],
    voiceDirection: '남성, 광주 억양, 아이디어가 떠오르면 리듬이 빨라지는 말투',
    tts: { pitch: 0.95, rate: 1.1 },
    look: { bg: '#eaf2fb', skin: '#efc9a7', hair: '#3b2a1e', hairStyle: 'messy', shirt: '#3a7bbd' },
    opinions: {
      intro: '안내문을 안 읽는 게 문제면, 안내문 말고 다른 걸 만들어야죠.',
      ev1: '300건이면 재밌는 패턴 나올 것 같은디요.',
      ev2: '신입사원이 직접 골라보는 안내 도구 어때요?',
      ev3: '어… 제가 수정 전 파일을 올렸나 봐요.',
      after: '남는 시간 있으면 퀴즈 카드도 해보고 싶당께요.',
      ending: '다음엔 처음부터 공유함에 만들게요.',
    },
  },
  yunjin: {
    id: 'yunjin', name: '윤진 매니저', rank: '매니저 (나)', gender: 'female', dialect: '경상도 사투리',
    personality: '팀에 들어온 지 얼마 안 됐고 AI를 잘 쓴다. 업무 분해·프롬프트·AI 도구 연결에 강하고, 팀 히스토리와 내부 기준은 동료에게 배운다.',
    strengths: ['업무 분해', '프롬프트 작성', 'AI 도구 연결'],
    voiceDirection: '여성, 경상도 억양, 적극적이지만 동료에게 확인을 구하는 자연스러운 말투',
    tts: { pitch: 1.15, rate: 1.02 },
    look: { bg: '#fff3d6', skin: '#f5d4b6', hair: '#5a3a28', hairStyle: 'wavy', shirt: '#d49a1f' },
    opinions: {
      intro: 'AI로 줄일 수 있는 일부터 나눠볼게요.',
      ev1: '업무마다 방식이랑 넘길 자료를 따로 정해볼게요.',
      ev2: '데모 버전은 금방이에요. 조건은 같이 봐주세요.',
      ev3: '정리하는 데도 시간이 드네예. 어디까지 남길지 정해야겠어요.',
      after: '수습할 건 수습하고 갈게요.',
      ending: '팀에서 아는 거랑 AI 실행을 연결하는 게 제 몫이네요.',
    },
  },
};
