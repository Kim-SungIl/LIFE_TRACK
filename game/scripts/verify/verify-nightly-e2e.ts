// verify-nightly-e2e.ts — 배포 산출물의 **후반부**를 브라우저에서 실제로 지나간다. (나이틀리 전용)
//
// `verify-dist-e2e.ts`는 PR 게이트라서 **한 주**만 돈다(로컬 16.8초). 그 한 주에서 구조적으로
// 빠지는 것이 셋이다:
//   · **주중 사건이 0건**이다 — 실측으로도 그 시나리오의 4단계 note는 늘 `주중이벤트=0`이다.
//     즉 이벤트 화면 청크·선택지·이벤트 결과 화면·결산 반영을 **배포본에서 한 번도 안 밟는다**.
//   · **학년말(year-end)** 화면은 한 판에 6번뿐이고 48주 뒤에야 온다.
//   · **엔딩·기록실**은 336주를 지나야 열린다. 둘 다 lazy 청크라 부팅 번들에 없고
//     (`GameScreen`의 `EndingScreen`/`TitleScreen`의 `ArchiveScreen`), 유닛 테스트는 jsdom이라
//     번들·경로·청크 로딩을 원리상 안 지나간다.
//
// 그래서 여기서는 **엔진으로 미리 한 판을 끝까지 돌려** 그 좌표의 세이브 바이트를 만들고,
// 크로미움이 그 네 지점을 실제로 지나간다:
//
//   ① 주중 사건 — 이어하기 → 주 확정 → **이벤트 화면** → 선택지 → 결과 → **결산에 그 문장이 실렸나**
//   ② 학년말   — 이어하기 → **학년말 일기장** → 다음 학년 → 새 학년 1주차
//   ③ 엔딩·기록실 — 엔딩 다시 보기 → **엔딩 화면** → 타이틀로 → **기록실** → 돌아가기
//
// **왜 PR 게이트에 안 넣나.** 픽스처를 만드느라 엔진으로 한 판(336주)을 돌리고, 브라우저
// 컨텍스트를 9번(정상 3 + 탐침 6) 띄운다. PR마다 이걸 얹으면 `build` job이 그만큼 길어진다.
// main 브랜치 보호의 required check는 `build`·`content-verify` 둘뿐이고 **여기 잡은 그 목록에
// 들어가면 안 된다** — 그래서 별도 워크플로(`.github/workflows/nightly.yml`)의
// `schedule` 트리거로만 돈다. `pull_request`로 도는 것은 `verify-ci-gates`가 금지한다.
//
// **`verify-nightly-` 접두가 규약이다.** `run-chain.ts`가 그 이름을 보고 체인에서 빼고
// (별도 러너라 dist가 없다), `verify-ci-gates.ts`가 같은 집합에서 나이틀리 job의 요구 스텝을
// 파생한다 — 만들고 워크플로에 안 붙이는 반대 방향도 같이 잡힌다.
//
// **결정론.** 새 게임은 시드가 시간 기반이라(`rng.ts`) 매번 다른 판이 된다. 그래서 픽스처는
// `createInitialState({ rngSeed: 고정 })`으로 만들고, 브라우저가 할 조작(주말 비움 · 루틴 고정)을
// 엔진에서 **같은 순서로** 재현해 만든다. 실측 대조: PR 게이트가 한 주를 돌고 남긴 세이브
// (6157B · Y1 W2 · routineSlot2=self-study)와 여기 픽스처 빌더의 같은 좌표 산출물이 좌표·루틴·
// 길이까지 같다(`savedAt`만 실행 시각이라 다르다). 브라우저가 밟는 길과 엔진이 미리 밟은 길이 하나다.
//
// **수치는 단언하지 않는다.** 스탯 값·이벤트 id·엔딩 등급은 다른 작업이 바꾸는 중이다.
// 보는 것은 화면 도달 · 좌표 전이 · "사건 문장이 결산에 실렸나" · 콘솔 에러 0 · 404 0뿐이고,
// 기대값은 전부 **엔진에서 파생**한다(리터럴 금지).
//
// **자기검사(양성 대조군).** 부정형 판정("콘솔 에러 0건")도, 도달 판정("엔딩 화면이 떴다")도
// 관측기가 죽은 것과 구별되지 않는다. 그래서 정상 패스가 통과한 뒤 **탐침 패스**를 돌린다 —
// 도달 판정에는 **그 화면에 닿을 수 없는 세이브**를 대신 주입해(음성 대조군) 판정이 실제로
// 말하는지 본다. 탐침이 안 잡히면 자기검사 실패로 rc=1이고, 통과 수는 카운터에서 파생한다.
//
// 실행: cd game && npx tsx scripts/verify/verify-nightly-e2e.ts [dist]   (dist가 있어야 한다)
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { createServer, type Server } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join, extname, normalize } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
/** 볼 산출물. 인자로 다른 디렉터리를 줄 수 있다. */
const DIST = resolve(ROOT, process.argv[2] ?? 'dist');
/** `vite.config.ts`의 production base. 여기가 어긋나면 실서버에서 전부 404다. */
const BASE = '/LIFE_TRACK/';
/** 제품과 같은 값. 다르면 index.html이 안 실렸거나 덮인 것이다. */
const TITLE = '7년의 시간표';
/** 제품의 영속 키 — `store.ts` SAVE_KEY / `archive.ts` ARCHIVE_KEY / `MainWeekScreen.tsx`. */
const SAVE_KEY = 'lifetrack_save';
const ARCHIVE_KEY = 'lifetrack_archive';
const TUTORIAL_SEEN_KEY = 'lifetrack_tutorial_ever_seen';
/** 픽스처 시드. 값 자체는 아무래도 좋다 — 고정돼 있다는 것만 중요하다(PR 게이트와 같은 값). */
const FIXTURE_SEED = 20260925;
/** 한 UI 상태를 기다리는 상한. CI 러너가 로컬의 2~3배 느리다. */
const WAIT = 15_000;
/** 엔진 시뮬레이션의 상한 — 한 판은 336주이고 이벤트 해결까지 세면 1000걸음 안쪽이다(실측 1006). */
const SIM_STEP_LIMIT = 4_000;

