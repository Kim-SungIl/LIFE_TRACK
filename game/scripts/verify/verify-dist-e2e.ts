// verify-dist-e2e.ts — 배포 산출물이 **브라우저에서 한 주를 실제로 도는가**. (build job 전용)
//
// `verify-dist-boot.ts`는 첫 화면(TitleScreen)만 본다 — 지연 청크는 부팅 때 아예 안 받아 오고
// (실측: JS 15개 중 8개), "그 화면이 런타임에 던진다"·"그 화면 전용 자산이 404"는 원리상 못 본다.
// 유닛 테스트 1600여 개는 jsdom이라 번들·경로·전환 순서를 안 지나간다. 그래서 여기서는
// 크로미움이 **플레이어가 하는 그대로** 한 주를 돈다:
//
//   타이틀(이어하기) → 이어하기 → 주간 화면 → 루틴 설정 → 주 확정(휴식 확인) →
//   [주중 이벤트가 뜨면 첫 선택지로 해결] → 결산 → 다음 주 → 세이브 확인 → 새로고침 → 이어하기 → 같은 주
//
// **결정론.** 새 게임은 시드가 시간 기반이라(`rng.ts` `startedAt ?? Date.now()`) 5회 중 1회
// 1주차 확정 직후 주중 이벤트가 먼저 떠 결산 대기가 흔들렸다. 그래서 새 게임 대신 **세이브
// 주입 → 이어하기**로 들어간다. 픽스처는 파일로 박지 않는다 — 실행 시점에 `src/engine`을
// 불러 `createInitialState({ rngSeed: 고정 })`로 만들고 스토어의 부팅 장면(first-week)까지 해결한
// 뒤, **스토어가 스스로 쓴 세이브 바이트**를 그대로 주입한다. 스키마가 바뀌면 자동으로 따라간다.
//
// **수치는 단언하지 않는다.** 스탯 값·변화량은 다른 작업이 바꾸는 중이다. 보는 것은 라벨·phase·
// week·세이브 존재·콘솔 에러 0·404 0뿐이다.
//
// **자기검사(양성 대조군).** 부정형 판정("콘솔 에러 0건")은 관측기·판정이 죽은 것과 구별되지
// 않는다. 건강한 통과 뒤 **두 번째 패스**에서 탐침을 심어 같은 판정이 그걸 말하는지 본다 —
// 탐침이 안 잡히면 자기검사 실패로 rc=1이고, 통과 수는 카운터에서 파생해 성공 줄에 싣는다.
//
// 실행: cd game && npx tsx scripts/verify/verify-dist-e2e.ts [dist]   (dist가 있어야 한다)
//
// **`verify-dist-` 접두가 규약이다.** `run-chain.ts`가 그 이름을 보고 체인에서 빼고(별도 러너라
// dist가 없다), `verify-ci-gates.ts`가 같은 집합에서 build job의 요구 스텝을 파생한다.
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { createServer, type Server } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join, extname, normalize } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
/** 볼 산출물. 인자로 다른 디렉터리를 줄 수 있다 — 스펙이 합성 dist·없는 dist에 대고 rc를 확인한다. */
const DIST = resolve(ROOT, process.argv[2] ?? 'dist');
/** `vite.config.ts`의 production base. 여기가 어긋나면 실서버에서 전부 404다. */
const BASE = '/LIFE_TRACK/';
/** 제품과 같은 값. 다르면 index.html이 안 실렸거나 덮인 것이다. */
const TITLE = '7년의 시간표';
/** 제품의 세이브 키·튜토리얼 영속 키(`store.ts` SAVE_KEY / `MainWeekScreen.tsx`). */
const SAVE_KEY = 'lifetrack_save';
const TUTORIAL_SEEN_KEY = 'lifetrack_tutorial_ever_seen';
/** 픽스처 시드. 값 자체는 아무래도 좋다 — 고정돼 있다는 것만 중요하다. */
const FIXTURE_SEED = 20260925;
/** 한 UI 상태를 기다리는 상한. CI 러너가 로컬의 2~3배 느리다. */
const WAIT = 15_000;

