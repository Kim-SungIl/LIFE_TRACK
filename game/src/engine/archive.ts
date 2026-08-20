// ===== 런간 기록(archive) =====
// 세이브(lifetrack_save)는 "지금 진행 중인 한 판"이고, 이건 "지금까지의 모든 판"이다.
// 별도 키를 쓰는 이유: 새 게임을 시작하면 세이브는 덮어써지는데, 기록까지 같이 날아가면
// 이 기능이 존재할 이유가 없어진다. deleteSave()도 이 키는 건드리지 않는다.
//
// 왜 만들었나 (실측):
//   1회 플레이로 이벤트 218종 중 평균 157종(72%)을 본다. 그런데 같은 방식으로 한 판 더 하면
//   새로 보이는 건 1~5종뿐이고, **키우는 방식을 바꾸면 +72종**이 열린다.
//   그 72종의 92%가 NPC와 얽힌 이벤트다 — 즉 이 게임의 재플레이 가치는 "사람"에 있다.
//   그래서 기록은 평면적인 이벤트 갤러리가 아니라 **NPC 축**으로 조직한다.
//
// hide-numbers: raw 친밀도는 여기서도 숨긴다. 저장은 수치로 하되(티어 경계가 바뀌어도 재계산 가능)
//   화면에 나가는 건 이야기 커버리지뿐이고, 친밀도 수치 자체는 어디에도 노출되지 않는다.
//
// ===== v2: 적립 시점이 "엔딩"에서 "본 순간"으로 바뀌었다 =====
// v1은 엔딩 도달 시 1회만 적립했다. 그래서 **완주하지 않은 판은 아무것도 남지 않았다** —
// 7년 중 5년을 살고 그만두면 그동안 본 장면이 어디에도 없었다.
//
// v1이 즉시 적립을 거부한 근거 둘은 둘 다 무효로 판정됐다:
//   (1) "한 판에 300회 넘는 쓰기가 생긴다" — 이미 그렇다. store.ts의 subscribe가 **모든 상태
//       변경마다** GameState 전체를 동기로 쓴다(saveToStorage). 포화 archive는 20KB대인데
//       세이브는 100KB대이므로, 이미 일어나는 쓰기 옆에 훨씬 작은 것을 하나 더 얹는 일이다.
//       게다가 addTo 더티체크로 "새로 들어간 게 없으면 안 쓴다" — 2회차부터는 새로 보이는 게
//       1~5종뿐이라(위 실측) 쓰기 횟수가 스스로 0에 수렴한다.
//   (2) "이번 판 신규 카운트가 새로고침에 날아간다" — 방향이 거꾸로였다. 카운트를 archive 안
//       (pendingRun)에 두면 영속되므로, 오히려 v1에 있던 버그가 같이 고쳐진다: v1은 엔딩
//       화면에서 새로고침하면 runDelta가 메모리에서 사라져 "처음 본 이야기"가 조용히 없어졌다.
//
// 완주 게이트를 남기는 축은 runs / endings 둘뿐이다. runs는 이 스키마에서 **유일한 비멱등
// 필드**(+= 1)라 중복·재진입 위험이 전부 거기 모이고, 그걸 엔딩 전이 감지 한 곳에만 매달아
// 두면 위험 표면이 0이 된다. 나머지 축은 전부 집합이라 몇 번 적립해도 결과가 같다.
import type { GameState } from './types';
import { resolveEventCgRelPaths } from './eventCg';

const ARCHIVE_KEY = 'lifetrack_archive';
export const CURRENT_ARCHIVE_VERSION = 2;

/** 엔딩 화면이 보여줄 "이번 판" 요약. commitRun이 적립하면서 같이 계산해 돌려준다. */
export interface RunDelta {
  newEvents: number;      // 이번 판에서 처음 본 이야기
  newTalks: number;
  newEndingTitle: boolean; // 처음 도달한 엔딩인가
  runs: number;            // 완주 누적
}

