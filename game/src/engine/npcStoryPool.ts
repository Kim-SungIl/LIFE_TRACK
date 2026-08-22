// ===== NPC별 "그 사람의 이야기" 풀 =====
// 기록실이 "누구의 이야기를 얼마나 봤는가"를 말하려면 분모가 필요하고, 그건 이벤트 정의에서
// 정적으로 셀 수 있다(reach.npc = 친밀도 도달형, speakers = 등장).
//
// 왜 친밀도가 아니라 이야기 수인가 (실측):
//   친밀도는 **플레이 습관에 좌우돼** 콘텐츠 진척의 지표가 못 된다. 동행·말걸기를 계속 쓰면
//   10명이 전원 절친까지 가지만(그쪽은 캡 제외 통로다), 선택지만 눌러 완주하는 하네스 6종
//   (정책 3 × 부모조합 2)에서는 절친 도달이 0/10명이고 peak가 3~62에 그친다.
//   반면 이야기 커버리지는 같은 6종 전부에서 **하한이 0.11로 남는다**(상한만 0.46~0.68로 갈린다).
//   그 남은 몫은 도달형 이벤트 96종이 학년(reach.year)으로 게이트돼 있어서 회수가 안 된다 —
//   고3에 아무리 가까워져도 중1 이야기는 영영 안 열린다.
//   즉 "얼마나 가까웠나"가 아니라 "제때 가까워졌나"가 콘텐츠를 가른다.
//
// GAME_EVENTS를 끌어오지만 번들 부담은 없다 — store.ts가 이미 같은 모듈을 엔트리 청크로 당긴다.
import { GAME_EVENTS } from './events';
import { INITIAL_NPCS } from './npcRoster';
import type { GameEvent } from './types';

/**
 * 이 장면은 누구의 이야기인가 — 기록실의 이야기 커버리지와 앨범이 **같은 규칙**을 써야 하므로
 * 판정을 여기 한 곳에 둔다(화면이나 앨범 모듈이 복제하면 둘이 어긋난다).
 *
 * 우선순위:
 *  1. `reach.npc` — 도달형은 대상 NPC 한 명에게만. 정책 선언이지 현재 동작은 아니다(도달형 96종이
 *     전부 대상 본인을 speakers에 포함하고, 대상 외 로스터 인물을 조연으로 둔 도달형은 0종이다).
 *  2. `storyOf` — 그 사람이 **화면에 없어도** 그 사람 이야기인 장면. speakers에 넣으면 EventScene이
 *     떠난 사람을 다시 세우므로 나눠 뒀다(`haeun-distance`가 그 경우다).
 *  3. `speakers` — 등장 인물 전원. 한 장면이 여러 사람의 기록에 잡힐 수 있다.
 *
 * 셋 다 없으면 **주인이 없는 장면**이다(개학·시험·졸업 준비·번아웃·정체성 위기 등). 그건 누락이
 * 아니라 실제로 혼자 지나온 시간이라, SOLO_POOL로 따로 모아 앨범에 자기 자리를 준다.
 */
export function storyOwners(e: GameEvent, known: (id: string) => boolean): string[] {
  if (e.reach?.npc && known(e.reach.npc)) return [e.reach.npc];
  const named = (e.storyOf ?? []).filter(known);
  if (named.length > 0) return named;
  return (e.speakers ?? []).filter(known);
}

/** 주인 없는 장면들이 모이는 가상 뿌리의 id. 로스터 id와 겹치지 않는다. */
export const SOLO_ROOT = 'solo';

/** npcId → 그 사람과 얽힌 이벤트 id 집합. 모듈 로드 시 1회 계산. SOLO_ROOT도 한 칸 차지한다. */
const POOL: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const n of INITIAL_NPCS) m.set(n.id, new Set());
  const isNpc = (id: string) => m.has(id);
  m.set(SOLO_ROOT, new Set());
  for (const e of GAME_EVENTS) {
    const owners = storyOwners(e, isNpc);
    if (owners.length === 0) { m.get(SOLO_ROOT)!.add(e.id); continue; }
    for (const id of owners) m.get(id)!.add(e.id);
  }
  return m;
})();

/** 주인 없는 장면들 — 앨범의 "혼자 지나온 것" 줄이 쓴다. */
export function soloStoryRow(seenEventIds: readonly string[]): NpcStoryRow {
  const seenSet = new Set(seenEventIds);
  const pool = POOL.get(SOLO_ROOT)!;
  let seen = 0;
  for (const id of pool) if (seenSet.has(id)) seen++;
  return {
    id: SOLO_ROOT, name: '혼자 지나온 것', seen, total: pool.size,
    ratio: pool.size ? seen / pool.size : 0,
    // 감출 사람이 없다 — 이 줄은 본 것이 하나라도 있을 때만 화면에 올린다(호출부 판단).
    everMet: true,
  };
}

export interface NpcStoryRow {
  id: string;
  name: string;
  seen: number;
  total: number;
  ratio: number;
  /**
   * 판을 가로질러 한 번이라도 만난 적이 있나 — 이름·얼굴을 보여줘도 되는지의 기준.
   * 적립층이 들어온 뒤로 기록실은 완주 없이도 열리므로(1학년 2주만 하고 접어도 열린다)
   * 로스터를 그대로 그리면 아직 만나지 않은 하은·준하·서아·시우·예린의 얼굴과 이름이,
   * 각자의 이야기 총수까지 붙어서 노출된다. 그건 캐스팅 스포일러이면서 동시에
   * "안 만난 사람의 분모"라 이 게임이 거부하는 달성률 표시가 된다.
   */
  everMet: boolean;
}