// ── 정적 서버 (verify-dist-boot.ts와 같은 모양 — 그 파일은 불변이라 복제한다) ────────────
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** 서버가 실제로 내준 것. 404는 **서버 쪽에서** 센다 — 브라우저 이벤트만 보면 캐시·중복에 휘둘린다. */
interface Served { readonly url: string; readonly status: number }

function startServer(): Promise<{ server: Server; port: number; served: Served[] }> {
  const served: Served[] = [];
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    const record = (status: number) => served.push({ url, status });
    if (!url.startsWith(BASE)) {
      record(404);
      res.writeHead(404).end('base 밖');
      return;
    }
    const rel = normalize(decodeURIComponent(url.slice(BASE.length)));
    if (rel.startsWith('..')) {
      record(403);
      res.writeHead(403).end('경로 이탈');
      return;
    }
    let file = join(DIST, rel);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      record(404);
      res.writeHead(404).end('없음');
      return;
    }
    record(200);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      .end(readFileSync(file));
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, port: typeof addr === 'object' && addr ? addr.port : 0, served });
    });
  });
}

// ── 관측·판정 (boot 게이트와 같은 판정부) ────────────────────────────────────────────────
interface Probe {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
}

function judgeSignals(probe: Probe, served: readonly Served[]): string[] {
  const out: string[] = [];
  if (probe.pageErrors.length) out.push(`페이지 예외 ${probe.pageErrors.length}건:\n    ${probe.pageErrors.join('\n    ')}`);
  if (probe.consoleErrors.length) out.push(`콘솔 에러 ${probe.consoleErrors.length}건:\n    ${probe.consoleErrors.join('\n    ')}`);
  if (probe.requestFailures.length) out.push(`요청 실패 ${probe.requestFailures.length}건:\n    ${probe.requestFailures.join('\n    ')}`);
  const bad = served.filter((s) => s.status >= 400);
  if (bad.length) {
    out.push(`산출물에 없는 것을 런타임이 요청한다 ${bad.length}건 (base 어긋남·webp 누락 계열):\n    ` +
      bad.slice(0, 15).map((b) => `${b.status} ${b.url}`).join('\n    '));
  }
  return out;
}

// ── 픽스처: 스토어가 쓴 세이브 바이트 ─────────────────────────────────────────────────────
interface Fixture {
  /** localStorage에 그대로 넣을 문자열 — 스토어의 `saveToStorage`가 쓴 것. */
  readonly raw: string;
  readonly year: number;
  readonly week: number;
  readonly version: number;
  /** 주간 화면·결산이 다는 주차 라벨 — 엔진의 같은 함수로 뽑는다(리터럴 금지). */
  readonly labelAt: (year: number, week: number) => string;
}

/**
 * Node에는 localStorage가 없거나(구버전) 파일 기반 실험 구현(25+)이라, 스토어가 쓰는 것을
 * 메모리에 받는 셈을 끼운다. **스토어를 import하기 전에** 끼워야 하므로 엔진은 동적 import다.
 */
async function buildFixture(): Promise<Fixture> {
  const mem = new Map<string, string>();
  const shim: Storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true, writable: true });

  const { createInitialState, getWeekLabelAt } = await import('../../src/engine/gameEngine');
  const { GAME_EVENTS } = await import('../../src/engine/events');
  const { assignCurrentEvent } = await import('../../src/engine/eventPresentation');
  const { useGameStore } = await import('../../src/engine/store');
  const { CURRENT_SAVE_VERSION } = await import('../../src/engine/stateMigration');

  // `startGame`과 같은 흐름 — 다만 시드를 고정한다(startGame은 시드를 받지 않는다).
  const initial = createInitialState('male', ['emotional', 'wealth'], { rngSeed: FIXTURE_SEED });
  const firstScene = GAME_EVENTS.find((e) => e.id === 'first-week');
  if (!firstScene) throw new Error('픽스처 생성 실패 — 부팅 장면(first-week)이 GAME_EVENTS에 없다');
  assignCurrentEvent(initial, firstScene, firstScene.week ?? 1);
  useGameStore.setState({ state: initial, runDelta: null });
  // 부팅 장면 뒤에 chain이 붙을 수 있어 event phase가 끝날 때까지 첫 선택지로 소비한다.
  let guard = 0;
  while (useGameStore.getState().state?.phase === 'event' && guard++ < 20) useGameStore.getState().resolveEvent(0);

  const state = useGameStore.getState().state;
  if (!state || state.phase !== 'weekday') throw new Error(`픽스처 생성 실패 — 부팅 장면을 해결한 뒤 phase가 '${state?.phase}'다 (weekday여야 주간 화면으로 들어간다)`);
  const raw = mem.get(SAVE_KEY);
  if (!raw) throw new Error('픽스처 생성 실패 — 스토어가 세이브를 안 썼다 (subscribe → saveToStorage 경로가 달라졌나)');
  return { raw, year: state.year, week: state.week, version: CURRENT_SAVE_VERSION, labelAt: getWeekLabelAt };
}

