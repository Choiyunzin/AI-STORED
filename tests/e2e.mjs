// 브라우저 종단 검증: npm run build 후 `node tests/e2e.mjs`
// - 여러 선택 경로를 처음부터 엔딩까지 클릭으로 플레이
// - 가짜 speechSynthesis 로 TTS 경로·겹침 여부 확인, 한국어 음성 없음/파일 누락/새로고침 이어하기 확인
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4179;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const SHOTS = new URL('./screens/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); });
  server.on('exit', () => rej(new Error('preview server exited')));
  setTimeout(() => rej(new Error('server timeout')), 15000);
});

process.on('exit', () => server.kill());
process.on('uncaughtException', (e) => { console.log('❌ 예외: ' + String(e).split('\n')[0]); process.exit(1); });

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

/** 가짜 TTS: voices 목록과 speak/cancel 기록. 동시에 2개 이상 말하는지 감시 */
const fakeTts = (voices) => `
(() => {
  const voices = ${JSON.stringify(voices)}.map(v => ({ ...v, default: false }));
  const log = { speaks: 0, cancels: 0, maxConcurrent: 0, texts: [] };
  let current = null; let concurrent = 0;
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    addEventListener: (t, cb) => { if (t === 'voiceschanged') setTimeout(cb, 300); },
    removeEventListener() {},
    speak(u) {
      log.speaks++; if ((u.text || '').trim()) log.texts.push(u.text);
      if (current) { /* 이전 발화가 끝나지 않았는데 새로 말하면 겹침 */ concurrent++; }
      current = u; concurrent = Math.max(concurrent, 1); log.maxConcurrent = Math.max(log.maxConcurrent, concurrent);
      const dur = Math.min(1500, 150 + (u.text || '').length * 15);
      setTimeout(() => { if (current === u) { u.onstart && u.onstart({}); } }, 20);
      u.__t = setTimeout(() => { if (current === u) { current = null; concurrent = 0; u.onend && u.onend({}); } }, dur);
    },
    cancel() { log.cancels++; if (current) { clearTimeout(current.__t); const u = current; current = null; concurrent = 0; u.onerror && u.onerror({ error: 'interrupted' }); } },
    pause() {}, resume() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.volume = 1; this.pitch = 1; this.rate = 1; };
  window.__ttsLog = log;
})();`;

async function newPage({ voices = [{ name: 'Fake Yuna (Korean)', lang: 'ko-KR', localService: true, voiceURI: 'fake-yuna' }, { name: 'Fake InJoon (Korean)', lang: 'ko-KR', localService: true, voiceURI: 'fake-injoon' }, { name: 'Remote Korean', lang: 'ko-KR', localService: false, voiceURI: 'remote-ko' }], viewport = { width: 1366, height: 768 }, manifest } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (voices) await page.addInitScript(fakeTts(voices));
  if (manifest) await page.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: manifest }) }));
  await page.goto(BASE_URL);
  return { page, ctx, errors };
}

const click = async (page, testid) => {
  // 탐색 화면(방향키 이동)이 떠 있으면 '바로 가기'로 업무 화면까지 진행
  const loc = page.locator(`[data-testid="${testid}"]`).first();
  for (let i = 0; i < 40 && !(await loc.count()); i++) {
    const cut = page.locator('[data-testid=cut-skip]');
    if (await cut.count()) { await cut.click().catch(() => {}); await page.waitForTimeout(450); continue; }
    const skip = page.locator('[data-testid=map-skip]');
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(650); } else await page.waitForTimeout(100);
  }
  await loc.click();
};
const skipCut = async (pg) => {
  const b = pg.locator('[data-testid=cut-skip]');
  await b.waitFor({ timeout: 4000 }).then(() => b.click()).catch(() => {});
  await pg.waitForTimeout(450);
};
const passMap = async (page) => {
  await skipCut(page);
  await page.waitForSelector('[data-testid=map-skip]', { timeout: 5000 });
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForSelector('.scene-title', { timeout: 5000 });
};
const finishDialogue = async (page) => {
  // 대사를 끝까지 넘긴다 (건너뛰기 버튼)
  for (let i = 0; i < 8; i++) {
    const skip = page.locator('#dialogue [data-k=skip]');
    const next = page.locator('#dialogue [data-k=next]');
    if (await next.isDisabled()) return;
    if (!(await skip.isDisabled())) await skip.click(); else await next.click();
  }
};