export interface RunArchive {
  version: number;
  runs: number;                        // 엔딩까지 도달한 횟수 (완주 게이트)
  events: string[];                    // 본 적 있는 이벤트 id
  talks: string[];                     // 본 적 있는 말걸기 미니이벤트 id
  endings: string[];                   // 도달한 엔딩 타이틀 (완주 게이트 — 엔딩에만 값이 있다)
  parentEvents: string[];              // 본 적 있는 부모 미니이벤트 id + 절정('climax:{강점}')
  // v1 유산 — **동결**. 담긴 값은 이벤트 배경 키(공용 배경 56종)이고, 앨범이 쓰는 CG 파일
  // 경로와는 의미 단위가 달라 재해석이 불가능하다. 읽기만 하고 더 쌓지 않는다.
  cg: string[];
  cgFiles: string[];                   // 본 적 있는 CG 파일 상대경로 (앨범의 실제 축, 432장 중)
  npcPeak: Record<string, number>;     // NPC별 역대 최고 친밀도(런을 가로질러)
  // 이번 판에서 처음 본 것 — 엔딩까지 여기 모여 있다가 RunDelta로 정산되고 비워진다.
  // localStorage에 있으므로 새로고침·탭 종료를 넘어 살아남는다.
  pendingRun: { events: string[]; talks: string[] };
  // 마지막으로 정산된 RunDelta. 엔딩 화면에서 새로고침해도 요약이 유지되게 하는 유일한 근거다
  // (store의 runDelta는 메모리라 새로고침에 사라진다).
  lastRunDelta: RunDelta | null;
}

export function emptyArchive(): RunArchive {
  return {
    version: CURRENT_ARCHIVE_VERSION,
    runs: 0, events: [], talks: [], endings: [], parentEvents: [],
    cg: [], cgFiles: [], npcPeak: {},
    pendingRun: { events: [], talks: [] },
    lastRunDelta: null,
  };
}

/**
 * 손상·부재는 "빈 기록"으로 떨어진다. 기록은 진행에 필수가 아니므로 절대 던지지 않는다.
 *
 * ⚠️ 순서가 계약이다: **필드 읽기 → 버전 분기(migrate) → 재스탬프**.
 * v1은 파싱값과 무관하게 CURRENT를 박았는데, 그 상태로 CURRENT만 2로 올리면 v1 페이로드가
 * 내용 그대로 v2 상표를 달고 저장된다. 그러면 나중의 v2→v3 마이그레이션이 v1 데이터를 v2로
 * 착각하고, 그 손상은 되돌릴 수 없다. 재스탬프는 반드시 마이그레이션 뒤에 온다.
 */
export function loadArchive(): RunArchive {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return emptyArchive();
    const parsed = JSON.parse(raw) as Partial<RunArchive>;
    const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const peak: Record<string, number> = {};
    if (parsed.npcPeak && typeof parsed.npcPeak === 'object') {
      for (const [k, v] of Object.entries(parsed.npcPeak)) {
        if (typeof v === 'number' && Number.isFinite(v)) peak[k] = v;
      }
    }
    // 버전이 없거나 망가진 페이로드는 최초 스키마(v1)로 취급한다 — 아래 분기가 올려준다.
    const from = typeof parsed.version === 'number' && Number.isFinite(parsed.version)
      ? Math.floor(parsed.version) : 1;

    const a: RunArchive = {
      version: from,
      runs: typeof parsed.runs === 'number' && parsed.runs >= 0 ? Math.floor(parsed.runs) : 0,
      events: arr(parsed.events), talks: arr(parsed.talks), endings: arr(parsed.endings),
      parentEvents: arr(parsed.parentEvents),
      cg: arr(parsed.cg), cgFiles: arr(parsed.cgFiles),
      npcPeak: peak,
      pendingRun: {
        events: arr(parsed.pendingRun?.events),
        talks: arr(parsed.pendingRun?.talks),
      },
      lastRunDelta: readDelta(parsed.lastRunDelta),
    };

    migrateArchive(a, from);
    a.version = CURRENT_ARCHIVE_VERSION;   // 재스탬프는 마지막 — 위 주석 참조
    return a;
  } catch {
    return emptyArchive();
  }
}

