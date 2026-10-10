// 도달형 방학 가드의 유실 경로 — 임계를 넘는 주(W)마다 그 해 안에 컷이 뜨는가, 가드 전후로.
//
// sim-reach-vacation-gate.ts는 실제 판을 돌리지만, 고티어·고등 NPC 도달형은 하네스가 임계에 못 닿아
// 발동 0이다(적격주 0 — 결함 부재의 근거가 아니다). 그래서 페이싱 엔진(getReachForWeek)을 직접 두드린다:
//   · 친밀도는 W 전주까지 tier−1, W부터 tier(=W에 fresh).
//   · 같은 NPC의 더 낮은 티어 도달형은 이미 본 것으로 둔다(안 그러면 그것들이 먼저 뜨며 쿨다운을 흐린다).
//   · 직전 같은 NPC 도달형 시점 두 가지: old(오래전 — 쿨다운 경과) / recent(W−1 — 쿨다운 진행 중).
// 실행: cd game && npx tsx scripts/sim/probe-reach-vacation-crossing.ts [id,...]

import { GAME_EVENTS } from '../../src/engine/events';
import { getReachForWeek } from '../../src/engine/events/selection';
import { createInitialState } from '../../src/engine/gameEngine';
import { getWeekInfo } from '../../src/engine/weekMath';
import type { GameEvent, GameState } from '../../src/engine/types';

const DEFAULT = [
  'haeun-brothers-book', 'haeun-hs-leaving', 'jihun-new-shoes', 'minjae-dawn-on-hand', 'subin-hs-after',
  'seoa-torn-endless-line', 'seoa-ending-page', 'siwoo-demolished-ground', 'siwoo-where-you-stood', 'yerin-not-a-trade',
];
const ids = process.argv[2] ? process.argv[2].split(',') : DEFAULT;
const ALL = GAME_EVENTS as GameEvent[];

function gated(e: GameEvent, on: boolean): () => void {
  const orig = e.condition!;
  if (on) e.condition = (s: GameState) => orig(s) && !getWeekInfo(s.week).isVacation;
  return () => { e.condition = orig; };
}

type History = 'old' | 'recent';

/** W에 임계를 넘었을 때 그 해 몇 주에 뜨는가(안 뜨면 null). */
function fireWeek(target: GameEvent, crossWeek: number, hist: History): number | null {
  const { npc, tier, year } = target.reach!;
  const s = createInitialState('male', ['emotional', 'wealth'], { rngSeed: 1 });
  s.year = year;
  // 같은 NPC 다른 도달형: 낮은 티어는 이미 봤다, 높은 티어는 친밀도가 안 닿는다.
  const seen = ALL.filter(e => e.reach && e.reach.npc === npc && e.id !== target.id && e.reach.tier <= tier);
  const lastAbsYear = hist === 'old' ? Math.max(1, year - 1) : year;
  const lastWeek = hist === 'old' ? 1 : crossWeek - 1;
  s.events = seen.map((e, i) => ({ ...e, year: hist === 'old' ? lastAbsYear : year, week: hist === 'old' ? lastWeek : Math.max(1, lastWeek - i) }));
  const n = s.npcs.find(x => x.id === npc)!;
  n.met = true;
  for (let w = crossWeek; w <= 48; w++) {
    s.week = w;
    const info = getWeekInfo(w);
    s.semester = info.semester;
    s.isVacation = info.isVacation;
    n.intimacy = tier;
    n.weekStartIntimacy = w === crossWeek ? tier - 1 : tier;
    const pick = getReachForWeek(s);
    if (pick?.id === target.id) return w;
    if (pick) s.events.push({ ...pick, year, week: w });
  }
  return null;
}

let lostTotal = 0;
for (const id of ids) {
  const e = ALL.find(x => x.id === id);
  if (!e?.reach) throw new Error(`${id}: 도달형이 아니다`);
  for (const hist of ['old', 'recent'] as History[]) {
    const lost: number[] = [];
    let baseOk = 0;
    for (let w = 1; w <= 48; w++) {
      const b = fireWeek(e, w, hist);
      const restore = gated(e, true);
      let g: number | null;
      try { g = fireWeek(e, w, hist); } finally { restore(); }
      if (b !== null) baseOk++;
      if (b !== null && g === null) lost.push(w);
    }
    lostTotal += lost.length;
    const spans = lost.length ? `W${lost.join(',W')}` : '없음';
    console.log(`${id.padEnd(26)} ${hist.padEnd(6)} 기준선 ${String(baseOk).padStart(2)}/48주 뜸 · 가드 시 유실 ${String(lost.length).padStart(2)}주 (${spans})`);
  }
}
console.log(`\n유실 (교차주·이력) 합계 ${lostTotal}`);
