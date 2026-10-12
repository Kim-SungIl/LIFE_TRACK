// 도달형 방학 게이트 실측 — 학교 장면 도달형에 `!isVacation`을 걸면 컷이 유실되는가.
//
// 도달형(reach)은 fresh(이번 주에 임계를 막 넘음)일 때 쿨다운을 면제받는다. 방학 주에 임계를 넘은 판은
// 게이트를 걸면 fresh 창이 닫히고 pre-met 쿨다운으로 밀린다 — 그 해 안에 쿨다운이 안 차면 컷이 영구 유실된다.
// 그래서 게이트 전후를 같은 시드로 돌려 "발동한 판 수"를 비교한다(발동 주차는 참고).
//
// 실행: cd game && npx tsx scripts/sim/sim-reach-vacation-gate.ts
//   GATE=id1,id2  → 그 사건들의 조건에 방학 가드를 덧씌운 판(없으면 기준선만)

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { readFileSync, writeFileSync } from 'node:fs';
import { useGameStore } from '../../src/engine/store';
import { GAME_EVENTS } from '../../src/engine/events';
import { HARD_CRISIS_IDS } from '../../src/engine/events/constants';
import { getWeekInfo } from '../../src/engine/weekMath';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import type { GameEvent, GameState, ParentStrength } from '../../src/engine/types';

const TARGETS = [
  'mental-low', 'doyun-comic-share', 'identity-crisis',
  'haeun-brothers-book', 'haeun-hs-leaving', 'jihun-new-shoes', 'minjae-dawn-on-hand', 'subin-hs-after',
  'seoa-torn-endless-line', 'seoa-ending-page', 'siwoo-demolished-ground', 'siwoo-where-you-stood', 'yerin-not-a-trade',
];

type Arm = 'base' | 'gate';

function applyGate(ids: readonly string[]): () => void {
  const restore: Array<() => void> = [];
  for (const id of ids) {
    const e = (GAME_EVENTS as GameEvent[]).find(x => x.id === id);
    if (!e?.condition) throw new Error(`게이트 대상 ${id}가 없다 — 이 측정은 공허하다`);
    const orig = e.condition;
    e.condition = (s: GameState) => orig(s) && !getWeekInfo(s.week).isVacation;
    restore.push(() => { e.condition = orig; });
  }
  return () => restore.forEach(r => r());
}

interface Fire { id: string; year: number; week: number }

// bond — 사건마다 친밀도를 가장 많이 올리는 선택지. 첫 선택지 정책은 고티어(85~90)·고등 NPC에 못 닿아
// 대상 10건 중 7건이 발동 0이었다(적격주 0 = 하네스가 게이트에 못 닿은 것). 그 판들에 닿게 하는 정책.
// grind — 고립·과로형. 사교 정책은 사교<30(mental-low)·멘탈≤55(identity-crisis)에 영영 못 닿아서
// 비도달형 3건이 발동 0이었다. 말걸기는 도윤만(doyun-comic-share의 Y1 친밀도 30), 나머지는 공부.
type Policy = 'first' | 'bond' | 'grind';
function bondChoice(st: GameState): number {
  const ev = st.currentEvent;
  if (!ev) return 0;
  const choices = (st.gender === 'female' && ev.femaleChoices) ? ev.femaleChoices : ev.choices;
  let best = 0, bestV = -Infinity;
  choices.forEach((c, i) => {
    const v = (c.npcEffects ?? []).reduce((a, n) => a + (n.intimacyChange ?? 0), 0);
    if (v > bestV) { bestV = v; best = i; }
  });
  return best;
}

function runOnce(seed: number, gender: 'male' | 'female', parents: [ParentStrength, ParentStrength], policy: Policy): Fire[] {
  const store = useGameStore.getState();
  store.resetGame();
  store.startGame(gender, parents);
  useGameStore.setState({ state: { ...useGameStore.getState().state!, rngSeed: seed >>> 0 || 1 } });
  if (policy === 'grind') useGameStore.getState().setRoutine('self-study', 'self-study');
  else useGameStore.getState().setRoutine('self-study', 'light-exercise');
  let guard = 0;
  while (guard++ < 50000) {
    const st = useGameStore.getState().state!;
    if (st.phase === 'ending') break;
    const api = useGameStore.getState();
    if (st.phase === 'weekday') {
      // first·bond는 사교형(도달형 임계 40~90에 닿으려면 말걸기가 필요하다), grind는 도윤만. 플레이어가 할 수 있는 것만.
      for (const n of st.npcs) {
        if ((policy !== 'grind' || n.id === 'doyun') && isNpcInteractable(n, st)) api.talkToNpc(n.id);
      }
      if (policy !== 'grind') {
        const r = api.talkToHome();
        if (r.kind === 'event' && r.event.choices && r.event.choices.length > 0) api.resolveParentTalkChoice(r.event.id, 0);
      }
      api.setWeekendChoices(policy === 'grind' ? ['self-study', 'self-study'] : ['self-study', 'club']);
      api.setVacationChoices(policy === 'grind' ? ['self-study', 'self-study', 'self-study'] : ['self-study', 'creative', 'rest']);
      api.advanceWeek();
    } else if (st.phase === 'event') {
      api.resolveEvent(policy === 'bond' ? bondChoice(st) : 0);
    } else if (st.phase === 'result') {
      api.setPhase('weekday');
    } else if (st.phase === 'year-end') {
      api.advanceFromYearEnd();
    } else {
      break;
    }
  }
  const final = useGameStore.getState().state as GameState;
  if (final.phase !== 'ending') throw new Error(`seed ${seed}: 엔딩에 못 닿았다(Y${final.year}W${final.week} ${final.phase})`);
  return final.events.filter(e => TARGETS.includes(e.id) || HARD_CRISIS_IDS.has(e.id)).map(e => ({ id: e.id, year: e.year ?? 0, week: e.week ?? 0 }));
}

