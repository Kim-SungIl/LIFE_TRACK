// 연쇄 판정 좌표(발생주) + 여름방학 임계 통과 이월 실측 — 제품 store 경로로 경계 교차주 전수를 돈다.
//
// 대상 학년 한 해를 store(advanceWeek → resolveEvent → resolveEventChain)로 산다. 도달형 96건 × 교차주
// C ∈ {18,19,20,23,24,25,41,42,43,47,48} × 경로 × 이력 × 시드 2.
//   경로 main  = C주 주중에 tier+1로 올린다(메인 슬롯 판정 전)
//        chain = 발생주 C의 사건 국면에 올린다(연쇄 판정 전). C주에 사건이 없으면 그 칸은 버린다(r=null).
//   이력 old    = 같은 NPC·같은 학년의 낮은 티어 컷을 전년에 본 것으로(쿨다운 경과)
//        recent = 같은 학년 C−1주에 본 것으로(쿨다운 진행 — 이월이 없으면 유실이 나는 칸)
//
// 코드 판본을 비교하려면 두 체크아웃에서 각각 돌린 뒤 COMPARE로 짝짓는다(판 단위 짝 = 같은 key):
//   cd game && SHARD=0/2 OUT=/tmp/x/new-0.jsonl npx tsx scripts/sim/probe-chain-occurrence-carry.ts   (SHARD 1/2도)
//   cd game && COMPARE=/tmp/x/base,/tmp/x/new npx tsx scripts/sim/probe-chain-occurrence-carry.ts      (접두어 = 파일명 앞부분)
//
// 자기검사: 돌린 칸이 0이거나, 방학 가드 대상 칸이 0이면 throw — 측정이 공허한 채 "유실 0"이 나오는 것을 막는다.
// 결과(2026-10-13)는 docs/chain-occurrence-vacation-carry-2026-10-13.md.

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import { useGameStore } from '../../src/engine/store';
import { getWeekInfo } from '../../src/engine/weekMath';
import type { GameEvent, GameState } from '../../src/engine/types';

const ALL = GAME_EVENTS as GameEvent[];
const REACH = ALL.filter(e => e.reach);
// 방학 가드 = 같은 state를 방학으로만 바꾸면 조건이 막히는 컷. 문자열 검사로 고르면 `s.isVacation &&`(방학 전용)도 걸린다.
const guarded = (e: GameEvent) => /!s\.isVacation/.test(String(e.condition ?? ''));
const isVac = (w: number) => getWeekInfo(w).isVacation;
const CROSS = [18, 19, 20, 23, 24, 25, 41, 42, 43, 47, 48];

interface Cell {
  key: string; id: string; guarded: boolean; year: number; C: number; mode: 'main' | 'chain'; hist: 'old' | 'recent'; seed: number;
  r: null | { shown: number | null; reachSet: string[]; vacGuarded: string[]; n: number };
}

function setWeek(s: GameState, year: number, week: number): void {
  s.year = year;
  s.week = week;
  const i = getWeekInfo(week);
  s.semester = i.semester;
  s.isVacation = i.isVacation;
}

function play(target: GameEvent, C: number, mode: 'main' | 'chain', hist: 'old' | 'recent', seed: number): Cell['r'] {
  const { npc, tier, year } = target.reach!;
  const s0 = createInitialState('male', ['wealth', 'freedom'], { rngSeed: seed });
  s0.routineSlot2 = 'self-study';
  s0.routineSlot3 = 'light-exercise';
  setWeek(s0, year, 1);
  s0.phase = 'weekday';
  const lower = ALL.filter(e => e.reach?.npc === npc && e.reach.year === year && e.id !== target.id && e.reach.tier < tier);
  const histWeek = hist === 'old' ? 1 : Math.max(1, C - 1);
  s0.events = lower.map(e => ({ ...e, condition: undefined, year: hist === 'old' ? year - 1 : year, week: histWeek }));
  const fixture = new Set(lower.map(e => e.id));
  useGameStore.setState({ state: s0 });
  let crossed = false;
  for (let g = 0; g < 400; g++) {
    let st = useGameStore.getState().state!;
    if (st.year !== year || st.phase === 'ending' || st.phase === 'year-end') break;
    if (st.phase === 'weekday' || st.phase === 'event') {
      const occ = st.phase === 'event' ? st.currentEvent!.week : st.week;
      const hit = mode === 'main' ? st.phase === 'weekday' && st.week === C : st.phase === 'event' && occ === C;
      if (!crossed && mode === 'chain' && st.phase === 'weekday' && st.week > C) return null;
      const npcs = st.npcs.map(n => ({ ...n }));
      const n = npcs.find(x => x.id === npc)!;
      n.met = true;
      if (!crossed && hit) { n.intimacy = tier + 1; crossed = true; }
      else if (!crossed) n.intimacy = Math.min(n.intimacy, tier - 12);
      else n.intimacy = Math.max(n.intimacy, tier);
      useGameStore.setState({ state: { ...st, npcs } });
      st = useGameStore.getState().state!;
    }
    const api = useGameStore.getState();
    if (st.phase === 'weekday') {
      api.setWeekendChoices(['self-study', 'club']);
      api.setVacationChoices(['self-study', 'creative', 'rest']);
      api.advanceWeek();
    } else if (st.phase === 'event') {
      const ev = st.currentEvent!;
      const list = st.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      api.resolveEvent(Math.max(0, list.findIndex(c => !c.relationshipSelect && !c.romanceConversation)));
    } else if (st.phase === 'result') api.setPhase('weekday');
    else break;
  }
  const f = useGameStore.getState().state!;
  // 픽스처가 심은 이력은 센다에서 뺀다(방학 주 C−1에 심은 이력이 "방학 표시"로 잡히지 않게).
  const yr = f.events.filter(e => e.year === year && !(fixture.has(e.id) && e.week === histWeek));
  const byId = (id: string) => ALL.find(x => x.id === id);
  return {
    shown: yr.find(e => e.id === target.id)?.week ?? null,
    reachSet: yr.filter(e => e.reach && e.id !== target.id).map(e => e.id).sort(),
    vacGuarded: yr.filter(e => isVac(e.week!) && guarded(byId(e.id) ?? e)).map(e => `${e.id}@${e.week}`),
    n: yr.length,
  };
}

