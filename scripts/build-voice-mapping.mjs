// 캐릭터별 음성 매핑표: scripts/voice-mapping.csv
import { readFileSync, writeFileSync } from 'node:fs';
const lines = JSON.parse(readFileSync(new URL('../src/data/dialogue.json', import.meta.url), 'utf8'));
const C = [
  ['hong', '홍팀장', '여성', '표준어', '명료하고 여유 있는 전문적인 말투', 1.0, 1.0],
  ['sujin', '수진 책임', '여성', '표준어', '안정적이고 든든한 선임의 말투', 0.95, 0.95],
  ['jongyun', '종윤 책임', '남성', '표준어', '차분하고 설명이 분명한 말투', 0.85, 0.92],
  ['chian', '치안 매니저', '남성', '광주 사투리', '광주 억양, 능청스럽고 편안한 리듬', 0.8, 0.97],
  ['heeyeon', '희연 매니저', '여성', '표준어', '또렷하고 간결하며 필요할 때 단호한 말투', 1.1, 1.05],
  ['heoin', '허인 매니저', '남성', '광주 사투리', '광주 억양, 아이디어가 떠오르면 리듬이 빨라지는 말투', 0.95, 1.1],
  ['yunjin', '윤진 매니저', '여성', '경상도 사투리', '경상도 억양, 적극적이지만 동료에게 확인을 구하는 말투', 1.15, 1.02],
];
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const rows = C.map(([id, name, g, d, dir, p, r]) => [id, name, g, d, dir, `public/audio/${id}/`, lines.filter((l) => l.speakerId === id).length, p, r].map(q).join(','));
writeFileSync(new URL('./voice-mapping.csv', import.meta.url), '﻿' + ['speakerId,name,gender,dialect,voiceDirection,audioFolder,lineCount,ttsPitchFallback,ttsRateFallback', ...rows].join('\r\n') + '\r\n');
console.log('[voice] scripts/voice-mapping.csv');
