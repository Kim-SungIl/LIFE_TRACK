// M2 브라우저 smoke test
// - Vite preview 서버 띄우고
// - Playwright chromium으로 실제 앱 로드
// - 콘솔 에러 없는지
// - 새 게임 시작 플로우가 크래시 없이 돌아가는지
// - DevTools 통해 window state 확인 가능하면 신규 필드 검증
//
// 실행: cd game && node scripts/smoke-test-m2.mjs

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

let preview;

async function startPreview() {
  preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      const s = chunk.toString();
      if (s.includes('Local:') || s.includes(String(PORT))) resolve();
    };
    preview.stdout.on('data', onData);
    preview.stderr.on('data', onData);
    setTimeout(() => reject(new Error('preview start timeout')), 10000);
  });
  await sleep(500);
}

async function stopPreview() {
  if (preview) preview.kill('SIGTERM');
}

let passed = 0, failed = 0;
const assert = (label, cond, detail) => {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
};

async function main() {
  console.log('\n▶ Vite preview 서버 기동...');
  await startPreview();
  console.log(`  ${URL} 준비 완료`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 콘솔 메시지 수집
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => { pageErrors.push(String(e)); });

  console.log('\n=== 1. 앱 초기 로드 ===');
  const resp = await page.goto(URL, { waitUntil: 'networkidle' });
  assert('HTTP 200', resp && resp.status() === 200, `status=${resp?.status()}`);
  assert('pageerror 없음', pageErrors.length === 0, pageErrors.join(' | '));
  assert('console.error 없음', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  const title = await page.title();
  assert(`document.title 존재: "${title}"`, !!title);

  console.log('\n=== 2. 앱 루트 DOM 존재 ===');
  await page.waitForSelector('#root', { timeout: 5000 });
  const rootHasChildren = await page.evaluate(() => document.querySelector('#root')?.children.length ?? 0);
  assert(`#root 자식 요소 존재 (${rootHasChildren}개)`, rootHasChildren > 0);

  console.log('\n=== 3. localStorage에 세이브 삭제 후 새 세팅 화면 진입 ===');
  await page.evaluate(() => localStorage.removeItem('lifetrack_save'));
  await page.reload({ waitUntil: 'networkidle' });
  // 튜토리얼/세팅 화면이 뜨는지 — 버튼이나 입력 요소 하나라도 있으면 OK
  const interactiveCount = await page.evaluate(() => document.querySelectorAll('button,input,select').length);
  assert(`interactive 요소 존재 (${interactiveCount}개)`, interactiveCount > 0);

  console.log('\n=== 4. 구세이브 호환 — v1.1 이전 세이브 주입 후 로드 ===');
  // 신규 필드가 전혀 없는 가짜 구세이브 주입
  await page.evaluate(() => {
    const legacyState = {
      week: 10, year: 2, phase: 'weekday', track: null, gender: 'male',
      stats: { academic: 40, social: 35, talent: 20, mental: 60, health: 50 },
      fatigue: 20, money: 15, parents: ['wealth', 'emotional'],
      mentalState: 'normal', routineSlot2: null, routineSlot3: null, routineWeeks: 0,
      weekendChoices: [], vacationChoices: [], semester: 1, isVacation: false,
      weekLog: null, npcs: [], events: [], currentEvent: null,
      milestones: [], burnoutCount: 0, totalWeeksPlayed: 0,
      examResults: [], currentExamResult: null, activeBuffs: [], weekPurchases: {},
      idleWeeks: 0, consecutiveTiredWeeks: 0, burnoutCooldown: 0, eventTimeCost: 0,
      unlockedEvents: [],
      // 의도적으로 v1.2 신규 필드 누락: memorySlots/socialRipples/milestoneScenes/rngSeed/hardCrisisYears
    };
    localStorage.setItem('lifetrack_save', JSON.stringify({
      version: 1, state: legacyState, savedAt: new Date().toISOString(),
    }));
  });
  consoleErrors.length = 0;
  pageErrors.length = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(300);
  assert('구세이브 로드 후 pageerror 없음', pageErrors.length === 0, pageErrors.join(' | '));
  assert('구세이브 로드 후 console.error 없음', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  // 앱이 여전히 렌더링되는지
  const stillRendered = await page.evaluate(() => (document.querySelector('#root')?.children.length ?? 0) > 0);
  assert('구세이브 로드 후 UI 렌더링 유지', stillRendered);

  console.log('\n=== 4.5 year-end phase 화면 렌더링 (M3.5) ===');
  // year-end 상태 세이브 주입
  await page.evaluate(() => {
    const yearEndState = {
      week: 49, year: 2, phase: 'year-end', track: null, gender: 'male',
      stats: { academic: 45, social: 40, talent: 20, mental: 65, health: 50 },
      fatigue: 20, money: 15, parents: ['wealth', 'emotional'],
      mentalState: 'normal', routineSlot2: null, routineSlot3: null, routineWeeks: 0,
      weekendChoices: [], vacationChoices: [], semester: 2, isVacation: false,
      weekLog: null, npcs: [], events: [], currentEvent: null,
      milestones: [], burnoutCount: 0, totalWeeksPlayed: 0,
      examResults: [], currentExamResult: null, activeBuffs: [], weekPurchases: {},
      idleWeeks: 0, consecutiveTiredWeeks: 0, burnoutCooldown: 0, eventTimeCost: 0,
      unlockedEvents: [],
      memorySlots: [{
        id: 'growth_2_15_1', category: 'growth', week: 15, year: 2,
        sourceEventId: 'test-event', choiceIndex: 1,
        recallText: '중1의 봄, 처음으로 손을 든 날.',
        importance: 7, phaseTag: 'early',
      }],
      socialRipples: [],
      milestoneScenes: [{
        year: 2, sceneId: 'milestone-y2',
        summaryText: '처음으로 입은 교복이 조금 컸던 중1의 봄.',
        recordedAt: 48,
      }],
      rngSeed: 12345, hardCrisisYears: [],
    };
    localStorage.setItem('lifetrack_save', JSON.stringify({
      version: 1, state: yearEndState, savedAt: new Date().toISOString(),
    }));
  });
  consoleErrors.length = 0;
  pageErrors.length = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(500);
  // "이어서 하기" 버튼이 있을 수 있으니 타이틀 클릭해야 할 수 있음
  const loadBtn = await page.$('button');
  if (loadBtn) {
    const btnText = await page.evaluate(el => el.textContent, loadBtn);
    if (btnText && btnText.includes('이어')) await loadBtn.click();
  }
  await sleep(500);

  const yearEndText = await page.evaluate(() => document.body.innerText);
  assert('year-end 화면 "YEAR-END" 표시', yearEndText.includes('YEAR-END'));
  assert('year-end 화면 "중학교 1학년" 표시', yearEndText.includes('중학교 1학년'));
  assert('year-end 화면 memorySlot recallText 표시', yearEndText.includes('처음으로 손을 든 날'));
  assert('year-end 화면 milestone summaryText 표시', yearEndText.includes('처음으로 입은 교복'));
  assert('year-end 화면 "다음 학년으로" 버튼 표시', yearEndText.includes('다음 학년으로'));
  assert('year-end 화면 렌더 중 pageerror 없음', pageErrors.length === 0, pageErrors.join(' | '));
  assert('year-end 화면 렌더 중 console.error 없음', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  console.log('\n=== 5. 게임 상태 접근 (Zustand store via window hack) ===');
  // Zustand는 기본적으로 window 노출 안 하지만 번들 소스 기반으로 localStorage 검증은 가능
  // 세이브가 다시 저장되는지만 확인
  await sleep(500);
  const savedRaw = await page.evaluate(() => localStorage.getItem('lifetrack_save'));
  assert('localStorage 세이브 존재', !!savedRaw);
  if (savedRaw) {
    const saved = JSON.parse(savedRaw);
    // 앱이 로드 직후 저장을 다시 했으면 신규 필드가 채워져 있을 것
    // 아직 저장 안 했으면 원본 (빈 필드 상태) 유지
    // 어느 쪽이든 크래시 없이 동작했다는 것이 핵심
    assert('세이브 JSON 파싱 성공', typeof saved === 'object' && saved.state);
  }

  await browser.close();
  await stopPreview();

  console.log(`\n결과: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  await stopPreview();
  process.exit(1);
});