// ── 정적 서버 (verify-dist-e2e.ts와 같은 모양 — 그 파일은 최상위에서 main()을 await 하므로
//    import 하면 게이트가 통째로 돌아 버린다. 그래서 복제한다) ─────────────────────────────
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

// ── 관측·판정 ────────────────────────────────────────────────────────────────────────────
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

// ── 픽스처: 엔진으로 한 판을 끝까지 돌려 얻은 네 좌표의 세이브 바이트 ──────────────────────
interface SaveFixture {
  /** localStorage에 그대로 넣을 문자열 — 스토어의 `saveToStorage`가 쓴 것. */
  readonly raw: string;
  readonly year: number;
  readonly week: number;
  readonly phase: string;
}

interface Fixtures {
  /** 확정하면 **주중 사건이 뜨는** 주(weekday). */
  readonly eventWeek: SaveFixture;
  /** 확정해도 **사건이 안 뜨는** 주 — 도달 판정의 음성 대조군으로만 쓴다. */
  readonly quietWeek: SaveFixture;
  /** phase='year-end'. */
  readonly yearEnd: SaveFixture;
  /** phase='ending'. **여기서 state.year는 8이다**(엔딩 진입 때 year++). */
  readonly ending: SaveFixture;
  /** 그 판이 남긴 런간 기록 — 기록실 입구(hasArchive)의 근거. */
  readonly archiveRaw: string;
  readonly archive: { runs: number; events: number; talks: number; endings: string[] };
  /** 엔딩 화면이 낼 제목 — 엔진의 `calculateEnding`으로 뽑는다(리터럴 금지). */
  readonly endingTitle: string;
  readonly version: number;
  /** 주간 화면·결산이 다는 주차 라벨 — 엔진의 같은 함수로 뽑는다(리터럴 금지). */
  readonly labelAt: (year: number, week: number) => string;
  /** 커버리지 — 시뮬이 실제로 몇 걸음을 갔고 사건을 몇 번 봤나. */
  readonly simSteps: number;
  readonly midweekEventsSeen: number;
}

/** 시뮬이 이만큼은 가야 "한 판을 돌았다"고 말할 수 있다. corpus가 0이면 아래 단언이 공허해진다. */
const FLOOR_SIM_STEPS = 300;
const FLOOR_MIDWEEK_EVENTS = 10;

/**
 * Node에는 localStorage가 없거나(구버전) 파일 기반 실험 구현(25+)이라, 스토어가 쓰는 것을
 * 메모리에 받는 셈을 끼운다. **스토어를 import하기 전에** 끼워야 하므로 엔진은 동적 import다.
 */