// ── 시나리오 ──────────────────────────────────────────────────────────────────────────────
/**
 * 자기검사 탐침. 시나리오는 같은 코드를 돌리고, 탐침은 **페이지 초기화 스크립트 한 곳**에서만
 * 갈린다(아래 `seedScript`). 각 탐침은 판정 한 갈래를 겨눈다:
 *   console        — 콘솔 채널
 *   missing        — 서버 404 채널
 *   save-block     — "진행이 세이브에 실린다" 판정 (`Storage.prototype.setItem`이 세이브 키를 버린다)
 *   reload-corrupt — "새로고침 뒤 이어하기가 같은 주에 착지한다" 판정 (두 번째 로드에서 세이브를 픽스처로 되돌린다)
 */
// 탐침 종류의 **단일 출처**. SELF_CHECKS는 이 튜플을 키로 하는 Record라 한 종을 빼면 타입이 막고,
// 판정부는 이 길이로 "N/M"을 센다. 배열형이던 때는 통째로 비우면 `0/0`으로 rc=0이었다(3자 검수 M28).
const PROBE_KINDS = ['console', 'missing', 'save-block', 'reload-corrupt', 'reload-routine-lost'] as const;
type ProbeKind = typeof PROBE_KINDS[number];
/** 종류 수 — 리터럴 타입(5)이 아니라 number로 두어 아래 `=== 0` 가드가 타입 오류 없이 살아 있게 한다. */
const SELF_TOTAL: number = PROBE_KINDS.length;

const PROBE_CONSOLE = '__e2e-probe-console__';
const PROBE_ASSET = '__e2e-probe-missing__.json';

/** 판정 메시지. 자기검사가 이 문자열로 "판정이 말했는가"를 본다 — 바꾸면 SELF_CHECKS도 같이. */
const MSG = {
  noContinue: '이어하기 버튼이 없다 — 주입한 세이브를 타이틀이 못 읽었다',
  continueLabel: '이어하기 라벨이 저장된 주와 다르다',
  routineNotSaved: '루틴 설정이 세이브에 안 실렸다',
  roundtrip: '새로고침 뒤 이어하기가 다른 주에 착지했다',
} as const;

/**
 * 페이지 초기화 스크립트. 매 내비게이션(새로고침 포함)마다 페이지 스크립트보다 먼저 돈다.
 * 세이브 주입은 **탭당 한 번**이다(sessionStorage 표식) — 매번 넣으면 새로고침이 제품이 쓴
 * 2주차 세이브를 픽스처(1주차)로 덮어 "세이브 왕복"이 공허해진다.
 * Playwright가 직렬화해 페이지로 보내므로 바깥 변수를 닫아 쓸 수 없다 — 전부 인자로 받는다.
 */
