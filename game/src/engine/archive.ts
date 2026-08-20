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
// 필드**(+= 1)라 중복·재진입 위험이 전부 거기 모인다. 그걸 엔딩 전이 감지 한 곳에만 매달아
// 두면 위험이 최소화되지만 **0은 아니다**: commitRun이 archive를 먼저 쓰고 그 뒤 세이브 쓰기가
// 실패하면(용량 초과 시 120KB 세이브가 4.6KB archive보다 먼저 터진다) 디스크에는 엔딩 직전
// 세이브가 남아, 이어하기 후 다시 넘기면 runs가 한 번 더 오른다. v1도 같은 순서였으므로 이
// 구조의 회귀는 아니다. 그 재생 경로에서는 pendingRun이 이미 비워져 있어 "처음 본 이야기"
// 카운트도 붕괴한다 — 세이브/archive 쓰기를 원자적으로 묶지 않는 한 남는 대가다.
// 나머지 축은 전부 집합이라 몇 번 적립해도 결과가 같다.
import type { GameState } from './types';
import { resolveEventCgRelPaths } from './eventCg';
import { PARENT_CLIMAX_EVENTS } from './talkData/miniEvents';

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
 *
 * ⚠️ 그때 같이 처리할 것 — **미래 버전 강등**. 지금은 from > CURRENT인 페이로드(다른 배포를
 * 탭 두 개로 여는 경우 등)도 마이그레이션 없이 통과한 뒤 마지막 줄에서 version만 CURRENT로
 * 내려 찍히고, 이 빌드가 모르는 필드는 다음 저장에서 사라진다. 그 뒤 신 빌드로 돌아가면
 * 이미 마이그레이션된 데이터에 마이그레이션이 또 돈다. 세이브 로더에는 이미 규약이 있다
 * (store.ts: `version > CURRENT_SAVE_VERSION`이면 null = 다운그레이드 거부).
 * v3가 없는 현재는 도달 불가라 지금 막지 않는다 — 여기서 빈 기록으로 떨어뜨리면 "기록이
 * 조용히 사라지는" 새 위험이 생기고, 올바른 처리(읽기 전용 유지)는 v3 스키마를 봐야 정해진다.
 */