async function buildFixtures(): Promise<Fixtures> {
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
  const { calculateEnding } = await import('../../src/engine/ending');

  // `startGame`과 같은 흐름 — 다만 시드를 고정한다(startGame은 시드를 받지 않는다).
  const initial = createInitialState('male', ['emotional', 'wealth'], { rngSeed: FIXTURE_SEED });
  const firstScene = GAME_EVENTS.find((e) => e.id === 'first-week');
  if (!firstScene) throw new Error('픽스처 생성 실패 — 부팅 장면(first-week)이 GAME_EVENTS에 없다');
  assignCurrentEvent(initial, firstScene, firstScene.week ?? 1);
  useGameStore.setState({ state: initial, runDelta: null });
  let guard = 0;
  while (useGameStore.getState().state?.phase === 'event' && guard++ < 20) useGameStore.getState().resolveEvent(0);

  const api = useGameStore.getState;
  const now = () => {
    const s = api().state;
    if (!s) throw new Error('픽스처 생성 실패 — 스토어에 state가 없다');
    return s;
  };
  const save = () => {
    const raw = mem.get(SAVE_KEY);
    if (!raw) throw new Error('픽스처 생성 실패 — 스토어가 세이브를 안 썼다 (subscribe → saveToStorage 경로가 달라졌나)');
    return raw;
  };
  const snap = (raw: string, year: number, week: number, phase: string): SaveFixture => ({ raw, year, week, phase });

  if (now().phase !== 'weekday') throw new Error(`픽스처 생성 실패 — 부팅 장면을 해결한 뒤 phase가 '${now().phase}'다`);

  // **브라우저가 할 조작을 엔진에서 같은 순서로 재현한다.** 루틴은 미리 박아 둔다 —
  // 그래야 브라우저가 루틴 다이얼로그를 건드리지 않고 곧장 확정할 수 있어 상태가 갈리지 않는다.
  // 'self-study'는 무료·해금 없음이라 어느 학년에서도 잠기지 않는다(activities.ts).
  api().setRoutine('self-study', null);

  let eventWeek: SaveFixture | null = null;
  let quietWeek: SaveFixture | null = null;
  let yearEnd: SaveFixture | null = null;
  let ending: SaveFixture | null = null;
  let midweekEventsSeen = 0;
  let steps = 0;

  while (steps++ < SIM_STEP_LIMIT) {
    const s = now();
    if (s.phase === 'ending') { ending = snap(save(), s.year, s.week, s.phase); break; }
    if (s.phase === 'year-end') {
      if (!yearEnd) yearEnd = snap(save(), s.year, s.week, s.phase);
      api().advanceFromYearEnd();
      continue;
    }
    if (s.phase === 'event') { api().resolveEvent(0); continue; }
    // 결산은 UI의 "다음 주로 →"가 하는 일과 같다(GameScreen: onContinue → setPhase('weekday')).
    if (s.phase === 'result') { api().setPhase('weekday'); continue; }

    const before = save();
    const { year, week } = s;
    // MainWeekScreen의 onConfirmWeek과 **같은 순서**다(주말 비움 · 동행 없음).
    api().setWeekendChoices([]);
    api().setNpcActivityMap({});
    api().recordWeekendPlan([], {});
    api().advanceWeek();
    const after = now();
    if (after.phase === 'event') {
      midweekEventsSeen++;
      if (!eventWeek) eventWeek = snap(before, year, week, 'weekday');
    } else if (!quietWeek && after.phase === 'result') {
      quietWeek = snap(before, year, week, 'weekday');
    }
  }

  // ── 픽스처 자기검사 ── 하나라도 못 만들면 아래 시나리오 전체가 공허해진다.
  // (#437 계열: corpus가 0건이면 게이트가 자기가 지워져도 초록이다.)
  if (!eventWeek) throw new Error('픽스처 생성 실패 — 한 판을 다 돌았는데 주중 사건이 뜨는 주가 하나도 없다');
  if (!quietWeek) throw new Error('픽스처 생성 실패 — 사건이 안 뜨는 주가 하나도 없다(음성 대조군을 만들 수 없다)');
  if (!yearEnd) throw new Error('픽스처 생성 실패 — 학년말(year-end) 좌표에 한 번도 안 닿았다');
  if (!ending) throw new Error(`픽스처 생성 실패 — ${steps}걸음 안에 엔딩에 못 닿았다 (phase='${now().phase}')`);
  if (eventWeek.year === quietWeek.year && eventWeek.week === quietWeek.week) {
    throw new Error('픽스처 생성 실패 — 사건 주와 조용한 주가 같은 좌표다(대조군이 대상을 소진한다)');
  }
  if (steps < FLOOR_SIM_STEPS) throw new Error(`픽스처 생성 실패 — 시뮬이 ${steps}걸음만 갔다(하한 ${FLOOR_SIM_STEPS})`);
  if (midweekEventsSeen < FLOOR_MIDWEEK_EVENTS) {
    throw new Error(`픽스처 생성 실패 — 한 판에서 주중 사건을 ${midweekEventsSeen}번만 봤다(하한 ${FLOOR_MIDWEEK_EVENTS})`);
  }

  const archiveRaw = mem.get(ARCHIVE_KEY);
  if (!archiveRaw) throw new Error('픽스처 생성 실패 — 엔딩까지 갔는데 런간 기록(lifetrack_archive)이 없다');
  const parsedArchive = JSON.parse(archiveRaw) as { runs: number; events: string[]; talks: string[]; endings: string[] };
  if (!(parsedArchive.runs > 0) || parsedArchive.events.length === 0) {
    throw new Error(`픽스처 생성 실패 — 기록이 비어 기록실 입구가 안 열린다: runs=${parsedArchive.runs} events=${parsedArchive.events.length}`);
  }
  const endingTitle = calculateEnding(JSON.parse(ending.raw).state).title;
  if (!endingTitle) throw new Error('픽스처 생성 실패 — 엔딩 제목이 빈 문자열이다');

  return {
    eventWeek, quietWeek, yearEnd, ending,
    archiveRaw,
    archive: {
      runs: parsedArchive.runs, events: parsedArchive.events.length,
      talks: parsedArchive.talks.length, endings: parsedArchive.endings,
    },
    endingTitle,
    version: CURRENT_SAVE_VERSION,
    labelAt: getWeekLabelAt,
    simSteps: steps,
    midweekEventsSeen,
  };
}

// ── 시나리오·탐침의 단일 출처 ─────────────────────────────────────────────────────────────
// 배열형이던 때는 통째로 비우면 `0/0종 통과`로 rc=0이었다(PR 게이트의 3자 검수 M28).
// 그래서 **튜플을 키로 하는 Record**다 — 한 종을 빼면 타입이 막고, 판정부는 이 길이로 "N/M"을 센다.
const SCENARIO_KINDS = ['midweek-event', 'year-end', 'ending-archive'] as const;
type ScenarioKind = typeof SCENARIO_KINDS[number];
/** 종류 수 — 리터럴 타입이 아니라 number로 두어 아래 `=== 0` 가드가 타입 오류 없이 살아 있게 한다. */
const SCENARIO_TOTAL: number = SCENARIO_KINDS.length;

const PROBE_KINDS = ['console', 'missing', 'quiet-week', 'not-year-end', 'not-ending', 'no-archive'] as const;
type ProbeKind = typeof PROBE_KINDS[number];
const SELF_TOTAL: number = PROBE_KINDS.length;

const PROBE_CONSOLE = '__nightly-probe-console__';
const PROBE_ASSET = '__nightly-probe-missing__.json';

/** 판정 메시지. 자기검사가 이 문자열로 "판정이 말했는가"를 본다 — 바꾸면 SELF_CHECKS도 같이. */
const MSG = {
  noContinue: '타이틀에 이어하기 버튼이 없다 — 주입한 세이브를 타이틀이 못 읽었다',
  noMidweekEvent: '주 확정 뒤 주중 사건이 0건이다 — 이벤트 화면을 배포본에서 한 번도 안 밟았다',
  eventNotInResult: '사건의 결과 문장이 결산에 없다',
  yearEndNotReached: '학년말(year-end) 화면에 못 닿았다',
  yearEndNotAdvanced: '학년말에서 다음 학년으로 못 넘어갔다',
  endingNotReached: '엔딩 화면에 못 닿았다',
  archiveNotReached: '기록실 화면에 못 닿았다',
} as const;