async function playPath(page, p, shotPrefix) {
  await click(page, p.audio === 'subtitle' ? 'start-subtitle' : 'start-voice'); await skipCut(page);
  await page.waitForSelector('[data-testid=map-skip]');
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForSelector('[data-testid=start-work]');
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-1-intro.png` });
  await finishDialogue(page);
  await click(page, 'start-work');
  // 사건 ①
  await click(page, `ev1-A-${p.a}`);
  await click(page, `ev1-B-${p.b}`);
  if (p.a !== 'human' || p.b !== 'human') await click(page, `ev1-scope-${p.scope}`);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-2-ev1.png` });
  await click(page, 'ev1-confirm');
  await page.locator('[data-testid=ev1-confirm]').count();
  await finishDialogue(page);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-3-ev1-result.png` });
  await click(page, 'to-ev2');
  // 사건 ②
  await click(page, `ev2-method-${p.method}`);
  await finishDialogue(page);
  await click(page, `ev2-input-${p.input}`);
  await click(page, `ev2-timing-${p.timing}`);
  await click(page, `ev2-verify-${p.verify}`);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-4-ev2-flow.png` });
  await click(page, 'ev2-run');
  await finishDialogue(page);
  await click(page, `ev2-collect-${p.collect}`);
  await finishDialogue(page);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-5-ev2-done.png` });
  await click(page, 'to-ev3');
  // 사건 ③
  if (p.open) { await click(page, 'ev3-open-v2'); await page.keyboard.press('Escape'); await click(page, 'ev3-open-v3'); await click(page, 'ev3-modal-pick-v3'); }
  else await click(page, `ev3-pick-${p.version}`);
  await finishDialogue(page);
  await click(page, `ev3-level-${p.level}`);
  await click(page, `ev3-storage-${p.storage}`);
  if (p.storage === 'shared') await click(page, `ev3-scope-${p.scope3 || 'team'}`);
  await click(page, 'ev3-share');
  await click(page, 'ev3-roster'); await page.keyboard.press('Escape');
  await click(page, `ev3-pii-${p.pii}`);
  if (p.level === '3') await click(page, `ev3-key-${p.key}`);
  await finishDialogue(page);
  await click(page, 'ev3-apply');
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-6-ev3.png` });
  await click(page, 'to-after');
  await passMap(page);
  // 누적 결과: 각 후속 사건의 첫 활성 선택지를 차례로 누른다
  for (let i = 0; i < 6; i++) {
    const btn = page.locator('.fu:not(.done) .opt:not(:disabled)').first();
    if (!(await btn.count())) break;
    await btn.click();
  }
  await finishDialogue(page);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-7-after.png` });
  await click(page, 'to-report');
  await click(page, `report-${p.report}`);
  await finishDialogue(page);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-8-report.png` });
  await click(page, 'to-ending');
  await passMap(page);
  await page.waitForSelector('.retro-card');
  await page.waitForTimeout(300);
  if (shotPrefix) await page.screenshot({ path: `${SHOTS}${shotPrefix}-9-ending.png`, fullPage: false });
}