function seedScript(a: { save: string; saveKey: string; seenKey: string; probe: ProbeKind | null; missingUrl: string; consoleMarker: string }) {
  try {
    localStorage.setItem(a.seenKey, '1');
    const seeded = sessionStorage.getItem('__e2e_seeded__');
    if (!seeded) {
      localStorage.setItem(a.saveKey, a.save);
      sessionStorage.setItem('__e2e_seeded__', '1');
    } else if (a.probe === 'reload-corrupt') {
      localStorage.setItem(a.saveKey, a.save);
    } else if (a.probe === 'reload-routine-lost') {
      // 좌표(연·주·phase)는 그대로 두고 루틴만 지운다 — "세이브 왕복"이 좌표만 보면 못 잡는 모양.
      const raw = localStorage.getItem(a.saveKey);
      if (raw) {
        const j = JSON.parse(raw);
        if (j && j.state) { j.state.routineSlot2 = null; localStorage.setItem(a.saveKey, JSON.stringify(j)); }
      }
    }
    if (a.probe === 'save-block') {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (k === a.saveKey) return;
        orig.call(this, k, v);
      };
    }
    if (a.probe === 'console') window.addEventListener('DOMContentLoaded', () => { console.error(a.consoleMarker); });
    if (a.probe === 'missing') window.addEventListener('DOMContentLoaded', () => { fetch(a.missingUrl).catch(() => {}); });
  } catch { /* 저장소가 막힌 브라우저 — 그러면 이어하기가 없어서 첫 단계가 말한다 */ }
}

interface StepRow { readonly name: string; readonly ms: number; readonly note: string; readonly ok: boolean }

interface Outcome {
  readonly problems: string[];
  readonly steps: StepRow[];
  /** 이 시나리오가 서버에서 받아 간 요청 수 · JS 청크 수. */
  readonly requests: number;
  readonly chunks: number;
}

/** 세이브에서 보는 좌표 — 수치는 안 읽는다. */
interface SaveView { readonly phase: string; readonly year: number; readonly week: number; readonly routineSlot2: string | null }