function readDelta(v: Partial<RunDelta> | null | undefined): RunDelta | null {
  if (!v || typeof v !== 'object') return null;
  const num = (x: unknown): number => typeof x === 'number' && Number.isFinite(x) ? Math.floor(x) : 0;
  return {
    newEvents: num(v.newEvents), newTalks: num(v.newTalks),
    newEndingTitle: v.newEndingTitle === true, runs: num(v.runs),
  };
}

/**
 * 버전별 데이터 변환. 반드시 재스탬프 **전에** 호출된다.
 *
 * v1 → v2: **cg(배경 키)를 cgFiles로 옮기지 않는 것**이 이 단계의 내용이다. 배경 키(공용
 * 배경 56종)와 CG 파일 경로(432장) 사이에는 매핑이 존재하지 않아 재해석이 불가능하고,
 * 섞으면 앨범에 플레이어가 본 적 없는 그림이 들어간다. v1 기록자는 cgFiles가 빈 상태로
 * 시작하고 앨범은 이번 판부터 채워진다. 그리고 v1에는 신규 카운트 개념이 없었으므로
 * pendingRun/lastRunDelta는 비운다(망가진 페이로드가 들고 온 값도 여기서 버려진다).
 *
 * v3를 도입하면 여기에 `if (from < 3)`를 잇고, **v1 픽스처가 v3까지 관통하는** 테스트를
 * 같이 넣을 것. 분기를 지웠을 때 실패하는 단언이 없으면 이 함수는 잠긴 게 아니다.
 */
function migrateArchive(a: RunArchive, from: number): void {
  if (from < 2) {
    a.pendingRun = { events: [], talks: [] };
    a.lastRunDelta = null;
  }
}

// 저장 실패(용량 초과·프라이빗 모드)는 조용히 삼킨다 — 기록 때문에 플레이가 끊기면 안 된다.
function persist(a: RunArchive): void {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a)); } catch { /* 기록은 선택적 기능 */ }
}

function addTo(list: string[], id: string | undefined | null): boolean {
  if (!id || list.includes(id)) return false;
  list.push(id);
  return true;
}

/**
 * NPC 역대 최고 친밀도 갱신. **더티 판정에는 참여하지 않는다**(반환값이 없는 이유).
 *
 * 친밀도는 거의 매 주 오르내리므로 이걸 더티로 세면 더티체크가 무력해진다(판당 수백 회 쓰기).
 * 대신 다른 축이 새로 들어가 쓰기가 이미 일어나는 순간에 편승하고, 엔딩에서 한 번 더 확정한다.
 * 화면에 나가지 않는 원천 데이터라 몇 주 늦게 반영되는 건 대가로 받아들일 만하다.
 * (v1은 엔딩 시점 최종 친밀도만 봤다 — 친밀도는 Y2 정점 후 내려가므로 체계적 과소기록이었다.)
 */
function touchPeak(a: RunArchive, npcs: GameState['npcs']): void {
  for (const n of npcs) {
    if (!n.met) continue;
    if ((a.npcPeak[n.id] ?? -1) < n.intimacy) a.npcPeak[n.id] = n.intimacy;
  }
}

