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
import type { GameState } from './types';

const ARCHIVE_KEY = 'lifetrack_archive';
export const CURRENT_ARCHIVE_VERSION = 1;

export interface RunArchive {
  version: number;
  runs: number;                        // 엔딩까지 도달한 횟수
  events: string[];                    // 본 적 있는 이벤트 id
  talks: string[];                     // 본 적 있는 말걸기 미니이벤트 id
  endings: string[];                   // 도달한 엔딩 타이틀
  // 아래 둘은 적립만 하고 아직 화면에 안 쓴다. 지우지 않는 이유는 영속 데이터라 비대칭이기
  // 때문 — 지금 안 쌓으면 그 기간의 이력은 나중에 복구할 방법이 없고, 비용은 필드 하나다.
  cg: string[];                        // 본 적 있는 이벤트 배경 키 (CG 갤러리용 예비)
  npcPeak: Record<string, number>;     // NPC별 역대 최고 친밀도(런을 가로질러)
}

export function emptyArchive(): RunArchive {
  return { version: CURRENT_ARCHIVE_VERSION, runs: 0, events: [], talks: [], cg: [], endings: [], npcPeak: {} };
}

// 손상·부재는 "빈 기록"으로 떨어진다. 기록은 진행에 필수가 아니므로 절대 던지지 않는다.
//
// 버전은 아직 분기하지 않는다 — v1이 최초 스키마라 마이그레이션할 과거가 없다. 필드별 타입
// 검사가 방어를 대신하고(어긋난 값은 버려진다), 읽은 결과는 항상 CURRENT로 재스탬프된다.
// v2를 도입할 때 여기에 분기와 그 테스트를 같이 넣을 것.
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
    return {
      version: CURRENT_ARCHIVE_VERSION,
      runs: typeof parsed.runs === 'number' && parsed.runs >= 0 ? Math.floor(parsed.runs) : 0,
      events: arr(parsed.events), talks: arr(parsed.talks), cg: arr(parsed.cg), endings: arr(parsed.endings),
      npcPeak: peak,
    };
  } catch {
    return emptyArchive();
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

/** 엔딩 화면이 보여줄 "이번 판" 요약. commitRun이 적립하면서 같이 계산해 돌려준다. */
export interface RunDelta {
  newEvents: number;      // 이번 판에서 처음 본 이야기
  newTalks: number;
  newEndingTitle: boolean; // 처음 도달한 엔딩인가
  runs: number;            // 완주 누적
}

/**
 * 엔딩 도달 시 1회 호출 — 한 판의 기록을 통째로 적립하고 "무엇이 처음이었는지"를 돌려준다.
 *
 * 이벤트마다 적립하지 않는 이유: (1) 한 판에 300회 넘는 localStorage 쓰기가 생기고,
 * (2) "이번 판 신규" 카운트를 어딘가에 따로 들고 있어야 하는데 새로고침에 날아간다.
 * state.events / state.talkEventsFired 는 세이브에 남으므로, 끝에서 한 번에 파생하면 둘 다 해결된다.
 * 대가: 끝까지 안 간 판은 적립되지 않는다 — 기록을 "완주한 학창시절"로 정의하는 쪽을 택했다.
 *
 * NPC는 최종 친밀도를 쓴다(런 중 최고점은 상태에 추적되지 않는다 — 후회카드와 같은 선택).
 * 드리프트로 내려간 만큼은 과소 기록될 수 있으나, 엔딩이 말하는 관계와 기록이 어긋나지 않는 쪽을 택했다.
 */
export function commitRun(state: GameState, endingTitle: string): RunDelta {
  const a = loadArchive();
  a.runs += 1;

  let newEvents = 0;
  for (const e of state.events) {
    if (addTo(a.events, e.id)) newEvents++;
    addTo(a.cg, e.background);
  }
  let newTalks = 0;
  for (const id of state.talkEventsFired ?? []) {
    if (addTo(a.talks, id)) newTalks++;
  }
  const newEndingTitle = addTo(a.endings, endingTitle);
  for (const n of state.npcs) {
    if (!n.met) continue;
    if ((a.npcPeak[n.id] ?? -1) < n.intimacy) a.npcPeak[n.id] = n.intimacy;
  }

  persist(a);
  return { newEvents, newTalks, newEndingTitle, runs: a.runs };
}

export function clearArchive(): void {
  try { localStorage.removeItem(ARCHIVE_KEY); } catch { /* noop */ }
}

// 티어 기반 조회(npcTierRows/unmetNames)는 두지 않는다 — 친밀도는 동행·말걸기를 얼마나
// 쓰느냐에 따라 전원 절친까지도, 최고 62까지도 나온다(실측). 플레이 습관을 재는 것이지
// 콘텐츠를 얼마나 봤는지를 재지 못한다. 기록실이 말하는 축은 npcStoryPool의 이야기
// 커버리지다. npcPeak은 그 결론과 무관하게 원천 데이터로만 남겨둔다.
