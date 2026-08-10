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

/** npcId → 그 사람과 얽힌 이벤트 id 집합. 모듈 로드 시 1회 계산. */
const POOL: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const n of INITIAL_NPCS) m.set(n.id, new Set());
  for (const e of GAME_EVENTS) {
    // 도달형은 대상 NPC 한 명에게만 귀속한다(그 사람의 이야기라는 게 명시돼 있다).
    // 정책 선언이지 현재 동작은 아니다 — 도달형 96종이 전부 대상 본인을 speakers에 포함하고,
    // 대상 외 로스터 인물을 조연으로 둔 도달형은 0종이라 이 분기를 지워도 결과가 같다(실측).
    // 조연 있는 도달형이 생기는 순간부터 의미가 발현되므로 방어적으로 남긴다.
    if (e.reach?.npc && m.has(e.reach.npc)) { m.get(e.reach.npc)!.add(e.id); continue; }
    // 그 외에는 등장 인물 전원에게 귀속 — 한 장면이 여러 사람의 기록에 잡힐 수 있다.
    for (const sp of e.speakers ?? []) m.get(sp)?.add(e.id);
  }
  return m;
})();

export interface NpcStoryRow {
  id: string;
  name: string;
  seen: number;
  total: number;
  ratio: number;
}

export function npcStoryRows(seenEventIds: readonly string[]): NpcStoryRow[] {
  const seenSet = new Set(seenEventIds);
  return INITIAL_NPCS.map(n => {
    const pool = POOL.get(n.id) ?? new Set<string>();
    let seen = 0;
    for (const id of pool) if (seenSet.has(id)) seen++;
    return { id: n.id, name: n.name, seen, total: pool.size, ratio: pool.size ? seen / pool.size : 1 };
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
 * "만난 적 없는 사람"이 아니라 이 기준을 쓰는 이유: 7년이면 누구든 다 만나고 다 절친이 된다.
 * 정작 안 본 건 그 사람의 '이야기'이고, 그건 학년 게이트 때문에 다시 못 여는 것들이다.
 */
export function barelyTouchedNames(seenEventIds: readonly string[], limit = 4): string[] {
  return npcStoryRows(seenEventIds)
    .filter(isBarelyTouched)
    // 동률이면 이야기 수가 적은 쪽부터. 로스터 순서를 그대로 두면 하필 주요 인물 넷(지훈·수빈·
    // 민재·유나)이 앞에 서서, 7년을 함께한 소꿉친구를 "스치기만 한 사람"이라 부르게 된다.
    // 남은 이야기가 6개인 쪽이 38개인 쪽보다 다음 판에 실제로 닿을 만하다.
    .sort((a, b) => a.ratio - b.ratio || a.total - b.total)
    .slice(0, limit)
    .map(r => r.name);
}