function run(out: string, shard: number, nShards: number): void {
  writeFileSync(out, '');
  let k = 0, ran = 0, guardedRan = 0;
  for (const t of REACH) for (const C of CROSS) for (const mode of ['main', 'chain'] as const)
    for (const hist of ['old', 'recent'] as const) for (const seed of [3, 7]) {
      if ((k++ % nShards) !== shard) continue;
      const r = play(t, C, mode, hist, seed);
      if (r) { ran++; if (guarded(t)) guardedRan++; }
      const cell: Cell = { key: `${t.id}|${C}|${mode}|${hist}|${seed}`, id: t.id, guarded: guarded(t), year: t.reach!.year, C, mode, hist, seed, r };
      appendFileSync(out, JSON.stringify(cell) + '\n');
    }
  if (ran === 0 || guardedRan === 0) throw new Error(`돌린 칸 ${ran} · 방학 가드 칸 ${guardedRan} — 측정이 공허하다`);
  console.log(`${out}: ${ran}칸 (방학 가드 ${guardedRan})`);
}

function load(prefix: string): Map<string, Cell> {
  const dir = dirname(prefix), head = basename(prefix);
  const m = new Map<string, Cell>();
  for (const f of readdirSync(dir).filter(x => x.startsWith(head) && x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) if (line) { const c = JSON.parse(line) as Cell; m.set(c.key, c); }
  }
  return m;
}

function compare(a: string, b: string): void {
  const A = load(a), B = load(b);
  const keys = [...A.keys()].filter(k => A.get(k)!.r && B.get(k)?.r);
  if (keys.length === 0) throw new Error('짝이 0 — 측정이 공허하다');
  const tally = { lostG: 0, lostN: 0, gainG: 0, gainN: 0, leakA: 0, leakB: 0, vacA: 0, vacB: 0, othLost: 0, othGain: 0, winterShownB: 0 };
  const byC: Record<string, number> = {};
  for (const k of keys) {
    const x = A.get(k)!, y = B.get(k)!, rx = x.r!, ry = y.r!;
    const g = x.guarded ? 'G' : 'N';
    if (rx.shown !== null && ry.shown === null) { tally[`lost${g}`]++; byC[`유실 ${g} C${x.C}`] = (byC[`유실 ${g} C${x.C}`] ?? 0) + 1; }
    if (rx.shown === null && ry.shown !== null) { tally[`gain${g}`]++; byC[`획득 ${g} C${x.C}`] = (byC[`획득 ${g} C${x.C}`] ?? 0) + 1; }
    if (x.guarded && rx.shown !== null && isVac(rx.shown)) tally.leakA++;
    if (x.guarded && ry.shown !== null && isVac(ry.shown)) tally.leakB++;
    if (x.guarded && x.C >= 43 && ry.shown !== null) tally.winterShownB++;
    tally.vacA += rx.vacGuarded.length;
    tally.vacB += ry.vacGuarded.length;
    const sx = new Set(rx.reachSet), sy = new Set(ry.reachSet);
    tally.othLost += [...sx].filter(i => !sy.has(i)).length;
    tally.othGain += [...sy].filter(i => !sx.has(i)).length;
  }
  console.log(`${basename(a)} → ${basename(b)}: 짝 ${keys.length}`);
  console.log(`  대상 유실 가드 ${tally.lostG} · 비가드 ${tally.lostN} / 획득 가드 ${tally.gainG} · 비가드 ${tally.gainN}`);
  console.log(`  방학 가드 대상이 방학 주에 표시 ${tally.leakA} → ${tally.leakB} · 방학 주 방학 가드 사건 표시 총 ${tally.vacA} → ${tally.vacB}`);
  console.log(`  비대상 도달형 집합차 유실 ${tally.othLost} · 획득 ${tally.othGain} · 겨울 교차 가드 컷 표시 ${tally.winterShownB}`);
  console.log(`  ${Object.entries(byC).sort().map(([kk, n]) => `${kk}×${n}`).join(' ')}`);
}

if (process.env.COMPARE) {
  const [a, b] = process.env.COMPARE.split(',');
  compare(a, b);
} else {
  const [s, n] = (process.env.SHARD ?? '0/1').split('/').map(Number);
  run(process.env.OUT ?? '/dev/stdout', s, n);
}