/**
 * 페이지 초기화 스크립트. 매 내비게이션마다 페이지 스크립트보다 먼저 돈다.
 * 주입은 **탭당 한 번**이다(sessionStorage 표식) — 매번 넣으면 제품이 쓴 진행을 픽스처로 덮는다.
 * Playwright가 직렬화해 페이지로 보내므로 바깥 변수를 닫아 쓸 수 없다 — 전부 인자로 받는다.
 */
function seedScript(a: {
  save: string; archive: string | null; saveKey: string; archiveKey: string; seenKey: string;
  probe: ProbeKind | null; missingUrl: string; consoleMarker: string;
}) {
  try {
    localStorage.setItem(a.seenKey, '1');
    if (!sessionStorage.getItem('__nightly_seeded__')) {
      localStorage.setItem(a.saveKey, a.save);
      if (a.archive === null) localStorage.removeItem(a.archiveKey);
      else localStorage.setItem(a.archiveKey, a.archive);
      sessionStorage.setItem('__nightly_seeded__', '1');
    }
    // **기록은 자가치유한다.** `store.loadSavedGame`이 `accrueFromState(loaded)`로 세이브의
    // state에서 본 이야기를 통째로 되쓴다(archive.ts). 그래서 키를 지우기만 하면 엔딩을 여는
    // 순간 기록이 되살아나 기록실 입구가 그대로 열린다(실측: 이 탐침이 처음엔 안 잡혔다).
    // 판정을 겨누려면 **쓰기까지** 막아야 한다. 매 내비게이션마다 다시 건다.
    if (a.probe === 'no-archive') {
      localStorage.removeItem(a.archiveKey);
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (k === a.archiveKey) return;
        orig.call(this, k, v);
      };
    }
    if (a.probe === 'console') window.addEventListener('DOMContentLoaded', () => { console.error(a.consoleMarker); });
    if (a.probe === 'missing') window.addEventListener('DOMContentLoaded', () => { fetch(a.missingUrl).catch(() => {}); });
  } catch { /* 저장소가 막힌 브라우저 — 그러면 첫 단계가 말한다 */ }
}

interface StepRow { readonly name: string; readonly ms: number; readonly note: string; readonly ok: boolean }

interface Outcome {
  readonly problems: string[];
  readonly steps: StepRow[];
  readonly requests: number;
  readonly chunks: number;
  /** 이 패스에서 실제로 밟은 주중 사건 수. 정상 패스에서 0이면 시나리오가 공허하다. */
  readonly eventsPlayed: number;
}

/** 세이브에서 보는 것 — 좌표와 진행 흔적만. 스탯 수치는 안 읽는다. */
interface SaveView {
  readonly phase: string; readonly year: number; readonly week: number;
  readonly routineSlot2: string | null;
  /** 해결된 이벤트 누적 수 — "사건의 결과가 상태에 반영됐나". */
  readonly resolvedEvents: number;
  /** 이번 주 결산 로그의 사건 문장(`📖 …`)들. */
  readonly storyLines: string[];
}

// ── 시나리오 ──────────────────────────────────────────────────────────────────────────────
interface Ctx {
  readonly page: import('playwright').Page;
  readonly origin: string;
  readonly fx: Fixtures;
  readonly bodyText: () => Promise<string>;
  readonly readSave: () => Promise<SaveView | null>;
  readonly whereAmI: () => Promise<Where>;
  readonly playEvent: () => Promise<string>;
  readonly bumpEvents: () => void;
}
type Where = 'title' | 'main' | 'result' | 'year-end' | 'event-result' | 'event' | 'ending' | 'archive';
interface Plan { readonly name: string; readonly run: (c: Ctx) => Promise<string> }

