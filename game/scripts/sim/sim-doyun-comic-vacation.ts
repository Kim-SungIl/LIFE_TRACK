// doyun-comic-share 방학 가드의 발동률 — Y1 전용 사건이라 겨울방학(W43~48)에 떴을 발동은 가드로 사라지면 다시 오지 않는다.
//
// 기존 store 하네스(sim-reach-vacation-gate.ts)는 이 사건에 144판 동안 0회 닿았다: 말걸기만으로는 도윤 친밀도가
// 오르지 않고 감쇠한다(W5 25 → W41 20). 그래서 bondTitleReach.test.ts의 엔진 미러(동행 분산 + 말걸기)를 쓴다.
//   · spread: bond-max 그대로(동행을 최저 친밀도 순으로 나눠 붙인다)
//   · focus : 동행 슬롯 전부를 도윤에게 — 도윤과 확실히 친해지는 판
// Y1만 돈다(사건이 year===1 전용). 체인 픽은 resolveEventLikeStore가 store와 같은 로직으로 탄다.
//
// 실행(가드 전후는 트리를 바꿔 같은 스크립트를 돌린다 — 기준선은 깨끗한 트리에서):
//   cd game && OUT=a.json npx tsx scripts/sim/sim-doyun-comic-vacation.ts
//   COMPARE=base.json,pr.json npx tsx scripts/sim/sim-doyun-comic-vacation.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { NPC_COMPANION_ACTIVITIES } from '../../src/engine/activities';
import { createInitialState, getWeekInfo, processWeek } from '../../src/engine/gameEngine';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import { getAvailableNpcEvents } from '../../src/engine/talkSystem';
import type { GameState } from '../../src/engine/types';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../lib/y1-sim-resolve';
import { PERSONAS, pickChoice } from './sim-qa-playthrough';

const BOND = PERSONAS.find(p => p.name === 'bond-max');
if (!BOND) throw new Error('bond-max 페르소나가 없다 — 측정이 공허하다');

type Policy = 'spread' | 'focus';
interface Run { policy: Policy; gender: 'male' | 'female'; seed: number; reached: boolean; fires: number[]; chainFires: number[]; doyunEnd: number }

function playY1(policy: Policy, gender: 'male' | 'female', seed: number): Run {
  const p = { ...BOND!, gender };
  let s: GameState = createInitialState(p.gender, p.parents, { rngSeed: seed });
  s.routineSlot2 = p.routineSlot2;
  s.routineSlot3 = p.routineSlot3;
  let reached = false;
  for (let w = 0; w < 60 && s.year === 1; w++) {
    s.weekendChoices = p.weekend;
    s.vacationChoices = p.vacation;
    const candidates = s.npcs.filter(n => isNpcInteractable(n, s)).sort((a, b) => b.intimacy - a.intimacy);
    const target = candidates.find(n => n.intimacy >= 30 && getAvailableNpcEvents(s, n.id).length > 0) ?? candidates[0];
    if (target) s = talkToNpcLikeStore(s, target.id);

    const acts = getWeekInfo(s.week).isVacation ? s.vacationChoices : s.weekendChoices;
    const eligible = [...new Set(acts.filter(a => NPC_COMPANION_ACTIVITIES.includes(a)))];
    const met = s.npcs.filter(n => n.met);
    let npcMap: Record<string, string> | undefined;
    if (eligible.length > 0 && met.length > 0) {
      const doyun = met.find(n => n.id === 'doyun');
      const sorted = [...met].sort((a, b) => a.intimacy - b.intimacy);
      npcMap = Object.fromEntries(eligible.map((a, i) => [a, policy === 'focus' && doyun ? 'doyun' : sorted[i % sorted.length].id]));
    }
    s = processWeek(s, npcMap);
    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      s = resolveEventLikeStore(s, pickChoice(choices, p.policy));
    }
    const d = s.npcs.find(n => n.id === 'doyun');
    if (s.year === 1 && d?.met && d.intimacy >= 30) reached = true;
    if (s.phase === 'year-end') break;
  }
  const y1 = s.events.filter(e => (e.year ?? 1) === 1);
  const fires = y1.filter(e => e.id === 'doyun-comic-share').map(e => e.week ?? 0);
  // 체인 경로 = 같은 (학년, 주)에 먼저 해결된 다른 사건이 있다(store.resolveEvent의 chain 픽).
  const chainFires = y1.flatMap((e, i) => e.id === 'doyun-comic-share' && y1.slice(0, i).some(p => p.week === e.week) ? [e.week ?? 0] : []);
  const doyunEnd = s.npcs.find(n => n.id === 'doyun')?.intimacy ?? 0;
  return { policy, gender, seed, reached, fires, chainFires, doyunEnd };
}

const SEEDS = Array.from({ length: Number(process.env.NSEEDS ?? 24) }, (_, i) => 1 + i * 37);

function summarize(runs: Run[], label: string) {
  const reached = runs.filter(r => r.reached).length;
  const any = runs.filter(r => r.fires.length).length;
  const all = runs.flatMap(r => r.fires);
  const vac = all.filter(w => getWeekInfo(w).isVacation);
  const winter = vac.filter(w => w >= 43).length;
  const w24 = runs.filter(r => r.fires.includes(24)).length;
  const w24chain = runs.filter(r => r.chainFires.includes(24)).length;
  console.log(`${label}: 판 ${runs.length} · 게이트(친밀도 30) 도달 ${reached} · 발동판 ${any} (${(any / runs.length * 100).toFixed(1)}%) · ` +
    `총발동 ${all.length} · 방학 발동 ${vac.length} (${all.length ? (vac.length / all.length * 100).toFixed(1) : '0'}%, 겨울 ${winter}) · ` +
    `W24 발동판 ${w24} (체인 ${w24chain}) · 판당 평균 발동 ${(all.length / runs.length).toFixed(2)} · Y1말 도윤 친밀도 평균 ${(runs.reduce((a, r) => a + r.doyunEnd, 0) / runs.length).toFixed(2)}`);
}

if (process.env.COMPARE) {
  const [bp, pp] = process.env.COMPARE.split(',');
  const base = JSON.parse(readFileSync(bp, 'utf8')) as Run[];
  const pr = JSON.parse(readFileSync(pp, 'utf8')) as Run[];
  if (base.length !== pr.length) throw new Error('판 수가 다르다');
  for (const pol of ['spread', 'focus', 'all'] as const) {
    const pick = (rs: Run[]) => pol === 'all' ? rs : rs.filter(r => r.policy === pol);
    const b = pick(base), q = pick(pr);
    console.log(`\n== ${pol}`);
    summarize(b, '기준선(가드 없음)');
    summarize(q, 'PR(가드 있음)  ');
    const lost = b.filter((r, i) => r.fires.length && !q[i].fires.length).length;
    const fewer = b.filter((r, i) => q[i].fires.length < r.fires.length).length;
    console.log(`유실판(기준선 ≥1 → PR 0) ${lost} · 발동 수가 준 판 ${fewer}`);
  }
} else {
  const runs: Run[] = [];
  for (const policy of ['spread', 'focus'] as Policy[]) for (const gender of ['male', 'female'] as const) for (const seed of SEEDS) runs.push(playY1(policy, gender, seed));
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(runs));
  summarize(runs, '이 트리');
}