/**
 * CG 파일 해석 — **앨범 적립의 유일한 리졸버 호출지점**.
 *
 * 적립 단위가 이벤트 id도 (id, choiceIndex)도 아닌 "해석된 파일 경로"인 이유:
 * 같은 이벤트가 성별·선택지·학교급에 따라 다른 그림이 되고(성별 분기만 87건), 반대로 폴백
 * 체인이 여러 선택지를 한 파일로 접기도 한다. 경로를 키로 쓰면 **플레이어가 실제로 본 그림
 * 한 장**과 앨범 한 칸이 정확히 일치한다. 매니페스트 필터를 이미 통과한 값이므로 존재도 보장된다.
 * 부수 효과로 sentinel(-1) 선택지가 만드는 `_c-1_` 유령 변종이 자동으로 사라진다.
 *
 * year는 **발생 학년**이어야 한다. W48 이벤트는 결과 화면이 뜨기 전에 학년 전환이 끝나므로,
 * 전환 후 학년으로 해석하면 Y1→Y2(초등→중등)·Y4→Y5(중등→고등) 경계에서 플레이어가 본 적
 * 없는 학교급의 그림이 적립된다.
 */
function resolveCg(id: string, choiceIndex: number, gender: GameState['gender'], year: number): string | null {
  return resolveEventCgRelPaths(id, choiceIndex, gender, year)[0] ?? null;
}

/** 새로 들어간 것 하나를 pendingRun에도 반영 — "이번 판에서 처음"의 정의가 여기 한 곳에 있다. */
function record(a: RunArchive, pool: string[], pending: string[] | null, id: string | undefined | null): boolean {
  if (!addTo(pool, id)) return false;
  if (pending) addTo(pending, id!);
  return true;
}

/**
 * 정규 이벤트 해결 즉시 1회 — 방금 기록된 이벤트(state.events의 마지막 항목)를 적립한다.
 *
 * recordResolvedEvent 직후·학년 전환 전에 불러야 한다: 그 시점의 state.year가 발생 학년이고,
 * 마지막 항목에 resolvedChoice가 이미 박혀 있어 CG 해석에 필요한 것이 전부 손에 있다.
 */
export function accrueResolvedEvent(state: GameState): void {
  const e = state.events[state.events.length - 1];
  if (!e) return;
  const a = loadArchive();
  let dirty = record(a, a.events, a.pendingRun.events, e.id);
  const cg = resolveCg(e.id, e.resolvedChoice ?? 0, state.gender, e.year ?? state.year);
  if (addTo(a.cgFiles, cg)) dirty = true;
  touchPeak(a, state.npcs);
  if (dirty) persist(a);
}

/** 말걸기 미니이벤트 발동 즉시 1회. CG는 common/talk_*.png 8장이 이 경로로만 도달한다. */
export function accrueTalk(state: GameState, talkId: string): void {
  const a = loadArchive();
  let dirty = record(a, a.talks, a.pendingRun.talks, talkId);
  if (addTo(a.cgFiles, resolveCg(talkId, 0, state.gender, state.year))) dirty = true;
  touchPeak(a, state.npcs);
  if (dirty) persist(a);
}

/**
 * 부모 미니이벤트·절정 발동 즉시 1회.
 * v1에서는 이 축이 통째로 빠져 있었다 — talkEventsFired만 훑었기 때문에, 평생 1회짜리
 * 강점별 절정 장면이 기록에 단 하나도 남지 않았다.
 */
export function accrueParentEvent(state: GameState, id: string): void {
  const a = loadArchive();
  let dirty = addTo(a.parentEvents, id);
  if (addTo(a.cgFiles, resolveCg(id, 0, state.gender, state.year))) dirty = true;
  touchPeak(a, state.npcs);
  if (dirty) persist(a);
}

/**
 * 세이브 한 판을 통째로 훑어 적립하는 백스톱. 두 곳에서 쓴다:
 *   - loadSavedGame: 즉시 적립이 배포되기 **전에** 만들어진 세이브를 1회 백필한다.
 *     그 판의 이벤트는 즉시 적립 경로를 한 번도 지나지 않았으므로 여기서만 구제된다.
 *   - commitRun: 쓰기 실패(용량 초과·프라이빗 모드)로 즉시 적립이 빠진 구멍을 엔딩에서 메운다.
 *
 * 전부 집합 의미론이라 몇 번 불러도 결과가 같다(멱등). 새로 들어간 게 없으면 쓰지 않는다.
 */
