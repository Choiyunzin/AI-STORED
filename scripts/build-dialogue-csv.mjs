// src/data/dialogue.json → scripts/dialogue.csv (음성 제작용 대본)
// audioStatus: public/audio/<speaker>/<id>.mp3 가 실제로 있으면 '제작됨', 없으면 '미제작'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';

const lines = JSON.parse(readFileSync(new URL('../src/data/dialogue.json', import.meta.url), 'utf8'));
const chars = { hong: '홍팀장', sujin: '수진 책임', jongyun: '종윤 책임', chian: '치안 매니저', heeyeon: '희연 매니저', heoin: '허인 매니저', yunjin: '윤진 매니저' };
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const header = ['id', 'sceneId', 'speakerId', 'speakerName', 'text', 'expression', 'condition', 'audioPath', 'audioStatus', 'nextId'];
let made = 0;
const rows = lines.map((l) => {
  const rel = `public/audio/${l.speakerId}/${l.id}.mp3`;
  const ok = existsSync(new URL(`../${rel}`, import.meta.url)) && statSync(new URL(`../${rel}`, import.meta.url)).size >= 1024;
  if (ok) made++;
  return [l.id, l.sceneId, l.speakerId, chars[l.speakerId], l.text, l.expression, l.condition, `/audio/${l.speakerId}/${l.id}.mp3`, ok ? '제작됨' : '미제작', l.nextId].map(q).join(',');
});
writeFileSync(new URL('./dialogue.csv', import.meta.url), '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n');
console.log(`[dialogue] ${lines.length}줄 → scripts/dialogue.csv (음성 제작됨 ${made} / 미제작 ${lines.length - made})`);