async function runScenario(browser: Browser, served: Served[], fx: Fixture, port: number, probeKind: ProbeKind | null): Promise<Outcome> {
  const problems: string[] = [];
  const steps: StepRow[] = [];
  const servedFrom = served.length;
  const origin = `http://127.0.0.1:${port}`;
  const probe: Probe = { consoleErrors: [], pageErrors: [], requestFailures: [] };

  let context: BrowserContext | undefined;
  try {
    // 세로 폰 뷰포트. 이 게임의 1급 화면이고, 좁은 폭에서 하단 고정 CTA·다이얼로그 스택이 실제로 겹친다.
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(seedScript, {
      save: fx.raw, saveKey: SAVE_KEY, seenKey: TUTORIAL_SEEN_KEY, probe: probeKind,
      missingUrl: `${origin}${BASE}${PROBE_ASSET}`, consoleMarker: PROBE_CONSOLE,
    });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') probe.consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => probe.pageErrors.push(e.message));
    page.on('requestfailed', (r) => probe.requestFailures.push(`${r.url()} — ${r.failure()?.errorText}`));

    const bodyText = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const readSave = async (): Promise<SaveView | null> => {
      const raw = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw).state;
      return { phase: s.phase, year: s.year, week: s.week, routineSlot2: s.routineSlot2 ?? null };
    };
    const continueButton = () => page.locator('button', { hasText: '이어하기' }).first();
    const confirmButton = () => page.locator('[data-tutorial="confirm"] button');
    const nextWeekButton = () => page.locator('button', { hasText: '다음 주로 →' });
    const eventContinue = () => page.locator('button', { hasText: '계속 →' });
    const choiceButtons = () => page.locator('button.btn-reset:not([aria-label]):not([disabled])');
    const pagerNext = () => page.locator('button[aria-label="다음 페이지"]');
    const continueLabel = (year: number, week: number) => `${year}년차 ${week}주차`;

    /** 이벤트 한 장면을 끝까지 — 페이지 넘김 → 첫 선택지 → 결과 "계속 →". */
    const playEvent = async (): Promise<string> => {
      let pages = 0;
      for (let i = 0; i < 16; i++) {
        const nav = pagerNext();
        if (await nav.count() === 0 || !(await nav.first().isEnabled())) break;
        await nav.first().click();
        pages++;
        await page.waitForTimeout(100);
      }
      const hint = page.locator('button', { hasText: '골라볼게요!' });
      if (await hint.count() > 0 && await hint.first().isVisible()) throw new Error('첫 선택 안내가 떴다 — 튜토리얼 영속 키 주입이 안 먹었다');
      await choiceButtons().first().waitFor({ state: 'visible', timeout: WAIT });
      const n = await choiceButtons().count();
      // 선택지 fade-up(0.3s + stagger) 뒤에 누른다.
      await page.waitForTimeout(400);
      await choiceButtons().first().click();
      await eventContinue().first().waitFor({ state: 'visible', timeout: WAIT });
      await eventContinue().first().click();
      return `pages+${pages} choices=${n}`;
    };

    /**
     * 지금 화면이 무엇인가 — DOM 마커 + 세이브 phase. 선택지는 마지막 페이지 전엔 `display:none`이라
     * visible 대기로는 못 가르고, 화면 전환 페이드 중엔 옛 버튼이 잠깐 남는다 — 호출부가 detach를 먼저 기다린다.
     */
    type Where = 'main' | 'result' | 'year-end' | 'event-result' | 'event' | 'ending';
    const whereAmI = async (): Promise<Where> => {
      for (let i = 0; i < 60; i++) {
        if (await confirmButton().count()) return 'main';
        if (await nextWeekButton().count()) return 'result';
        if (await page.locator('button.ye-cta').count()) return 'year-end';
        if (await eventContinue().count()) return 'event-result';
        const s = await readSave();
        if (s?.phase === 'ending') return 'ending';
        if (s?.phase === 'event' && (await choiceButtons().count() || await pagerNext().count())) return 'event';
        await page.waitForTimeout(200);
      }
      throw new Error('화면 판별 실패 — 아는 마커가 하나도 없다');
    };

    const labelW1 = fx.labelAt(fx.year, fx.week);
    const labelW2 = fx.labelAt(fx.year, fx.week + 1);
    let before: SaveView | null = null;
    let savedRaw = '';

    const plan: ReadonlyArray<{ name: string; run: () => Promise<string> }> = [
      { name: '부팅(이어하기 있음)', run: async () => {
        const res = await page.goto(`${origin}${BASE}`, { waitUntil: 'networkidle', timeout: 60_000 });
        if (res?.status() !== 200) throw new Error(`첫 응답이 ${res?.status()}다 — index.html을 못 받았다`);
        const title = await page.title();
        if (title !== TITLE) throw new Error(`<title>이 '${title}'이다 — index.html이 안 실렸거나 덮였다`);
        try { await continueButton().waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(MSG.noContinue); }
        const text = (await continueButton().innerText()).replace(/\s+/g, ' ');
        const want = continueLabel(fx.year, fx.week);
        if (!text.includes(want)) throw new Error(`${MSG.continueLabel}: "${text}" ≠ "${want}"`);
        return `"${text}"`;
      } },
      { name: '이어하기 → 주간 화면', run: async () => {
        await continueButton().click();
        await confirmButton().waitFor({ state: 'visible', timeout: WAIT });
        const skip = page.locator('button', { hasText: '건너뛰기' });
        if (await skip.count() > 0 && await skip.first().isVisible()) throw new Error('튜토리얼이 떴다 — 영속 키 주입이 안 먹었다');
        const text = await bodyText();
        if (!text.includes(labelW1)) throw new Error(`주간 화면에 "${labelW1}" 라벨이 없다`);
        const s = await readSave();
        if (s?.phase !== 'weekday' || s.week !== fx.week) throw new Error(`세이브가 주간 화면과 어긋난다: ${JSON.stringify(s)}`);
        return `"${labelW1}" 확정 버튼 "${(await confirmButton().innerText()).trim()}"`;
      } },
      { name: '루틴 설정(다이얼로그)', run: async () => {
        await page.locator('[data-tutorial="routine"] button:not([disabled])').first().click();
        // 다이얼로그 밖에도 aria-expanded(능력치 패널)·aria-pressed(🔊 토글)가 있다 — 오버레이 뒤라 클릭이 막힌다.
        const dlg = page.locator('[role="dialog"]').last();
        await dlg.waitFor({ state: 'visible', timeout: WAIT });
        await dlg.locator('button[aria-expanded]').first().click();
        const acts = dlg.locator('button[aria-pressed="false"]:not([disabled])').filter({ hasNotText: '수치' });
        await acts.first().waitFor({ state: 'visible', timeout: WAIT });
        const picked = (await acts.first().innerText()).trim().split('\n')[0];
        await acts.first().click();
        // routine1 → routine2(저녁) 팝업이 자동으로 열린다 → 닫기
        await dlg.getByText('저녁 활동').first().waitFor({ state: 'visible', timeout: WAIT });
        await dlg.locator('button[aria-label="닫기"]').first().click();
        await dlg.waitFor({ state: 'detached', timeout: WAIT });
        if (!(await confirmButton().isEnabled())) throw new Error(`루틴을 골랐는데 확정 버튼이 잠겨 있다: "${(await confirmButton().innerText()).trim()}"`);
        const s = await readSave();
        if (!s?.routineSlot2) throw new Error(`${MSG.routineNotSaved} — 세이브 ${JSON.stringify(s)}`);
        return `"${picked}"`;
      } },
      { name: '주 확정(휴식 확인) → 결산', run: async () => {
        await confirmButton().click();
        const rest = page.locator('button', { hasText: '쉬어갈게요' });
        let restDialog = false;
        try { await rest.first().waitFor({ state: 'visible', timeout: 2_000 }); restDialog = true; await rest.first().click(); } catch { /* 이미 확인한 브라우저 */ }
        await confirmButton().waitFor({ state: 'detached', timeout: WAIT });
        // 확정 직후 주중 이벤트가 먼저 뜰 수 있다 — 결산이 나올 때까지 상태로 판별한다.
        const midweek: string[] = [];
        for (let i = 0; i < 8; i++) {
          const where = await whereAmI();
          if (where === 'result') break;
          if (where === 'event') midweek.push(await playEvent());
          else if (where === 'event-result') await eventContinue().first().click();
          else throw new Error(`확정 뒤 예상 밖 화면: ${where}`);
        }
        await nextWeekButton().waitFor({ state: 'visible', timeout: WAIT });
        return `휴식확인=${restDialog ? '있음' : '없음'} 주중이벤트=${midweek.length}${midweek.length ? ` [${midweek.join(' | ')}]` : ''}`;
      } },
      { name: '결산 화면', run: async () => {
        const text = await bodyText();
        if (!text.includes(labelW1)) throw new Error(`결산에 "${labelW1}" 라벨이 없다`);
        const s = await readSave();
        if (s?.phase !== 'result') throw new Error(`결산 화면인데 세이브 phase가 '${s?.phase}'다`);
        return `"${labelW1}"`;
      } },
      { name: '다음 주로', run: async () => {
        await nextWeekButton().click();
        await nextWeekButton().waitFor({ state: 'detached', timeout: WAIT });
        await confirmButton().waitFor({ state: 'visible', timeout: WAIT });
        const s = await readSave();
        if (s?.phase !== 'weekday' || s.week !== fx.week + 1) throw new Error(`다음 주 세이브가 어긋난다: ${JSON.stringify(s)}`);
        const text = await bodyText();
        if (!text.includes(labelW2)) throw new Error(`주간 화면에 "${labelW2}" 라벨이 없다`);
        return `"${labelW2}"`;
      } },
      { name: '세이브 필드 확인', run: async () => {
        const raw = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
        if (!raw) throw new Error('세이브가 없다 — 진행이 저장되지 않았다');
        if (raw === fx.raw) throw new Error('세이브가 주입한 픽스처 그대로다 — 진행이 한 번도 저장되지 않았다');
        const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; state?: { phase?: unknown; year?: unknown; week?: unknown } };
        if (parsed.version !== fx.version) throw new Error(`세이브 version이 ${String(parsed.version)}다 — 엔진의 CURRENT_SAVE_VERSION은 ${fx.version}`);
        if (typeof parsed.savedAt !== 'string' || Number.isNaN(Date.parse(parsed.savedAt))) throw new Error(`savedAt이 시각이 아니다: ${String(parsed.savedAt)}`);
        if (!parsed.state || parsed.state.phase !== 'weekday' || parsed.state.week !== fx.week + 1) throw new Error(`세이브 state 좌표가 어긋난다: ${JSON.stringify(parsed.state && { phase: parsed.state.phase, year: parsed.state.year, week: parsed.state.week })}`);
        savedRaw = raw;
        before = await readSave();
        return `${raw.length}B version=${parsed.version} ${JSON.stringify(before)}`;
      } },
      { name: '새로고침 → 이어하기 → 같은 주', run: async () => {
        // 이 단계는 **모아서 말한다** — 라벨과 착지 좌표는 같은 사실의 두 시선이라, 먼저 걸린 것만
        // 던지면 나머지 검사가 지워져도 아무도 모른다(자기검사가 두 마커를 다 요구한다).
        const found: string[] = [];
        await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
        try { await continueButton().waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(`새로고침 뒤 ${MSG.noContinue}`); }
        const text = (await continueButton().innerText()).replace(/\s+/g, ' ');
        const want = continueLabel(before!.year, before!.week);
        if (!text.includes(want)) found.push(`${MSG.continueLabel}: "${text}" ≠ "${want}"`);
        await continueButton().click();
        await confirmButton().waitFor({ state: 'visible', timeout: WAIT });
        const after = await readSave();
        if (!after || after.year !== before!.year || after.week !== before!.week || after.phase !== before!.phase
          || after.routineSlot2 !== before!.routineSlot2) {
          found.push(`${MSG.roundtrip}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        }
        const body = await bodyText();
        if (!body.includes(labelW2)) found.push(`이어하기 뒤 주간 화면에 "${labelW2}" 라벨이 없다`);
        if (found.length) throw new Error(found.join(' / '));
        return `"${text}" → "${labelW2}" ${savedRaw.length}B`;
      } },
    ];

    for (const st of plan) {
      const t0 = Date.now();
      let note = '';
      let ok = true;
      try {
        note = await st.run();
      } catch (e) {
        ok = false;
        note = e instanceof Error ? e.message.split('\n')[0] : String(e);
        problems.push(`${st.name} 단계: ${note}`);
      }
      steps.push({ name: st.name, ms: Date.now() - t0, note, ok });
      // **단계마다 판정한다.** 마지막에 한 번만 보면 어느 단계가 냈는지 모르고, 탐침 패스가
      // 첫 단계에서 멈추지 못해 시간을 다 쓴다.
      for (const p of judgeSignals(probe, served.slice(servedFrom))) problems.push(`${st.name} 단계까지 — ${p}`);
      if (problems.length) break;
    }
    // 마지막 단계 뒤에 오는 요청(프리페치 계열)까지 관측창에 넣는다.
    if (!problems.length) {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(300);
      for (const p of judgeSignals(probe, served.slice(servedFrom))) problems.push(`마지막 — ${p}`);
    }
  } finally {
    await context?.close();
  }
  const mine = served.slice(servedFrom);
  return {
    problems, steps,
    requests: mine.length,
    chunks: new Set(mine.filter((s) => s.status === 200 && s.url.endsWith('.js')).map((s) => s.url)).size,
  };
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────────────────
/** 탐침마다 판정이 말해야 하는 문자열. 하나라도 빠지면 그 갈래는 죽은 것이다. */
const SELF_CHECKS: Readonly<Record<ProbeKind, { markers: readonly string[]; msg: string }>> = {
  console: { markers: [PROBE_CONSOLE], msg: '자기검사: 일부러 낸 콘솔 에러를 판정이 안 담았다 — 위 "콘솔 에러 0건"은 근거가 없다' },
  missing: { markers: [PROBE_ASSET], msg: '자기검사: 일부러 낸 404를 판정이 안 담았다 — 위 "404 0건"은 근거가 없다' },
  'save-block': { markers: [MSG.routineNotSaved], msg: '자기검사: 세이브 쓰기를 막았는데 판정이 안 잡았다 — "진행이 저장된다"는 근거가 없다' },
  'reload-corrupt': { markers: [MSG.continueLabel, MSG.roundtrip], msg: '자기검사: 새로고침에서 세이브를 되돌렸는데 판정이 안 잡았다 — "세이브 왕복"은 근거가 없다' },
  'reload-routine-lost': { markers: [MSG.roundtrip], msg: '자기검사: 새로고침에서 루틴만 지웠는데 판정이 안 잡았다 — "세이브 왕복"이 좌표만 보고 있다' },
};

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);
const fmtMs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function printSteps(label: string, steps: readonly StepRow[]) {
  console.log(`  ${label}`);
  steps.forEach((s, i) => console.log(`    ${s.ok ? '✓' : '✗'} ${i + 1}. ${s.name} ${String(s.ms).padStart(5)}ms  ${s.note}`));
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.log(`❌ ${DIST}/index.html이 없다 — 이 게이트는 배포 산출물을 본다. \`npm run build:release\` 먼저.`);
    process.exit(1);
  }
  const t0 = Date.now();
  const fx = await buildFixture();
  console.log(`배포 E2E — ${DIST}`);
  console.log(`  픽스처: 시드 ${FIXTURE_SEED} · ${fx.raw.length}B · ${fx.labelAt(fx.year, fx.week)} · version ${fx.version} (${fmtMs(Date.now() - t0)})`);

  const { server, port, served } = await startServer();
  let browser: Browser | undefined;
  let selfPassed = 0;
  let healthy: Outcome | undefined;
  let healthyMs = 0;
  try {
    browser = await chromium.launch();
    const t1 = Date.now();
    healthy = await runScenario(browser, served, fx, port, null);
    healthyMs = Date.now() - t1;
    printSteps(`정상 패스 ${fmtMs(healthyMs)} (요청 ${healthy.requests}건 · JS 청크 ${healthy.chunks}개)`, healthy.steps);
    for (const p of healthy.problems) fail(p);

    // **탐침은 정상 패스가 통과한 뒤에만 의미가 있다.** 이미 빨간 판정에 탐침을 얹으면 "말했다"가 공허하다.
    if (!problems.length) {
      // 종류가 0이면 아래 "N/M"이 0/0으로 공허하다 — 그 자체를 실패로 센다.
      if (SELF_TOTAL === 0) fail('자기검사 종류가 0개다 — 판정이 살아 있다는 근거가 없다');
      for (const probe of PROBE_KINDS) {
        const c = SELF_CHECKS[probe];
        const t2 = Date.now();
        const out = await runScenario(browser, served, fx, port, probe);
        const text = out.problems.join('\n');
        const missing = c.markers.filter((m) => !text.includes(m));
        const reached = out.steps.length;
        if (missing.length === 0) {
          selfPassed++;
          console.log(`    ✓ 자기검사 ${probe} — ${reached}단계에서 잡힘 (${fmtMs(Date.now() - t2)})`);
        } else {
          fail(`${c.msg} (빠진 마커: ${missing.join(', ')})\n    판정이 낸 말:\n    ${text || '(없음)'}`);
        }
      }
      // 루프가 비거나 일부만 돌면 위 카운터가 모자란다. 성공 줄의 "N/M"은 사람이 읽는 것이고,
      // rc는 여기서 낸다 — 이 줄이 없으면 루프를 비우는 한 줄 편집이 `0/5`를 찍고도 초록이다.
      if (selfPassed !== SELF_TOTAL) fail(`자기검사가 ${selfPassed}/${SELF_TOTAL}종만 돌았다 — 나머지 판정은 근거가 없다`);
    }
  } finally {
    await browser?.close();
    server.close();
  }

  if (problems.length) {
    console.log(`\n❌ 배포 산출물이 브라우저에서 한 주를 못 돈다 — ${problems.length}건\n`);
    for (const p of problems) console.log(`  · ${p}`);
    console.log('\n  첫 화면 게이트(verify:dist-boot)는 여기서 실패한 화면을 원리상 못 본다.');
    process.exit(1);
  }
  console.log(`\n✅ 배포 E2E — 이어하기→루틴→확정→결산→다음 주→새로고침→이어하기 ${healthy?.steps.length}단계 ${fmtMs(healthyMs)}, 콘솔 에러·404 0건 (요청 ${healthy?.requests}건 / JS 청크 ${healthy?.chunks}개 / 자기검사 ${selfPassed}/${SELF_TOTAL}종 통과 / 전체 ${fmtMs(Date.now() - t0)})`);
  process.exit(0);
}

await main();