const PATHS = [
  { name: '균형 경로', audio: 'voice', a: 'human', b: 'draft', scope: 'related', method: 'prd', input: 'notice', timing: 'sequential', verify: 'ai_heeyeon', collect: 'survey', open: true, level: '2', storage: 'shared', pii: 'clean', report: 'honest' },
  { name: 'AI 과다 경로', audio: 'voice', a: 'full', b: 'full', scope: 'all', method: 'quick', input: 'notice', timing: 'parallel', verify: 'ai', collect: 'request', open: false, version: 'v3', level: '3', key: 'keep', storage: 'shared', scope3: 'company', pii: 'company', report: 'over' },
  { name: 'AI 미사용 경로', audio: 'subtitle', a: 'human', b: 'human', scope: 'related', method: 'reuse', input: 'old', timing: 'sequential', verify: 'none', collect: 'exclude', open: false, version: 'v2', level: '1', storage: 'mine', pii: 'team', report: 'honest' },
];

for (const [i, p] of PATHS.entries()) {
  const { page, ctx, errors } = await newPage();
  try {
    await playPath(page, p, `p${i + 1}`);
    const st = await page.evaluate(() => window.__axgame.state);
    const good = await page.locator('.retro-card:first-child li').count();
    check(`${p.name}: 엔딩 도달`, st.scene === 'ending', `여유 ${st.slack}칸(초과 ${st.overtime}), 이용권 ${st.ai}, 후속 ${st.followups.join(',')}`);
    check(`${p.name}: 회고 '잘 연결한 행동' 2개`, good === 2);
    const retro = await page.locator('.retro-grid').innerText();
    if (p.name === 'AI 과다 경로') {
      check('AI 과다: 보안 사고 수습 후속 사건 표시', st.followups.includes('fu_pii'));
      check('AI 과다: 과장 보고 정정 비용 기록', st.log.some((l) => l.decision === 'cost:report_fix'));
      check('AI 과다: 회고에 전사 공개함 지적', /전사 공개함/.test(retro));
      check('AI 과다: 응답 저장 상태가 요청 중', /요청 중/.test(st.files.find((f) => f.id === 'f_tool').status));
    }
    if (p.name === 'AI 미사용 경로') {
      check('AI 미사용: AI 이용권 거의 그대로', st.ai >= 90, `${st.ai}점`);
      check('AI 미사용: 수작업 비용이 회고에 드러남', /수작업|직접/.test(retro));
      check('AI 미사용: 자막 모드로 완주 (TTS 호출 없음)', (await page.evaluate(() => window.__ttsLog.texts.length)) === 0);
    }
    if (p.name === '균형 경로') {
      const log = await page.evaluate(() => window.__ttsLog);
      check('TTS: 대사가 브라우저 TTS로 재생됨', log.texts.length > 5, `${log.texts.length}회`);
      check('TTS: 동시에 두 음성이 겹치지 않음', log.maxConcurrent <= 1, `최대 동시 ${log.maxConcurrent}`);
      // 다운로드
      const [dl] = await Promise.all([page.waitForEvent('download'), click(page, 'dl-json')]);
      check('회고 JSON 로컬 다운로드', /ax-game-record\.json/.test(dl.suggestedFilename()));
    }
    check(`${p.name}: 콘솔 오류 없음`, errors.length === 0, errors.join(' | '));
  } catch (e) {
    check(`${p.name}: 진행`, false, String(e));
    await page.screenshot({ path: `${SHOTS}fail-${i + 1}.png` });
  }
  await ctx.close();
}