const SEEDS = (process.env.SEEDS ?? '1,7,42,101,777,2024,31337,98765,4242,13579,8888,55555').split(',').map(Number);
const CONFIGS: Array<{ gender: 'male' | 'female'; parents: [ParentStrength, ParentStrength] }> = [
  { gender: 'male', parents: ['emotional', 'wealth'] },
  { gender: 'female', parents: ['emotional', 'wealth'] },
  { gender: 'male', parents: ['freedom', 'emotional'] },
  { gender: 'female', parents: ['freedom', 'wealth'] },
];

const POLICIES: Policy[] = (process.env.POLICY ?? 'first,bond').split(',') as Policy[];

function measure(): { runs: number; fires: Fire[][] } {
  const fires: Fire[][] = [];
  for (const p of POLICIES) for (const c of CONFIGS) for (const s of SEEDS) fires.push(runOnce(s, c.gender, c.parents, p));
  return { runs: fires.length, fires };
}

// 판 단위 비교라 두 팔(기준선·게이트)을 같은 시드·구성·정책 순서로 돈다 — i번째 판끼리 짝이다.
// 한 팔이 4분 남짓이라 팔마다 프로세스를 나눠 돌리고(OUT), 마지막에 짝지어 비교한다(COMPARE).
//   GATE=… OUT=gate.json  /  OUT=base.json  /  COMPARE=base.json,gate.json
interface ArmOut { arm: Arm; gateIds: string[]; policies: Policy[]; fires: Fire[][] }

function table(base: ArmOut, gate?: ArmOut): void {
  if (gate && gate.fires.length !== base.fires.length) throw new Error('두 팔의 판 수가 다르다 — 짝이 안 맞는다');
  const season = (w: number) => (!getWeekInfo(w).isVacation ? 'sem' : w <= 24 ? 'sum' : 'win');
  console.log(`판 수 ${base.fires.length} (정책 ${base.policies.join('+')} × 시드 ${SEEDS.length} × 구성 ${CONFIGS.length})` +
    (gate ? ` · 게이트 ${gate.gateIds.join(',')}` : ''));
  console.log(['id'.padEnd(26), '발동판', '총발동', '학기', '여름', '겨울', '주차범위', ...(gate ? ['| 게이트 발동판', '총발동', '방학', '유실판'] : [])].join(' '));
  const ids = [...new Set(base.fires.flat().map(f => f.id).concat(TARGETS))];
  for (const id of ids) {
    const stat = (a: ArmOut) => {
      const per = a.fires.map(f => f.filter(x => x.id === id));
      const all = per.flat();
      const ws = all.map(h => h.week);
      return {
        per, runs: per.filter(x => x.length).length, n: all.length,
        sem: all.filter(h => season(h.week) === 'sem').length,
        sum: all.filter(h => season(h.week) === 'sum').length,
        win: all.filter(h => season(h.week) === 'win').length,
        range: ws.length ? `W${Math.min(...ws)}~W${Math.max(...ws)}` : '-',
      };
    };
    const b = stat(base);
    const cols = [id.padEnd(26), String(b.runs).padStart(5), String(b.n).padStart(6), String(b.sem).padStart(4), String(b.sum).padStart(4), String(b.win).padStart(4), b.range.padStart(9)];
    if (gate) {
      const g = stat(gate);
      const lost = b.per.filter((x, i) => x.length && !g.per[i].length).length;
      cols.push('|', String(g.runs).padStart(12), String(g.n).padStart(6), String(g.sum + g.win).padStart(4), String(lost).padStart(6));
    }
    console.log(cols.join(' '));
  }
}

if (process.env.COMPARE) {
  const [bp, gp] = process.env.COMPARE.split(',');
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as ArmOut;
  table(read(bp), gp ? read(gp) : undefined);
} else {
  const gateIds = (process.env.GATE ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const arm: Arm = gateIds.length ? 'gate' : 'base';
  const restore = arm === 'gate' ? applyGate(gateIds) : () => {};
  let out: ArmOut;
  try { out = { arm, gateIds, policies: POLICIES, fires: measure().fires }; } finally { restore(); }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
  table(out);
}