/** 세 시나리오의 단일 출처. Record라 한 종을 빼면 타입이 막는다. */
const SCENARIOS: Readonly<Record<ScenarioKind, { label: string; fixture: (fx: Fixtures) => SaveFixture; archive: boolean; plan: readonly Plan[] }>> = {
  // ① 주중 사건 — 확정 → 이벤트 화면 → 선택지 → 결과 → **결산에 그 문장이 실렸나**
  'midweek-event': {
    label: '주중 사건 → 결산 반영',
    fixture: (fx) => fx.eventWeek,
    archive: false,
    plan: [
      { name: '부팅(이어하기 있음)', run: async (c) => {
        const res = await c.page.goto(`${c.origin}${BASE}`, { waitUntil: 'networkidle', timeout: 60_000 });
        if (res?.status() !== 200) throw new Error(`첫 응답이 ${res?.status()}다 — index.html을 못 받았다`);
        const title = await c.page.title();
        if (title !== TITLE) throw new Error(`<title>이 '${title}'이다 — index.html이 안 실렸거나 덮였다`);
        try { await continueButton(c.page).waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(MSG.noContinue); }
        return `"${(await continueButton(c.page).innerText()).replace(/\s+/g, ' ')}"`;
      } },
      // **기대 라벨은 주입한 세이브가 아니라 브라우저가 읽은 세이브에서 파생한다.** 그래야
      // 음성 대조군(다른 좌표의 세이브)을 주입해도 여기서 먼저 걸리지 않고, 겨누는 판정까지 간다.
      { name: '이어하기 → 주간 화면', run: async (c) => {
        await continueButton(c.page).click();
        await confirmButton(c.page).waitFor({ state: 'visible', timeout: WAIT });
        const s = await c.readSave();
        if (!s) throw new Error('주간 화면인데 세이브가 없다');
        const label = c.fx.labelAt(s.year, s.week);
        if (!(await c.bodyText()).includes(label)) throw new Error(`주간 화면에 "${label}" 라벨이 없다`);
        if (!s.routineSlot2) throw new Error('픽스처에 박아 둔 루틴이 세이브에 없다 — 확정 버튼이 잠긴다');
        if (!(await confirmButton(c.page).isEnabled())) {
          throw new Error(`루틴이 있는데 확정 버튼이 잠겨 있다: "${(await confirmButton(c.page).innerText()).trim()}"`);
        }
        return `"${label}" 루틴="${s.routineSlot2}"`;
      } },
      { name: '주 확정 → 주중 사건', run: async (c) => {
        const before = await c.readSave();
        await confirmButton(c.page).click();
        const rest = c.page.locator('button', { hasText: '쉬어갈게요' });
        try { await rest.first().waitFor({ state: 'visible', timeout: 2_000 }); await rest.first().click(); } catch { /* 이미 확인한 브라우저 */ }
        await confirmButton(c.page).waitFor({ state: 'detached', timeout: WAIT });
        const played: string[] = [];
        for (let i = 0; i < 10; i++) {
          const where = await c.whereAmI();
          if (where === 'result') break;
          if (where === 'event') { played.push(await c.playEvent()); c.bumpEvents(); }
          else if (where === 'event-result') await eventContinue(c.page).first().click();
          else throw new Error(`확정 뒤 예상 밖 화면: ${where}`);
        }
        // **0건이면 이 시나리오가 존재할 이유가 없다.** 여기가 커버리지 하한이다.
        if (played.length === 0) throw new Error(MSG.noMidweekEvent);
        const after = await c.readSave();
        if (!after || !before || after.resolvedEvents <= before.resolvedEvents) {
          throw new Error(`사건을 밟았는데 세이브의 해결 이벤트 수가 안 늘었다: ${before?.resolvedEvents} → ${after?.resolvedEvents}`);
        }
        return `사건 ${played.length}건 [${played.join(' | ')}] 해결누적 ${before.resolvedEvents}→${after.resolvedEvents}`;
      } },
      { name: '결산에 사건 문장이 실렸다', run: async (c) => {
        await nextWeekButton(c.page).waitFor({ state: 'visible', timeout: WAIT });
        const s = await c.readSave();
        if (s?.phase !== 'result') throw new Error(`결산 화면인데 세이브 phase가 '${s?.phase}'다`);
        if (s.storyLines.length === 0) throw new Error(`${MSG.eventNotInResult} — 주간 로그에 📖 줄이 없다`);
        const body = await c.bodyText();
        const missing = s.storyLines.filter((line) => !body.includes(line.replace(/\s+/g, ' ')));
        if (missing.length) throw new Error(`${MSG.eventNotInResult}: ${missing.length}/${s.storyLines.length}줄 — 첫 줄 "${missing[0].slice(0, 40)}…"`);
        return `📖 ${s.storyLines.length}줄 전부 결산에 있다`;
      } },
      { name: '다음 주로', run: async (c) => {
        const before = await c.readSave();
        await nextWeekButton(c.page).click();
        await confirmButton(c.page).waitFor({ state: 'visible', timeout: WAIT });
        const after = await c.readSave();
        if (after?.phase !== 'weekday') throw new Error(`다음 주 세이브 phase가 '${after?.phase}'다`);
        const label = c.fx.labelAt(after.year, after.week);
        if (!(await c.bodyText()).includes(label)) throw new Error(`주간 화면에 "${label}" 라벨이 없다`);
        return `"${c.fx.labelAt(before!.year, before!.week)}" → "${label}"`;
      } },
    ],
  },

  // ② 학년말 — 한 판에 6번뿐이라 PR 게이트의 한 주로는 원리상 못 본다.
  'year-end': {
    label: '학년말 일기장 → 다음 학년',
    fixture: (fx) => fx.yearEnd,
    archive: false,
    plan: [
      { name: '부팅(이어하기 있음)', run: async (c) => {
        const res = await c.page.goto(`${c.origin}${BASE}`, { waitUntil: 'networkidle', timeout: 60_000 });
        if (res?.status() !== 200) throw new Error(`첫 응답이 ${res?.status()}다`);
        try { await continueButton(c.page).waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(MSG.noContinue); }
        return `"${(await continueButton(c.page).innerText()).replace(/\s+/g, ' ')}"`;
      } },
      { name: '이어하기 → 학년말 화면', run: async (c) => {
        await continueButton(c.page).click();
        const where = await c.whereAmI();
        if (where !== 'year-end') throw new Error(`${MSG.yearEndNotReached} — 지금 화면은 '${where}'다`);
        const s = await c.readSave();
        if (s?.phase !== 'year-end') throw new Error(`${MSG.yearEndNotReached} — 세이브 phase가 '${s?.phase}'다`);
        const cta = yearEndCta(c.page);
        await cta.first().waitFor({ state: 'visible', timeout: WAIT });
        const label = (await cta.first().innerText()).trim();
        if (!label) throw new Error('학년말 CTA에 글자가 없다');
        // 일기장 본문이 실제로 그려졌나 — 스태거 블록이 CTA 하나뿐이면 화면이 껍데기다.
        const blocks = await c.page.locator('.ye-stagger').count();
        if (blocks < 3) throw new Error(`학년말 화면의 본문 블록이 ${blocks}개뿐이다 — 일기장이 안 그려졌다`);
        return `${s.year}학년 마감 · 블록 ${blocks}개 · CTA "${label}"`;
      } },
      { name: '다음 학년 → 새 학년 1주차', run: async (c) => {
        const before = await c.readSave();
        await yearEndCta(c.page).first().click();
        // 대기 실패를 그대로 흘리면 판정문이 "Timeout 15000ms exceeded"가 된다 — 무엇이 깨졌는지
        // 말하지 않는다(실측: CTA의 onAdvance를 no-op으로 바꾼 뮤테이션이 그 메시지를 냈다).
        try { await confirmButton(c.page).waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(`${MSG.yearEndNotAdvanced} — 다음 학년 주간 화면이 안 떴다 (CTA가 학년을 안 넘긴다)`); }
        const after = await c.readSave();
        if (!after || after.phase !== 'weekday' || after.year !== before!.year + 1 || after.week !== 1) {
          throw new Error(`${MSG.yearEndNotAdvanced}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        }
        const label = c.fx.labelAt(after.year, after.week);
        if (!(await c.bodyText()).includes(label)) throw new Error(`새 학년 주간 화면에 "${label}" 라벨이 없다`);
        return `${before!.year}학년 → "${label}"`;
      } },
    ],
  },

  // ③ 엔딩·기록실 — 둘 다 lazy 청크라 부팅 번들에 없고, 336주를 지나야 열린다.
  'ending-archive': {
    label: '엔딩 → 타이틀 → 기록실',
    fixture: (fx) => fx.ending,
    archive: true,
    plan: [
      { name: '부팅(엔딩 다시 보기)', run: async (c) => {
        const res = await c.page.goto(`${c.origin}${BASE}`, { waitUntil: 'networkidle', timeout: 60_000 });
        if (res?.status() !== 200) throw new Error(`첫 응답이 ${res?.status()}다`);
        // 끝난 판의 입구는 "이어하기"가 아니라 "엔딩 다시 보기"다(TitleScreen: savedFinished).
        try { await replayButton(c.page).waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(`${MSG.endingNotReached} — 타이틀에 "엔딩 다시 보기"가 없다`); }
        return `"${(await replayButton(c.page).innerText()).replace(/\s+/g, ' ')}"`;
      } },
      { name: '엔딩 화면', run: async (c) => {
        await replayButton(c.page).click();
        const where = await c.whereAmI();
        if (where !== 'ending') throw new Error(`${MSG.endingNotReached} — 지금 화면은 '${where}'다`);
        const t = c.page.locator('.ending-title');
        await t.first().waitFor({ state: 'visible', timeout: WAIT });
        const shown = (await t.first().innerText()).trim();
        if (shown !== c.fx.endingTitle) throw new Error(`엔딩 제목이 엔진과 다르다: "${shown}" ≠ "${c.fx.endingTitle}"`);
        // 등급 두 칸(성취·행복)이 실제로 값을 들고 있나 — 껍데기 렌더 방지.
        const grades = await c.page.locator('.ending-grade-value').allInnerTexts();
        if (grades.length < 2 || grades.some((g) => !g.trim())) throw new Error(`엔딩 등급 칸이 ${JSON.stringify(grades)}다`);
        const s = await c.readSave();
        // 엔딩 진입에서 year++가 되어 여기 year는 8이다 — 이 값을 CG 해석에 쓰면 안 되는 자리.
        if (s?.phase !== 'ending') throw new Error(`엔딩 화면인데 세이브 phase가 '${s?.phase}'다`);
        return `"${shown}" 등급 ${grades.join('/')} (state.year=${s.year})`;
      } },
      { name: '타이틀로 → 기록실 입구', run: async (c) => {
        await c.page.locator('button', { hasText: '타이틀로' }).first().click();
        try { await archiveButton(c.page).waitFor({ state: 'visible', timeout: WAIT }); }
        catch { throw new Error(`${MSG.archiveNotReached} — 타이틀에 기록실 버튼이 없다(쌓인 기록이 없거나 타이틀이 못 읽었다)`); }
        return `"${(await archiveButton(c.page).innerText()).replace(/\s+/g, ' ')}"`;
      } },
      { name: '기록실 화면', run: async (c) => {
        await archiveButton(c.page).click();
        const where = await c.whereAmI();
        if (where !== 'archive') throw new Error(`${MSG.archiveNotReached} — 지금 화면은 '${where}'다`);
        const body = await c.bodyText();
        // 기대값은 전부 주입한 기록에서 파생한다 — 리터럴 수치를 박지 않는다.
        const want = [`지금까지 ${c.fx.archive.runs}번의 학창시절`, ...c.fx.archive.endings, String(c.fx.archive.events)];
        const missing = want.filter((w) => !body.includes(w));
        if (missing.length) throw new Error(`기록실이 주입한 기록과 다르다 — 빠진 것: ${missing.join(' / ')}`);
        return `완주 ${c.fx.archive.runs}회 · 결말 ${c.fx.archive.endings.length}종 · 이야기 ${c.fx.archive.events}종`;
      } },
      { name: '돌아가기 → 타이틀', run: async (c) => {
        await c.page.locator('button', { hasText: '돌아가기' }).first().click();
        await replayButton(c.page).waitFor({ state: 'visible', timeout: WAIT });
        const where = await c.whereAmI();
        if (where !== 'title') throw new Error(`돌아가기 뒤 화면이 '${where}'다`);
        return '타이틀 복귀';
      } },
    ],
  },
};

// ── 셀렉터 (제품의 마커) ──────────────────────────────────────────────────────────────────
type Page = import('playwright').Page;
const continueButton = (p: Page) => p.locator('button', { hasText: '이어하기' }).first();
const replayButton = (p: Page) => p.locator('button', { hasText: '엔딩 다시 보기' }).first();
const archiveButton = (p: Page) => p.locator('button', { hasText: '기록실' }).first();
const confirmButton = (p: Page) => p.locator('[data-tutorial="confirm"] button');
const nextWeekButton = (p: Page) => p.locator('button', { hasText: '다음 주로 →' });
const eventContinue = (p: Page) => p.locator('button', { hasText: '계속 →' });
const choiceButtons = (p: Page) => p.locator('button.btn-reset:not([aria-label]):not([disabled])');
const pagerNext = (p: Page) => p.locator('button[aria-label="다음 페이지"]');
const yearEndCta = (p: Page) => p.locator('button.ye-cta');

async function runScenario(browser: Browser, served: Served[], fx: Fixtures, port: number, kind: ScenarioKind, probeKind: ProbeKind | null): Promise<Outcome> {
  const scenario = SCENARIOS[kind];
  const problems: string[] = [];
  const steps: StepRow[] = [];
  const servedFrom = served.length;
  const origin = `http://127.0.0.1:${port}`;
  const probe: Probe = { consoleErrors: [], pageErrors: [], requestFailures: [] };
  let eventsPlayed = 0;

  // **탐침은 주입 바이트만 바꾼다.** 시나리오 코드는 정상 패스와 한 글자도 다르지 않다 —
  // 대조군이 다른 코드를 돌면 "판정이 살아 있다"의 증거가 아니다.
  const saveFixture = (probeKind === 'quiet-week' || probeKind === 'not-year-end' || probeKind === 'not-ending')
    ? fx.quietWeek : scenario.fixture(fx);
  const archiveRaw = (scenario.archive && probeKind !== 'no-archive') ? fx.archiveRaw : null;

  let context: BrowserContext | undefined;
  try {
    // 세로 폰 뷰포트. 이 게임의 1급 화면이고, 좁은 폭에서 하단 고정 CTA·다이얼로그 스택이 실제로 겹친다.
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(seedScript, {
      save: saveFixture.raw, archive: archiveRaw, saveKey: SAVE_KEY, archiveKey: ARCHIVE_KEY,
      seenKey: TUTORIAL_SEEN_KEY, probe: probeKind,
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
      return {
        phase: s.phase, year: s.year, week: s.week, routineSlot2: s.routineSlot2 ?? null,
        resolvedEvents: Array.isArray(s.events) ? s.events.length : -1,
        storyLines: ((s.weekLog?.messages ?? []) as string[]).filter((m) => m.startsWith('📖 ')).map((m) => m.slice(2).trim()),
      };
    };

    /** 이벤트 한 장면을 끝까지 — 페이지 넘김 → 첫 선택지 → (가벼운 사건이면 결과 화면이 생략된다). */
    const playEvent = async (): Promise<string> => {
      let pages = 0;
      for (let i = 0; i < 16; i++) {
        const nav = pagerNext(page);
        if (await nav.count() === 0 || !(await nav.first().isEnabled())) break;
        await nav.first().click();
        pages++;
        await page.waitForTimeout(100);
      }
      const hint = page.locator('button', { hasText: '골라볼게요!' });
      if (await hint.count() > 0 && await hint.first().isVisible()) throw new Error('첫 선택 안내가 떴다 — 튜토리얼 영속 키 주입이 안 먹었다');
      await choiceButtons(page).first().waitFor({ state: 'visible', timeout: WAIT });
      const n = await choiceButtons(page).count();
      // 선택지 fade-up(0.3s + stagger) 뒤에 누른다.
      await page.waitForTimeout(400);
      await choiceButtons(page).first().click();
      // 가벼운 사건(light-result)은 결과 화면을 건너뛰고 곧장 결산으로 간다 — 둘 다 받는다.
      for (let i = 0; i < 60; i++) {
        if (await eventContinue(page).count()) { await eventContinue(page).first().click(); return `pages+${pages} choices=${n}`; }
        if (await nextWeekButton(page).count()) return `pages+${pages} choices=${n} (결과화면 생략)`;
        await page.waitForTimeout(200);
      }
      throw new Error('선택 뒤 결과 화면도 결산도 안 나왔다');
    };

    /**
     * 지금 화면이 무엇인가 — DOM 마커 + 세이브 phase. 선택지는 마지막 페이지 전엔 `display:none`이라
     * visible 대기로는 못 가르고, 화면 전환 페이드 중엔 옛 버튼이 잠깐 남는다.
     */
    const whereAmI = async (): Promise<Where> => {
      for (let i = 0; i < 80; i++) {
        if (await page.locator('.ending-title').count()) return 'ending';
        if (await yearEndCta(page).count()) return 'year-end';
        if (await confirmButton(page).count()) return 'main';
        if (await nextWeekButton(page).count()) return 'result';
        if (await eventContinue(page).count()) return 'event-result';
        // 기록실은 타이틀의 곁가지라 세이브 phase로 못 가른다 — 화면 고유 문구로 본다.
        if (await page.locator('button', { hasText: '새 학창시절 시작하기' }).count()) return 'archive';
        const s = await readSave();
        if (s?.phase === 'event' && (await choiceButtons(page).count() || await pagerNext(page).count())) return 'event';
        if (await replayButton(page).count() || await continueButton(page).count()) return 'title';
        await page.waitForTimeout(200);
      }
      throw new Error('화면 판별 실패 — 아는 마커가 하나도 없다');
    };

    const ctx: Ctx = { page, origin, fx, bodyText, readSave, whereAmI, playEvent, bumpEvents: () => { eventsPlayed++; } };

    for (const st of scenario.plan) {
      const t0 = Date.now();
      let note = '';
      let ok = true;
      try {
        note = await st.run(ctx);
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
    problems, steps, eventsPlayed,
    requests: mine.length,
    chunks: new Set(mine.filter((s) => s.status === 200 && s.url.endsWith('.js')).map((s) => s.url)).size,
  };
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────────────────
/** 탐침마다 (어느 시나리오에) 심고, 판정이 무엇을 말해야 하는가. 하나라도 빠지면 그 갈래는 죽은 것이다. */
const SELF_CHECKS: Readonly<Record<ProbeKind, { scenario: ScenarioKind; markers: readonly string[]; msg: string }>> = {
  console: { scenario: 'midweek-event', markers: [PROBE_CONSOLE], msg: '자기검사: 일부러 낸 콘솔 에러를 판정이 안 담았다 — 위 "콘솔 에러 0건"은 근거가 없다' },
  missing: { scenario: 'midweek-event', markers: [PROBE_ASSET], msg: '자기검사: 일부러 낸 404를 판정이 안 담았다 — 위 "404 0건"은 근거가 없다' },
  'quiet-week': { scenario: 'midweek-event', markers: [MSG.noMidweekEvent], msg: '자기검사: 사건이 안 뜨는 주를 주입했는데 판정이 "사건 0건"을 말하지 않았다 — 이 시나리오가 사건을 밟았다는 근거가 없다' },
  'not-year-end': { scenario: 'year-end', markers: [MSG.yearEndNotReached], msg: '자기검사: 학년말이 아닌 세이브를 주입했는데 판정이 안 잡았다 — "학년말 화면이 떴다"는 근거가 없다' },
  'not-ending': { scenario: 'ending-archive', markers: [MSG.endingNotReached], msg: '자기검사: 엔딩이 아닌 세이브를 주입했는데 판정이 안 잡았다 — "엔딩 화면이 떴다"는 근거가 없다' },
  'no-archive': { scenario: 'ending-archive', markers: [MSG.archiveNotReached], msg: '자기검사: 런간 기록을 비웠는데 판정이 안 잡았다 — "기록실이 떴다"는 근거가 없다' },
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
  const fx = await buildFixtures();
  console.log(`나이틀리 배포 E2E — ${DIST}`);
  console.log(`  픽스처: 시드 ${FIXTURE_SEED} · 엔진 ${fx.simSteps}걸음(주중 사건 ${fx.midweekEventsSeen}회) · version ${fx.version} (${fmtMs(Date.now() - t0)})`);
  console.log(`    사건 주 ${fx.labelAt(fx.eventWeek.year, fx.eventWeek.week)} ${fx.eventWeek.raw.length}B · 조용한 주 ${fx.labelAt(fx.quietWeek.year, fx.quietWeek.week)} ${fx.quietWeek.raw.length}B`);
  console.log(`    학년말 Y${fx.yearEnd.year} ${fx.yearEnd.raw.length}B · 엔딩 "${fx.endingTitle}" ${fx.ending.raw.length}B · 기록 ${fx.archiveRaw.length}B(완주 ${fx.archive.runs}회)`);

  const { server, port, served } = await startServer();
  let browser: Browser | undefined;
  let selfPassed = 0;
  let scenariosRun = 0;
  let eventsPlayed = 0;
  let healthyMs = 0;
  try {
    browser = await chromium.launch();
    // 종류가 0이면 아래 "N/M"이 공허하다 — 그 자체를 실패로 센다.
    if (SCENARIO_TOTAL === 0) fail('시나리오가 0종이다 — 이 게이트는 아무것도 안 본다');
    for (const kind of SCENARIO_KINDS) {
      const t1 = Date.now();
      const out = await runScenario(browser, served, fx, port, kind, null);
      healthyMs += Date.now() - t1;
      eventsPlayed += out.eventsPlayed;
      printSteps(`${SCENARIOS[kind].label} ${fmtMs(Date.now() - t1)} (요청 ${out.requests}건 · JS 청크 ${out.chunks}개)`, out.steps);
      for (const p of out.problems) fail(`[${kind}] ${p}`);
      if (out.problems.length === 0) scenariosRun++;
    }
    // 루프가 비거나 일부만 돌면 카운터가 모자란다 — rc는 여기서 낸다.
    if (!problems.length && scenariosRun !== SCENARIO_TOTAL) {
      fail(`시나리오가 ${scenariosRun}/${SCENARIO_TOTAL}종만 돌았다`);
    }
    // 정상 패스가 사건을 한 번도 안 밟았으면 이 게이트의 존재 이유가 없다(커버리지 하한).
    if (!problems.length && eventsPlayed === 0) fail(MSG.noMidweekEvent);

    // **탐침은 정상 패스가 통과한 뒤에만 의미가 있다.** 이미 빨간 판정에 탐침을 얹으면 "말했다"가 공허하다.
    if (!problems.length) {
      if (SELF_TOTAL === 0) fail('자기검사 종류가 0개다 — 판정이 살아 있다는 근거가 없다');
      for (const kind of PROBE_KINDS) {
        const c = SELF_CHECKS[kind];
        const t2 = Date.now();
        const out = await runScenario(browser, served, fx, port, c.scenario, kind);
        const text = out.problems.join('\n');
        const missing = c.markers.filter((m) => !text.includes(m));
        if (missing.length === 0) {
          selfPassed++;
          console.log(`    ✓ 자기검사 ${kind} (${c.scenario}) — ${out.steps.length}단계에서 잡힘 (${fmtMs(Date.now() - t2)})`);
        } else {
          fail(`${c.msg} (빠진 마커: ${missing.join(', ')})\n    판정이 낸 말:\n    ${text || '(없음)'}`);
        }
      }
      if (selfPassed !== SELF_TOTAL) fail(`자기검사가 ${selfPassed}/${SELF_TOTAL}종만 돌았다 — 나머지 판정은 근거가 없다`);
    }
  } finally {
    await browser?.close();
    server.close();
  }

  if (problems.length) {
    console.log(`\n❌ 배포 산출물의 후반부가 브라우저에서 안 돈다 — ${problems.length}건\n`);
    for (const p of problems) console.log(`  · ${p}`);
    console.log('\n  한 주짜리 PR 게이트(verify:dist-e2e)는 여기서 실패한 화면을 원리상 못 본다.');
    process.exit(1);
  }
  console.log(`\n✅ 나이틀리 배포 E2E — 시나리오 ${scenariosRun}/${SCENARIO_TOTAL}종(주중 사건 ${eventsPlayed}건 실주행) ${fmtMs(healthyMs)}, 콘솔 에러·404 0건 (자기검사 ${selfPassed}/${SELF_TOTAL}종 통과 / 전체 ${fmtMs(Date.now() - t0)})`);
  process.exit(0);
}

await main();