// 도입 컷신: 타자기 효과, 클릭으로 즉시 완성, 규칙 설명, 건너뛰기
try {
  const { page, ctx, errors } = await newPage();
  await page.locator('[data-testid=start-voice]').click();
  await page.waitForSelector('#cutscene');
  await page.waitForTimeout(250);
  const partial = await page.locator('.cut-text p').first().innerText();
  check('컷신: 타자기처럼 한 글자씩 나옴', partial.length > 0 && partial.length < '회사에서 AI를 어떻게 나눠 쓰면 좋을지, 직접 해보는 10분짜리 업무 게임이에요.'.length, `"${partial}"`);
  check('컷신: TTS로 읽지 않음', (await page.evaluate(() => window.__ttsLog.texts.length)) === 0);
  await page.screenshot({ path: `${SHOTS}cut-1.png` });
  await page.locator('[data-testid=cut-next]').click();
  await page.locator('[data-testid=cut-next]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-testid=cut-prev]').click();
  check('컷신: ◀ 이전으로 앞 장으로 돌아감', /이 게임은/.test(await page.locator('.cut-kicker').innerText()));
  check('컷신: 클릭하면 문장 즉시 완성', (await page.locator('.cut-text').innerText()).includes('잘한 점과 아쉬운 점을 돌아봐요'));
  check('컷신: 첫 장은 게임 소개 4컷 애니메이션', await page.locator('.cv-about .ab').count() === 4);
  for (let i = 0; i < 7; i++) { await page.locator('[data-testid=cut-next]').click(); await page.waitForTimeout(80); }
  await page.waitForTimeout(1500);
  const txt = await page.locator('.cut-card').innerText();
  check('컷신: 작업 여유 규칙 설명', /작업 여유/.test(txt), txt.split('\n')[1]);
  await page.screenshot({ path: `${SHOTS}cut-rule.png` });
  await page.locator('[data-testid=cut-skip]').click();
  await page.waitForSelector('.map-world', { timeout: 5000 });
  check('컷신: 건너뛰면 탐색 화면 시작', true);
  await page.locator('#btn-help').click();
  check('컷신: ❓로 규칙 다시 보기', await page.locator('#cutscene').count() === 1);
  await page.keyboard.press('Escape');
  check('컷신: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
} catch (e) { check('컷신 진행', false, String(e).split('\n')[0]); }

// 탐색 화면: 방향키 이동, 가까이 가면 대화, 자리 도착 시 업무 화면
try {
  const { page, ctx, errors } = await newPage();
  await click(page, 'start-voice'); await skipCut(page);
  await page.waitForSelector('.map-world');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}map-intro.png` });
  const p0 = await page.evaluate(() => window.__axgame.map.debug);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
  const p1 = await page.evaluate(() => window.__axgame.map.debug);
  check('이동: 방향키로 윤진이 움직임', p1.y < p0.y - 30, `y ${Math.round(p0.y)} → ${Math.round(p1.y)}`);
  // 홍팀장에게 걸어가기 (클릭 이동)
  await page.locator('.sprite.npc[data-id=hong]').click();
  await page.waitForFunction(() => window.__axgame.map.debug.talked.includes('hong'), null, { timeout: 8000 });
  await page.waitForTimeout(250);
  const name = await page.locator('.dlg-name').innerText();
  const bubble = await page.locator('.sprite[data-id=hong] .sp-bubble').isVisible();
  check('근접 대화: 홍팀장 가까이 가면 대사·말풍선', name === '홍팀장' && bubble);
  check('근접 대화: 음성 재생 (TTS)', (await page.evaluate(() => window.__ttsLog.texts.some((t) => t.startsWith('다음 주에')))));
  await page.screenshot({ path: `${SHOTS}map-talk.png` });
  // 자리로 먼저 가면 막힘 안내
  await page.locator('#dialogue [data-k=skip]').click().catch(() => {});
  await page.locator('#dialogue [data-k=next]').click().catch(() => {});
  await page.locator('.sprite.npc[data-id=sujin]').click();
  await page.waitForFunction(() => window.__axgame.map.debug.talked.includes('sujin'), null, { timeout: 20000 });
  check('근접 대화: 필수 대화 체크리스트 갱신', await page.locator('[data-req=sujin].ok').count() === 1);
  // 대화가 끝나기를 기다렸다가 내 자리로
  await finishDialogue(page);
  const box = await page.locator('.goal').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('[data-testid=start-work]', { timeout: 15000 });
  check('목표 도착: 내 자리 PC에 가면 업무 화면으로 전환', true);
  // 사건 ①로 이동하면 다시 탐색 화면 + 장소 전환
  await finishDialogue(page);
  await page.locator('[data-testid=start-work]').click();
  await page.waitForSelector('#cutscene', { timeout: 5000 });
  check('사건 소개: 지도에 들어가기 전에 사건 소개 카드', /사건 ①/.test(await page.locator('.cut-card').innerText()));
  await page.screenshot({ path: `${SHOTS}brief-ev1.png` });
  await skipCut(page);
  await page.waitForSelector('.map-world', { timeout: 5000 });
  await page.waitForTimeout(800);
  check('장면 전환: 다음 사건에서 다시 탐색 화면', await page.locator('.hud-time').innerText().then((t) => /10:30/.test(t)));
  check('탐색: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
} catch (e) { check('탐색 화면 진행', false, String(e).split('\n')[0]); }

// 음성 동작: 입 모양·다시 듣기·음소거·설정의 실제 배정 표시
{
  const { page, ctx, errors } = await newPage();
  await click(page, 'start-voice'); await skipCut(page);
  await page.waitForSelector('.map-world');
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForTimeout(700);
  const talking = await page.waitForSelector('.dlg-portrait.talking', { timeout: 2000 }).then(() => true).catch(() => false);
  check('음성: 말하는 동안 입 모양 애니메이션 (talking 클래스)', talking);
  const mode = await page.locator('.dlg-mode').innerText();
  check('음성: 재생 방식 표시', /TTS/.test(mode), mode);
  const before = await page.evaluate(() => window.__ttsLog.texts.length);
  await page.locator('#dialogue [data-k=replay]').click();
  await page.waitForTimeout(300);
  check('음성: 다시 듣기', (await page.evaluate(() => window.__ttsLog.texts.length)) > before);
  await page.locator('#dialogue [data-k=next]').click();
  await page.locator('#dialogue [data-k=next]').click();
  await page.waitForTimeout(200);
  check('음성: 연속 넘김에도 겹침 없음', (await page.evaluate(() => window.__ttsLog.maxConcurrent)) <= 1);
  await page.keyboard.press('m');
  const n1 = await page.evaluate(() => window.__ttsLog.texts.length);
  await page.locator('#dialogue [data-k=replay]').click().catch(() => {});
  await page.waitForTimeout(300);
  check('음성: 음소거(M) 후 재생 안 함', (await page.evaluate(() => window.__ttsLog.texts.length)) === n1);
  await page.locator('#btn-settings').click();
  const settings = await page.locator('.modal').innerText();
  check('설정: 원격 음성 기본 제외, 로컬 음성 2개 표시', /한국어 음성 2개/.test(settings) && /로컬 음성만/.test(settings));
  check('설정: 캐릭터별 실제 적용 음성 표시', /Fake Yuna/.test(settings) && /Fake InJoon/.test(settings));
  await page.screenshot({ path: `${SHOTS}settings.png` });
  check('음성 동작: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 한국어 음성이 없는 PC
{
  const { page, ctx, errors } = await newPage({ voices: [{ name: 'English', lang: 'en-US', localService: true, voiceURI: 'en' }] });
  await click(page, 'start-voice'); await skipCut(page);
  await page.waitForSelector('.map-world');
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForTimeout(1200);
  const notice = await page.locator('.dlg-notice').innerText().catch(() => '');
  check('한국어 음성 없음: 안내 문구 + 재시도/설정 버튼', /한국어 음성을 찾지 못했습니다/.test(notice) && /재시도/.test(notice), notice.replace(/\n/g, ' '));
  await finishDialogue(page);
  await click(page, 'start-work');
  await passMap(page);
  check('한국어 음성 없음: 자막으로 계속 진행', await page.locator('[data-testid=ev1-confirm]').count() === 1);
  await page.screenshot({ path: `${SHOTS}no-korean.png` });
  check('한국어 음성 없음: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// speechSynthesis 자체가 없는 브라우저
{
  const { page, ctx, errors } = await newPage({ voices: null });
  await page.evaluate(() => {}).catch(() => {});
  await ctx.close();
  const c2 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p2 = await c2.newPage();
  const errs = [];
  p2.on('pageerror', (e) => errs.push(String(e)));
  await p2.addInitScript(() => { delete window.speechSynthesis; Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  await p2.goto(BASE_URL);
  await click(p2, 'start-voice'); await skipCut(p2);
  await p2.waitForSelector('.map-world');
  await p2.locator('[data-testid=map-skip]').click();
  await p2.waitForTimeout(800);
  await finishDialogue(p2);
  await click(p2, 'start-work');
  await passMap(p2);
  check('TTS 미지원 브라우저: 자막으로 진행', await p2.locator('[data-testid=ev1-confirm]').count() === 1);
  check('TTS 미지원 브라우저: 콘솔 오류 없음', errs.length === 0 && errors.length === 0, errs.join(' | '));
  await c2.close();
}

// 음성 파일 누락: manifest 에는 있는데 파일이 없음 → TTS 로 대체
{
  const { page, ctx, errors } = await newPage({ manifest: ['hong/intro_hong_01.mp3'] });
  await click(page, 'start-voice'); await skipCut(page);
  await page.waitForSelector('.map-world');
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => window.__ttsLog);
  check('음성 파일 누락: TTS 로 대체 재생', log.texts.some((t) => t.startsWith('다음 주에 신입사원')));
  check('음성 파일 누락: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 새로고침 이어하기 + 중복 클릭 + 재시작
{
  const { page, ctx, errors } = await newPage();
  await click(page, 'start-subtitle'); await skipCut(page);
  await finishDialogue(page);
  await click(page, 'start-work');
  await click(page, 'ev1-A-human');
  await click(page, 'ev1-B-draft');
  await page.locator('[data-testid=ev1-confirm]').dblclick();
  const s1 = await page.evaluate(() => window.__axgame.state);
  check('중복 클릭: 비용 한 번만 차감', s1.slack === 18 - 1 - 2 && s1.ai === 100 - 16, `여유 ${s1.slack}, 이용권 ${s1.ai}`);
  await page.reload();
  const resume = await page.locator('[data-testid=resume]').count();
  check('새로고침: 이어하기 버튼', resume === 1);
  await click(page, 'resume');
  await page.waitForSelector('[data-testid=to-ev2]', { timeout: 5000 }).catch(() => {});
  const s2 = await page.evaluate(() => window.__axgame.state);
  check('새로고침: 상태·산출물 유지', s2.scene === 'ev1' && s2.files.length === 2 && s2.slack === s1.slack);
  check('새로고침: 결과 화면 복원', await page.locator('[data-testid=to-ev2]').count() === 1);
  await page.reload();
  await click(page, 'start-voice'); await skipCut(page);
  const s3 = await page.evaluate(() => window.__axgame.state);
  check('처음부터 다시: 상태 초기화', s3.scene === 'intro' && s3.files.length === 0 && s3.slack === 18 && s3.ai === 100);
  check('이어하기/재시작: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 키보드만으로 진행 + 작은 화면
{
  const { page, ctx, errors } = await newPage({ viewport: { width: 390, height: 844 } });
  await click(page, 'start-subtitle'); await skipCut(page);
  await page.waitForSelector('.map-world');
  await page.locator('[data-testid=map-skip]').click();
  await page.waitForSelector('.scene-title');
  await page.locator('.scene-title').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const done = await page.locator('#dialogue [data-k=next]').isDisabled();
  check('키보드: Enter 로 대사 진행', done);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('모바일 폭 390px: 가로 스크롤 없음', !overflow);
  await click(page, 'start-work');
  await page.screenshot({ path: `${SHOTS}mobile-ev1.png` });
  await page.locator('#btn-right').isVisible().then((v) => check('작은 화면: 파일함 토글 버튼', v));
  check('작은 화면: 콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
