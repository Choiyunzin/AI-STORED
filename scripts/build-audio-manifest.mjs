// public/audio/<speaker>/<lineId>.mp3 파일을 찾아 public/audio/manifest.json 을 만든다.
// 게임은 manifest 에 있는 대사만 파일로 재생하고, 나머지는 TTS/자막으로 진행한다.
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../public/audio/', import.meta.url).pathname;
const files = [];
if (existsSync(root)) {
  for (const sp of readdirSync(root)) {
    const dir = join(root, sp);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.mp3')) continue;
      if (statSync(join(dir, f)).size < 1024) { console.warn(`[audio] 너무 작은 파일 무시 (빈 파일?): ${sp}/${f}`); continue; }
      files.push(`${sp}/${f}`);
    }
  }
}
files.sort();
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`[audio] manifest: ${files.length}개 음성 파일`);
