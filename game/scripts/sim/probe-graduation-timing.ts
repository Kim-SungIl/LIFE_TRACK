// 앵커 도달형 예약(reach.anchorWeek) 실측 — 졸업·합격 도달형 6건의 표시 주·유실·연쇄 유실·효과.
//
// 실제 store 루프(고정 주차·chain cap·주당 도달형 1개·쿨다운·RNG 전부 실물)에서 두 팔을 짝지어 돈다.
//   off — 앵커를 뗀 판(= 예약 장치 이전 main과 같은 페이싱)
//   on  — 실구현
// 모드:
//   natural — 주입 없음(정책 first·bond × 구성 4 × 시드). 이 하네스가 닿는 건 하은·수빈뿐이다 —
//             나머지 4건의 발동 0은 적격주 0이지 결함 부재의 근거가 아니다.
//   hold:C  — 대상 학년에서 W<C 동안 친밀도를 tier−12 이하로 묶고, W>=C 첫 이벤트 국면에서 tier+1로 올린 뒤
//             (chain에서 fresh) 학년 끝까지 tier 바닥 유지
//   free:C  — 같은 방식으로 넘기되 넘긴 뒤엔 바닥 없음(자연 감쇠)
//
// 실행(팔·모드마다 프로세스를 나눠 병렬로, 마지막에 짝지어 집계):
//   cd game && ARM=on MODE=hold:22 OUT=/tmp/x/on.hold.22.json npx tsx scripts/sim/probe-graduation-timing.ts
//   cd game && COMPARE=/tmp/x npx tsx scripts/sim/probe-graduation-timing.ts
//
// 자기검사: 앵커 컷이 6건이 아니거나, on 팔에서 예약이 한 번도 안 일어나면 throw — 장치가 안 돈 채
// "유실 0"이 나오는 공허한 측정을 막는다(off 팔과 on 팔이 같아도 초록이 되는 함정).

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGameStore } from '../../src/engine/store';
import { GAME_EVENTS } from '../../src/engine/events';
import { calculateEnding } from '../../src/engine/ending';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import type { GameEvent, GameState, ParentStrength } from '../../src/engine/types';

const ALL = GAME_EVENTS as GameEvent[];
const ANCH = ALL.filter(e => e.reach?.anchorWeek !== undefined);
if (ANCH.length !== 6) throw new Error(`앵커 컷 ${ANCH.length}건(기대 6) — 측정 대상이 바뀌었다`);
const TARGETS = ANCH.map(e => e.id);
const ANCHOR = Object.fromEntries(ANCH.map(e => [e.id, e.reach!.anchorWeek!]));
const REACH_IDS = new Set(ALL.filter(e => e.reach).map(e => e.id));

type Policy = 'first' | 'bond';
interface Run {
  key: string;
  shown: Record<string, number | null>;
  reserved: Record<string, number | null>;
  seq: string[];
  stats: Record<string, number>;
  ending: { achievement: string; happiness: string; career: string; title: string };
}

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

function runOnce(seed: number, gender: 'male' | 'female', parents: [ParentStrength, ParentStrength], policy: Policy,
  mode: string, cross: number): Run {
  const store = useGameStore.getState();
  store.resetGame();
  store.startGame(gender, parents);
  useGameStore.setState({ state: { ...useGameStore.getState().state!, rngSeed: seed >>> 0 || 1 } });
  useGameStore.getState().setRoutine('self-study', 'light-exercise');
  const crossed: Record<string, boolean> = {};
  for (let guard = 0; guard < 60000; guard++) {
    let st = useGameStore.getState().state!;
    if (st.phase === 'ending') break;
    if (mode !== 'natural' && (st.phase === 'weekday' || st.phase === 'event')) {
      let touched = false;
      const npcs = st.npcs.map(n => ({ ...n }));
      for (const e of ANCH) {
        const { npc, tier, year } = e.reach!;
        if (st.year !== year) continue;
        const n = npcs.find(x => x.id === npc)!;
        if (!n.met) { n.met = true; touched = true; }
        if (!crossed[e.id]) {
          if (st.week > cross || (st.week === cross && st.phase === 'event')) {
            n.intimacy = Math.max(n.intimacy, tier + 1); crossed[e.id] = true; touched = true;
          } else if (n.intimacy > tier - 12) { n.intimacy = tier - 12; touched = true; }
        } else if (mode === 'hold' && n.intimacy < tier) { n.intimacy = tier; touched = true; }
      }
      if (touched) { useGameStore.setState({ state: { ...st, npcs } }); st = useGameStore.getState().state!; }
    }
    const api = useGameStore.getState();
    if (st.phase === 'weekday') {
      for (const n of st.npcs) if (isNpcInteractable(n, st)) api.talkToNpc(n.id);
      const r = api.talkToHome();
      if (r.kind === 'event' && r.event.choices && r.event.choices.length > 0) api.resolveParentTalkChoice(r.event.id, 0);
      api.setWeekendChoices(['self-study', 'club']);
      api.setVacationChoices(['self-study', 'creative', 'rest']);
      api.advanceWeek();
    } else if (st.phase === 'event') {
      api.resolveEvent(policy === 'bond' ? bondChoice(st) : 0);
    } else if (st.phase === 'result') {
      api.setPhase('weekday');
    } else if (st.phase === 'year-end') {
      api.advanceFromYearEnd();
    } else break;
  }
  const f = useGameStore.getState().state as GameState;
  if (f.phase !== 'ending') throw new Error(`seed ${seed}: 엔딩 미도달 Y${f.year}W${f.week} ${f.phase}`);
  const e = calculateEnding(f);
  return {
    key: `${policy}/${gender}/${parents.join('+')}/${seed}`,
    shown: Object.fromEntries(TARGETS.map(t => [t, f.events.find(x => x.id === t)?.week ?? null])),
    reserved: Object.fromEntries(TARGETS.map(t => [t, f.reachReservations?.[t]?.week ?? null])),
    seq: f.events.map(x => `${x.id}@${x.year}.${x.week}`),
    stats: { ...f.stats },
    ending: { achievement: e.achievement, happiness: e.happiness, career: e.career, title: e.title },
  };
}