export function accrueFromState(state: GameState): void {
  const a = loadArchive();
  if (mergeState(a, state)) persist(a);
}

function mergeState(a: RunArchive, state: GameState): boolean {
  let dirty = false;
  for (const e of state.events) {
    if (record(a, a.events, a.pendingRun.events, e.id)) dirty = true;
    // 백필도 같은 리졸버·같은 발생 학년을 쓴다 — 즉시 적립과 결과가 어긋나면 안 된다.
    if (addTo(a.cgFiles, resolveCg(e.id, e.resolvedChoice ?? 0, state.gender, e.year ?? 1))) dirty = true;
  }
  for (const id of state.talkEventsFired ?? []) {
    if (record(a, a.talks, a.pendingRun.talks, id)) dirty = true;
    if (addTo(a.cgFiles, resolveCg(id, 0, state.gender, state.year))) dirty = true;
  }
  for (const f of state.parentEventsFired ?? []) {
    if (addTo(a.parentEvents, f.id)) dirty = true;
    if (addTo(a.cgFiles, resolveCg(f.id, 0, state.gender, state.year))) dirty = true;
  }
  for (const strength of state.parentClimaxFired ?? []) {
    if (addTo(a.parentEvents, `climax:${strength}`)) dirty = true;
  }
  touchPeak(a, state.npcs);
  return dirty;
}

/**
 * 새 판 시작 — "이번 판에서 처음"의 기준선을 리셋한다. startGame에서만 부른다.
 * lastRunDelta는 남긴다: 그건 직전 판의 사실이고, 다음 완주가 덮어쓴다.
 */
export function beginRun(): void {
  const a = loadArchive();
  a.pendingRun = { events: [], talks: [] };
  persist(a);
}

/**
 * 엔딩 도달 시 1회 — 완주 게이트 축(runs·endings)을 적립하고 "무엇이 처음이었는지"를 정산한다.
 *
 * newEvents/newTalks는 판 중에 pendingRun이 모아둔 것을 세기만 한다(엔딩 시점 archive 대조가
 * 아니다 — 즉시 적립이 이미 넣어놨으므로 그렇게 세면 0이 된다). mergeState는 즉시 적립이
 * 빠뜨린 구멍만 메우는 백스톱이고, 거기서 새로 들어간 것도 pendingRun에 합쳐지므로
 * 즉시 적립이 전부 실패한 최악의 경우에도 카운트는 v1과 같은 값이 나온다.
 */
export function commitRun(state: GameState, endingTitle: string): RunDelta {
  const a = loadArchive();
  a.runs += 1;
  mergeState(a, state);   // 더티 무시 — runs가 이미 바뀌었으니 무조건 쓴다
  const newEndingTitle = addTo(a.endings, endingTitle);

  const delta: RunDelta = {
    newEvents: a.pendingRun.events.length,
    newTalks: a.pendingRun.talks.length,
    newEndingTitle,
    runs: a.runs,
  };
  a.lastRunDelta = delta;
  a.pendingRun = { events: [], talks: [] };

  persist(a);
  return delta;
}

export function clearArchive(): void {
  try { localStorage.removeItem(ARCHIVE_KEY); } catch { /* noop */ }
}

// 티어 기반 조회(npcTierRows/unmetNames)는 두지 않는다 — 친밀도는 동행·말걸기를 얼마나
// 쓰느냐에 따라 전원 절친까지도, 최고 62까지도 나온다(실측). 플레이 습관을 재는 것이지
// 콘텐츠를 얼마나 봤는지를 재지 못한다. 기록실이 말하는 축은 npcStoryPool의 이야기
// 커버리지다. npcPeak은 그 결론과 무관하게 원천 데이터로만 남겨둔다.