function migrateArchive(a: RunArchive, from: number): void {
  if (from < 2) {
    // v1 코드는 이 필드들을 쓴 적이 없다 → 들고 왔다면 신뢰할 근거가 없다. 넷을 같이 비운다
    // (pendingRun/lastRunDelta만 비우고 cgFiles/parentEvents는 통과시키면 신뢰 경계가 비대칭이 된다).
    a.pendingRun = { events: [], talks: [] };
    a.lastRunDelta = null;
    a.cgFiles = [];
    a.parentEvents = [];
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
 * NPC 역대 최고 친밀도 갱신. 실제로 최고치를 갱신했으면 true — **더티 판정에 참여한다**.
 *
 * 처음에는 편승 전략(다른 축이 쓰기를 일으킬 때만 같이 저장)을 썼는데, 검수에서 영구 손실
 * 경로가 나왔다: archive가 포화된 2회차 이후에는 새로 볼 콘텐츠가 없어 쓰기가 아예 안
 * 일어나므로, 친밀도를 20→80까지 올려도 기록은 20에 머물고 그 판을 버리면 복구 불가였다.
 *
 * 더티에 넣는 비용이 걱정보다 작다: 조건이 "친밀도가 올랐다"가 아니라 **"역대 최고를
 * 갱신했다"**이고, 이 함수는 콘텐츠 적립 시점에만 불린다(주간 진행이나 잡담에는 안 붙는다).
 * 1회차엔 대부분 새 이벤트와 같은 순간이라 어차피 쓰던 쓰기이고, 2회차 이후엔 1회차가 세운
 * 최고치를 넘어야 하므로 빈도가 낮다.
 *
 * (v1은 엔딩 시점 최종 친밀도만 봤다 — 친밀도는 Y2 정점 후 내려가므로 체계적 과소기록이었다.
 * 한 판 실측에서 지훈은 최고 78.5인데 엔딩 시점 61.6이었다.)
 */
function touchPeak(a: RunArchive, npcs: GameState['npcs']): boolean {
  let raised = false;
  for (const n of npcs) {
    if (!n.met) continue;
    if ((a.npcPeak[n.id] ?? -1) < n.intimacy) {
      a.npcPeak[n.id] = n.intimacy;
      raised = true;
    }
  }
  return raised;
}

/**
 * CG 파일 해석 — **앨범 적립의 유일한 리졸버 호출지점**.
 *
 * 적립 단위가 이벤트 id도 (id, choiceIndex)도 아닌 "해석된 파일 경로"인 이유:
 * 같은 이벤트가 성별·선택지·학교급에 따라 다른 그림이 되고(성별 분기만 87건), 반대로 폴백
 * 체인이 여러 선택지를 한 파일로 접기도 한다. 경로를 키로 쓰면 **플레이어가 실제로 본 그림
 * 한 장**과 앨범 한 칸이 정확히 일치한다.
 * 부수 효과로 sentinel(-1) 선택지가 만드는 `_c-1_` 유령 변종이 자동으로 사라진다 —
 * `-1`은 nullish가 아니라 `?? 0`을 통과해 그대로 리졸버로 가지만, `_c-1_` 파일이 매니페스트에
 * 없어 후보에서 걸러진다(0으로 치환되는 게 아니다).
 *
 * ⚠️ 남은 구멍 하나: 표시 쪽(EventResultScreen)은 `[0]` 로드가 실패하면 onError로 `[1]`,
 * `[2]`…로 cascade하는데 적립은 `[0]`만 넣는다. 매니페스트는 public/images의 **png** 목록이고
 * 릴리즈는 webp만 배포하므로 "매니페스트에 있다"가 실제 요청 성공을 보장하지는 않는다.
 * assetWebp/assetExistence 테스트가 있어 도달성은 낮지만, "적립된 CG = 본 그림"의 유일한
 * 예외라 여기 적어 둔다.
 *
 * year는 **발생 학년**이다. 정규 이벤트는 recordResolvedEvent가 항목에 박아둔 값을 읽으므로
 * 호출 시점(학년 전환 전/후)과 무관하게 같은 파일이 나온다. 지금은 전환 자체가 Y1~Y6에서
 * 학년을 올리지 않아 어긋날 여지도 없지만, 항목의 year를 읽는 쪽이 그 사실에 의존하지 않는다.
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
 * 적립 실패를 삼키는 껍데기. `commitOnEnding`이 "기록 실패가 엔딩을 막지 않는다"고 선언한
 * 것과 같은 규약을 즉시 적립 경로에도 적용한다 — 호출부마다 try/catch를 흩뿌리는 대신
 * 여기 한 곳에 둔다(호출부가 6곳이고, 앞으로 늘어난다).
 *
 * 이게 없으면 기록이 플레이를 막는다: `events` 필드가 없는 손상 세이브에서 mergeState의
 * for-of가 던져 **이어하기 자체가 실패했다**(검수에서 실측). 기록은 선택적 기능이므로
 * 조용히 포기하는 쪽이 맞다.
 */
function safely(fn: () => void): void {
  try { fn(); } catch { /* 기록은 선택적 기능 — 플레이를 막지 않는다 */ }
}

/**
 * 정규 이벤트 해결 즉시 1회 — 방금 기록된 이벤트(state.events의 마지막 항목)를 적립한다.
 * 마지막 항목에 resolvedChoice·year가 이미 박혀 있어 CG 해석에 필요한 것이 전부 손에 있다.
 */
export function accrueResolvedEvent(state: GameState): void {
  safely(() => {
    const e = state.events[state.events.length - 1];
    if (!e) return;
    const a = loadArchive();
    let dirty = record(a, a.events, a.pendingRun.events, e.id);
    const cg = resolveCg(e.id, e.resolvedChoice ?? 0, state.gender, e.year ?? state.year);
    if (addTo(a.cgFiles, cg)) dirty = true;
    if (touchPeak(a, state.npcs)) dirty = true;
    if (dirty) persist(a);
  });
}

/** 말걸기 미니이벤트 발동 즉시 1회. CG는 common/talk_*.png 8장이 이 경로로만 도달한다. */
export function accrueTalk(state: GameState, talkId: string): void {
  safely(() => {
    const a = loadArchive();
    let dirty = record(a, a.talks, a.pendingRun.talks, talkId);
    if (addTo(a.cgFiles, resolveCg(talkId, 0, state.gender, state.year))) dirty = true;
    if (touchPeak(a, state.npcs)) dirty = true;
    if (dirty) persist(a);
  });
}

/**
 * 부모 미니이벤트·절정 발동 즉시 1회.
 * v1에서는 이 축이 통째로 빠져 있었다 — talkEventsFired만 훑었기 때문에, 평생 1회짜리
 * 강점별 절정 장면이 기록에 단 하나도 남지 않았다.
 *
 * id는 **실제 이벤트 id**를 받는다(절정은 `climax_parent_{강점}`). 처음에는 강점에서
 * `climax:{강점}` 합성 키를 만들었는데, 그러면 CG 리졸버에 매니페스트에 절대 없는 키가
 * 들어가 나중에 절정 CG가 추가돼도 앨범에 안 쌓인다.
 */
export function accrueParentEvent(state: GameState, id: string): void {
  safely(() => {
    const a = loadArchive();
    let dirty = addTo(a.parentEvents, id);
    if (addTo(a.cgFiles, resolveCg(id, 0, state.gender, state.year))) dirty = true;
    if (touchPeak(a, state.npcs)) dirty = true;
    if (dirty) persist(a);
  });
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
  safely(() => {
    const a = loadArchive();
    if (mergeState(a, state)) persist(a);
  });
}

function mergeState(a: RunArchive, state: GameState): boolean {
  let dirty = false;
  for (const e of state.events) {
    if (record(a, a.events, a.pendingRun.events, e.id)) dirty = true;
    // 정규 이벤트는 항목에 발생 학년이 박혀 있어 즉시 적립과 같은 파일이 나온다.
    if (addTo(a.cgFiles, resolveCg(e.id, e.resolvedChoice ?? 0, state.gender, e.year ?? 1))) dirty = true;
  }
  // ⚠️ 미니톡·부모이벤트는 발생 학년을 저장하지 않으므로 여기서는 **로드 시점의** state.year를
  // 쓴다(즉시 적립은 발동 시점이라 정확하다). 지금은 무해하다 — talk CG 8장이 전부 common/이라
  // 학교급과 무관하다. 다만 high/talk_*.png 하나만 추가되면 두 경로가 다른 파일을 넣는다.
  // 그때는 talkEventsFired를 {id, year} 구조로 올리는 게 정공법이다.
  for (const id of state.talkEventsFired ?? []) {
    if (record(a, a.talks, a.pendingRun.talks, id)) dirty = true;
    if (addTo(a.cgFiles, resolveCg(id, 0, state.gender, state.year))) dirty = true;
  }
  for (const f of state.parentEventsFired ?? []) {
    if (addTo(a.parentEvents, f.id)) dirty = true;
    if (addTo(a.cgFiles, resolveCg(f.id, 0, state.gender, state.year))) dirty = true;
  }
  // 절정은 state에 강점만 남으므로 실제 이벤트 id로 되돌린다 — 즉시 적립과 같은 키여야 하고,
  // 합성 키(`climax:strict`)는 매니페스트에 절대 없어 CG 경로가 죽는다.
  for (const strength of state.parentClimaxFired ?? []) {
    const c = PARENT_CLIMAX_EVENTS.find(e => e.parentStrength === strength);
    if (!c) continue;
    if (addTo(a.parentEvents, c.id)) dirty = true;
    if (addTo(a.cgFiles, resolveCg(c.id, 0, state.gender, state.year))) dirty = true;
  }
  if (touchPeak(a, state.npcs)) dirty = true;
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