function measure(arm: 'on' | 'off', modeSpec: string): Run[] {
  const [mode, c] = modeSpec.split(':');
  const saved = ANCH.map(e => [e, e.reach!.anchorWeek] as const);
  if (arm === 'off') for (const [e] of saved) e.reach!.anchorWeek = undefined;
  try {
    const seeds = (process.env.SEEDS ?? (mode === 'natural' ? '1,7,42,101,777,2024' : '1,7,42,101,777,2024')).split(',').map(Number);
    const configs: Array<[('male' | 'female'), [ParentStrength, ParentStrength]]> = mode === 'natural'
      ? [['male', ['emotional', 'wealth']], ['female', ['emotional', 'wealth']], ['male', ['freedom', 'emotional']], ['female', ['freedom', 'wealth']]]
      : [['male', ['emotional', 'wealth']], ['female', ['emotional', 'wealth']]];
    const policies: Policy[] = mode === 'natural' ? ['first', 'bond'] : ['bond'];
    const runs: Run[] = [];
    for (const p of policies) for (const [g, par] of configs) for (const s of seeds) runs.push(runOnce(s, g, par, p, mode, Number(c ?? 0)));
    return runs;
  } finally { for (const [e, a] of saved) e.reach!.anchorWeek = a; }
}

// ===== 집계 =====
const FIT: Record<string, [number, number]> = {
  'seoa-torn-endless-line': [44, 48], 'haeun-hs-leaving': [44, 48], 'seoa-ending-page': [44, 48],
  'siwoo-where-you-stood': [43, 46], 'yerin-not-a-trade': [40, 46], 'subin-hs-after': [40, 48],
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const se = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1) / Math.max(1, xs.length)); };

