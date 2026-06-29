// 신호-2(정밀판) 검증 — nextIntimacyThreshold가 실제 reach/mini 데이터에서 '다음 임계'를 정직하게 뽑는지.
// 기존 신호-1은 smalltalk 티어 [30,50,70] 하드코딩이라 reach 곡선(jihun 고교 80·85·89 등)을 못 봤다.
// 게임 루프가 쓰는 selection.getReachForWeek와 동일한 발동-기준(state.events의 id·학년 게이트)으로 대조.
import { createInitialState } from '../../src/engine/gameEngine';
import { nextIntimacyThreshold, relationshipSignal } from '../../src/engine/relationshipSignals';
import { GAME_EVENTS } from '../../src/engine/events/data';
import { GameEvent, GameState, NpcState } from '../../src/engine/types';

function mk(year: number, npcId: string, intimacy: number, events: GameEvent[] = []): { s: GameState; n: NpcState } {
  const s = createInitialState('male', ['neutral', 'neutral'], { rngSeed: 1 });
  s.year = year; s.week = 10; s.isVacation = false;
  s.events = events;
  const n = s.npcs.find((x) => x.id === npcId)!;
  n.met = true; n.intimacy = intimacy; n.weekStartIntimacy = intimacy;
  return { s, n };
}

const fails: string[] = [];
let pass = 0;
function check(desc: string, ok: boolean) { if (ok) pass++; else fails.push(desc); }
const imminent = (n: NpcState, s: GameState) => relationshipSignal(n, s)?.text.includes('가까워') ?? false;

// 1) 현재 학년 reach 곡선 반영 — jihun Y5 reachHigh tier = 80·85·89
{ const { s, n } = mk(5, 'jihun', 76); check('jihun Y5 i76 → th=80', nextIntimacyThreshold(n, s) === 80); check('jihun Y5 i76 임박신호 ON', imminent(n, s)); }
{ const { s, n } = mk(5, 'jihun', 82); check('jihun Y5 i82 → th=85', nextIntimacyThreshold(n, s) === 85); }
// 기존 하드코딩이면 i76은 [30,50,70] 어디에도 안 걸려 신호 null이었음 → 정밀화로 켜진 게 핵심.

// 2) 과거 학년 reach 제외 — jihun Y2 reach tier=45/55/65는 Y5 state에선 후보 아님.
//    (포함 버그면 i44에서 th=45가 잡힘. 학년 게이트가 살아있으면 mini/Y5 reach 임계로 넘어가 45가 안 나온다.)
{ const { s, n } = mk(5, 'jihun', 44); const th = nextIntimacyThreshold(n, s); check('jihun Y5 i44 → th≠45/55/65 (Y2 과거컷 제외)', th !== 45 && th !== 55 && th !== 65); }

// 3) 미래 학년 reach 제외 — jihun Y5에서 Y6 tier(90·93·95)는 안 잡힘
{ const { s, n } = mk(5, 'jihun', 90); check('jihun Y5 i90 → th=null (Y6 컷은 미래라 제외)', nextIntimacyThreshold(n, s) === null); }

// 4) 발동된 reach 제외 — Y5 t80 발동 기록 시 다음은 85
{ const fired = GAME_EVENTS.filter((e) => e.reach && e.reach.npc === 'jihun' && e.reach.year === 5 && e.reach.tier === 80).map((e) => ({ ...e, year: 5, week: 3 }));
  const { s, n } = mk(5, 'jihun', 82, fired); check('jihun Y5 t80 발동후 i82 → th=85', nextIntimacyThreshold(n, s) === 85); }

// 5) 신규 NPC 반영 — yerin Y6 reachNew tier = 55·60
{ const { s, n } = mk(6, 'yerin', 52); check('yerin Y6 i52 → th=55', nextIntimacyThreshold(n, s) === 55); }

// 6) 다 소진하면 null — jihun Y7 최고 tier(97) 넘으면 없음
{ const { s, n } = mk(7, 'jihun', 98); check('jihun Y7 i98 → th=null', nextIntimacyThreshold(n, s) === null); }

// 7) 불변식 스윕 — 모든 met NPC·전 학년·여러 친밀도에서 th는 null 또는 intimacy 초과
const npcIds = createInitialState('male', ['neutral', 'neutral'], { rngSeed: 1 }).npcs.map((x) => x.id);
let invChecked = 0;
for (const id of npcIds) for (let y = 1; y <= 7; y++) for (const i of [0, 25, 45, 65, 85, 99]) {
  const { s, n } = mk(y, id, i); const th = nextIntimacyThreshold(n, s);
  invChecked++;
  if (!(th === null || th > i)) fails.push(`불변식 위반: ${id} Y${y} i${i} → th=${th}`);
}
check(`불변식(th===null || th>intimacy) ${invChecked}건`, true);

console.log(`\n=== 신호-2 정밀판 검증 ===`);
console.log(`통과: ${pass}/${pass + fails.length} 단언 + 불변식 ${invChecked}건`);
if (fails.length) { console.log('\n실패:'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
else console.log('✓ 다음 임계 조회가 reach/mini 데이터와 정합 (학년 게이트·발동 제외·곡선 반영 정상)');