/**
 * npcPeak을 만남의 근거로 쓰는 이유: met인 NPC만 기록되고(archive.ts touchPeak),
 * 즉시 적립 3경로 전부에서 갱신되므로 완주 없이도 살아 있다. 친밀도는 전 경로에서
 * `Math.max(0, …)`로 클램프되므로 첫 met에서 `(peak ?? -1) < intimacy`가 반드시 참이다 —
 * "친밀도 0인 met NPC가 기록에서 빠진다"는 일어나지 않는다.
 *
 * `seen > 0` OR 가지는 **레거시 호환이 아니다.** npcPeak과 met 가드는 archive 최초 커밋
 * (#381)에 함께 들어왔으므로 npcPeak이 없는 기록 포맷은 존재하지 않고, shipped 경로로도
 * "peak엔 없는데 seen > 0"을 만들 수 없다(store가 speakers 전원을 met으로 세운 직후 같은
 * tick에 touchPeak이 돌고 한 번에 persist된다). 남긴 이유는 의미론이다 — 그 사람이 나오는
 * 장면을 이미 읽었다면 이름을 보여도 스포일러가 아니다. 대가도 있다: 기존 이벤트에
 * `speakers`를 나중에 추가하면 그 이벤트를 이미 적립한 기록에서 그 인물이 소급 노출된다.
 *
 * 인자를 생략하면 `seen > 0`만 남는다. 스포일러 축에서는 안전한 방향이지만 UI 축에서는
 * 아니다 — 지훈까지 사라져 목록이 빌 수 있으므로 화면은 반드시 2-arg로 부른다.
 */
export function npcStoryRows(
  seenEventIds: readonly string[],
  npcPeak: Readonly<Record<string, number>> = {},
): NpcStoryRow[] {
  const seenSet = new Set(seenEventIds);
  return INITIAL_NPCS.map(n => {
    const pool = POOL.get(n.id) ?? new Set<string>();
    let seen = 0;
    for (const id of pool) if (seenSet.has(id)) seen++;
    return {
      id: n.id, name: n.name, seen, total: pool.size, ratio: pool.size ? seen / pool.size : 1,
      everMet: seen > 0 || npcPeak[n.id] !== undefined,
    };
  });
}

// "거의 스치기만 한" 기준. 완주 1판 실측에서 서아 1/9·시우 1/8·예린 1/6이 여기 걸리고
// 도윤 3/7·수빈 12/32는 안 걸린다 — 다음 판에 실제로 가볼 만한 곳만 남기는 선.
const BARELY_TOUCHED = 0.25;

/**
 * "거의 스치기만 했나" 판정 — 기록실 문구와 엔딩 이름 목록이 같은 선을 써야 한다.
 * 임계를 export하지 않고 판정을 export하는 이유: 비교 방향(<=)까지 한곳에 두려는 것.
 * 화면이 `ratio <= 0.25`를 직접 쓰면 임계를 옮길 때 한쪽만 따라와 둘이 어긋난다.
 */
export function isBarelyTouched(r: { total: number; ratio: number }): boolean {
  return r.total > 0 && r.ratio <= BARELY_TOUCHED;
}

/**
 * 다음 판의 이정표로 제시할 사람들 — 이야기를 거의 못 본 순서.
 *
 * "만난 적 없는 사람"이 아니라 **이야기를 못 본 사람**을 기준으로 삼는 이유: 못 본 건 관계가
 * 아니라 그 사람의 이야기이고, 도달형은 학년으로 게이트돼 그 학년이 지나면 다시 안 열린다.
 * 완주해도 친밀도만으로는 그게 회수되지 않는다.
 *
 * 그렇다고 **만나지 않은 사람까지 이름을 대면 안 된다.** 예전 주석은 "7년이면 누구든 다
 * 만난다"고 단정했는데 실측으로 반증됐다 — QA 플레이스루 348판 중 5판(1.4%)이 서아·예린·시우를
 * 한 번도 만나지 않고 엔딩에 도달한다(`*-meet`이 conditional 풀이고 조건이 `year === N && !met`
 * 이라 그 학년 슬롯 경합에서 밀리면 그 판에서 영구히 닫힌다). 그 판에서 미접촉자는 ratio 0 ·
 * total 최소라 **정렬 첫 줄에 확정으로 올라온다.** 그래서 기록실과 같은 everMet 게이트를 쓴다 —
 * 안 그러면 같은 기록에서 기록실은 감추고 엔딩 화면은 이름을 쓰는 비대칭이 생긴다.
 */
export function barelyTouchedNames(
  seenEventIds: readonly string[],
  npcPeak: Readonly<Record<string, number>> = {},
  limit = 4,
): string[] {
  return npcStoryRows(seenEventIds, npcPeak)
    .filter(r => r.everMet)
    .filter(isBarelyTouched)
    // 동률이면 이야기 수가 적은 쪽부터. 로스터 순서를 그대로 두면 하필 주요 인물 넷(지훈·수빈·
    // 민재·유나)이 앞에 서서, 7년을 함께한 소꿉친구를 "스치기만 한 사람"이라 부르게 된다.
    // 남은 이야기가 6개인 쪽이 38개인 쪽보다 다음 판에 실제로 닿을 만하다.
    .sort((a, b) => a.ratio - b.ratio || a.total - b.total)
    .slice(0, limit)
    .map(r => r.name);
}