function compare(dir: string): void {
  const files = readdirSync(dir).filter(f => f.startsWith('on.') && f.endsWith('.json'));
  const groups: Record<string, Array<[Run, Run]>> = { natural: [], inject: [] };
  for (const f of files) {
    const on = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Run[];
    const off = JSON.parse(readFileSync(join(dir, f.replace(/^on\./, 'off.')), 'utf8')) as Run[];
    if (on.length !== off.length || on.some((r, i) => r.key !== off[i].key)) throw new Error(`${f}: 짝이 안 맞는다`);
    (f === 'on.natural.json' ? groups.natural : groups.inject).push(...on.map((r, i) => [off[i], r] as [Run, Run]));
  }
  const reservedTotal = Object.values(groups).flat().reduce((a, [, on]) => a + Object.values(on.reserved).filter(v => v !== null).length, 0);
  if (reservedTotal === 0) throw new Error('on 팔에서 예약이 0건 — 예약 장치가 안 돌았다(측정 공허)');
  console.log(`예약 발생 ${reservedTotal}건 (자기검사 통과)`);
  for (const [g, pairs] of Object.entries(groups)) {
    if (pairs.length === 0) continue;
    console.log(`\n## ${g} — ${pairs.length}판 짝`);
    console.log('| id | off 발동 | on 발동 | 유실 | 획득 | off 시점 맞음 | on 시점 맞음 | on 표시 주 |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const t of TARGETS) {
      const [lo, hi] = FIT[t];
      const fit = (w: number | null) => w !== null && w >= lo && w <= hi;
      const offN = pairs.filter(([a]) => a.shown[t] !== null).length;
      const onN = pairs.filter(([, b]) => b.shown[t] !== null).length;
      const lost = pairs.filter(([a, b]) => a.shown[t] !== null && b.shown[t] === null).length;
      const gained = pairs.filter(([a, b]) => a.shown[t] === null && b.shown[t] !== null).length;
      const hist: Record<number, number> = {};
      for (const [, b] of pairs) if (b.shown[t] !== null) hist[b.shown[t]!] = (hist[b.shown[t]!] ?? 0) + 1;
      const early = pairs.filter(([, b]) => b.shown[t] !== null && b.shown[t]! < ANCHOR[t]).length;
      if (early > 0) throw new Error(`${t}: on 팔에서 앵커 전 표시 ${early}판 — 장치 결함`);
      console.log(`| ${t} | ${offN} | ${onN} | ${lost} | ${gained} | ${pairs.filter(([a]) => fit(a.shown[t])).length} | ${pairs.filter(([, b]) => fit(b.shown[t])).length} | ${Object.entries(hist).map(([w, n]) => `W${w}×${n}`).join(' ') || '-'} |`);
    }
    // 비대상 도달형 — 표시 주를 옮겨 다른 컷이 밀려 죽지 않았나(학년 넘는 쿨다운 연쇄 포함).
    const count = (rs: Run[]) => { const c: Record<string, number> = {}; for (const r of rs) for (const x of r.seq) { const id = x.split('@')[0]; if (REACH_IDS.has(id) && !TARGETS.includes(id)) c[id] = (c[id] ?? 0) + 1; } return c; };
    const co = count(pairs.map(p => p[0])), cn = count(pairs.map(p => p[1]));
    const diff = [...new Set([...Object.keys(co), ...Object.keys(cn)])].map(id => [id, (cn[id] ?? 0) - (co[id] ?? 0)] as const).filter(([, d]) => d !== 0).sort((a, b) => a[1] - b[1]);
    const tot = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
    console.log(`\n비대상 도달형 총 발동 ${tot(co)} → ${tot(cn)} · 개별 Δ: ${diff.map(([id, d]) => `${id} ${d > 0 ? '+' : ''}${d}`).join(', ') || '없음'}`);
    const strip = (r: Run) => r.seq.filter(x => !TARGETS.includes(x.split('@')[0]));
    console.log(`비대상 사건 열 분기 ${pairs.filter(([a, b]) => strip(a).join() !== strip(b).join()).length}/${pairs.length}판 · 판당 사건 수 Δ ${mean(pairs.map(([a, b]) => b.seq.length - a.seq.length)).toFixed(2)} (기준 ${mean(pairs.map(([a]) => a.seq.length)).toFixed(1)})`);
    console.log('최종 스탯 부호 Δ(on−off ± SE): ' + ['academic', 'social', 'mental', 'talent', 'health'].map(k => { const d = pairs.map(([a, b]) => b.stats[k] - a.stats[k]); return `${k} ${mean(d) >= 0 ? '+' : ''}${mean(d).toFixed(2)}±${se(d).toFixed(2)}`; }).join(' · '));
    const flip = (k: 'achievement' | 'happiness' | 'career') => { const c: Record<string, number> = {}; for (const [a, b] of pairs) if (a.ending[k] !== b.ending[k]) { const key = `${a.ending[k]}→${b.ending[k]}`; c[key] = (c[key] ?? 0) + 1; } return Object.entries(c).map(([kk, n]) => `${kk}×${n}`).join(', ') || '없음'; };
    console.log(`엔딩 뒤집힘 — 성취 ${flip('achievement')} · 행복 ${flip('happiness')} · 진로 ${flip('career')}`);
  }
}

if (process.env.COMPARE) compare(process.env.COMPARE);
else {
  const arm = (process.env.ARM ?? 'on') as 'on' | 'off';
  const mode = process.env.MODE ?? 'natural';
  const runs = measure(arm, mode);
  if (arm === 'on' && !runs.some(r => Object.values(r.reserved).some(v => v !== null)) && mode !== 'natural') {
    throw new Error(`${mode}: on 팔 ${runs.length}판에서 예약 0건 — 장치가 안 돌았다`);
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(runs));
  console.log(`${arm} ${mode}: ${runs.length}판`);
}
