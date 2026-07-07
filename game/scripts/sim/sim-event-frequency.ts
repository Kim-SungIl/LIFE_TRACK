// 이벤트 빈도 측정 — 실제 store(체인 로직 포함)를 헤드리스 구동해 다중시드로 집계.
// processWeek 단독 sim과 달리 store의 conditional/milestone 체인(주당 cap 2~3)을 그대로 탄다.
// 자동 발동 이벤트만 카운트(말걸기 미니톡은 플레이어 개시라 제외).
// 실행: cd game && npx tsx scripts/sim/sim-event-frequency.ts

// localStorage 폴리필 (store가 save/load에 사용)
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { useGameStore } from '../../src/engine/store';
import { GAME_EVENTS } from '../../src/engine/events';
import { SCHOOL_LIFE_EVENTS } from '../../src/engine/events/school-life';
import { FOLLOWUP_EVENT_IDS } from '../../src/engine/events/constants';
import type { GameState, ParentStrength } from '../../src/engine/types';

const WEEKS = 336; // 7년 × 48주
const schoolLifeIds = new Set(SCHOOL_LIFE_EVENTS.map(e => e.id));
const reachIds = new Set(GAME_EVENTS.filter(e => e.reach).map(e => e.id));
const totalReach = reachIds.size;

interface RunResult {
  total: number;          // 자동 발동 이벤트(state.events)
  perWeek: number;
  weeksWithEvent: number;
  dist: Record<number, number>; // events-in-a-week → 주 수
  cat: { reach: number; followup: number; school: number; fixed: number; conditional: number };
  reachSeen: number;
  miniTalk: number;       // NPC 미니톡(talkEventsFired) — 사교형에서만 유의미
  parentTalk: number;     // 부모 미니이벤트(parentEventsFired)
  grandTotal: number;     // 자동 + 미니톡 + 부모
  finalYear: number;
}

type Mode = 'solo' | 'social';

function categorize(ev: { id: string; reach?: unknown; week?: number }): keyof RunResult['cat'] {
  if (ev.reach) return 'reach';
  if (FOLLOWUP_EVENT_IDS.has(ev.id)) return 'followup';
  if (schoolLifeIds.has(ev.id)) return 'school';
  // 고정 주차 이벤트: GAME_EVENTS 정의에 week가 박혀 있음
  const def = GAME_EVENTS.find(e => e.id === ev.id);
  if (def && typeof def.week === 'number') return 'fixed';
  return 'conditional';
}

function runOnce(seed: number, gender: 'male' | 'female', parents: [ParentStrength, ParentStrength], mode: Mode): RunResult {
  const store = useGameStore.getState();
  store.resetGame();
  store.startGame(gender, parents);
  // 시드 명시 오버라이드 (createInitialState는 Date.now 시딩이라 비결정 → 고정)
  useGameStore.setState({ state: { ...useGameStore.getState().state!, rngSeed: seed >>> 0 || 1 } });
  useGameStore.getState().setRoutine('self-study', 'light-exercise');

  let guard = 0;
  while (guard++ < 50000) {
    const st = useGameStore.getState().state!;
    if (st.phase === 'ending') break;
    const api = useGameStore.getState();
    if (st.phase === 'weekday') {
      // 사교형: 주마다 met NPC 전원 + 집에 말걸기 (미니톡/부모 이벤트 발동 — 주당 각 1개, pending 소비)
      if (mode === 'social') {
        for (const n of st.npcs) { if (n.met) api.talkToNpc(n.id); }
        const r = api.talkToHome();
        if (r.kind === 'event' && r.event.choices && r.event.choices.length > 0) {
          api.resolveParentTalkChoice(r.event.id, 0);
        }
      }
      api.setWeekendChoices(['self-study', 'club']);
      api.setVacationChoices(['self-study', 'creative', 'rest']);
      api.advanceWeek();
    } else if (st.phase === 'event') {
      api.resolveEvent(0);
    } else if (st.phase === 'result') {
      api.setPhase('weekday');
    } else if (st.phase === 'year-end') {
      api.advanceFromYearEnd();
    } else {
      break;
    }
  }

  const final = useGameStore.getState().state as GameState;
  // 자동 발동 이벤트 = state.events (말걸기는 talkEventsFired라 제외됨)
  const evs = final.events;
  const byWeek = new Map<string, number>();
  const cat = { reach: 0, followup: 0, school: 0, fixed: 0, conditional: 0 };
  const reachSeenSet = new Set<string>();
  for (const e of evs) {
    const k = `${e.year}-${e.week}`;
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
    cat[categorize(e)]++;
    if (reachIds.has(e.id)) reachSeenSet.add(e.id);
  }
  const dist: Record<number, number> = {};
  for (const c of byWeek.values()) dist[c] = (dist[c] ?? 0) + 1;
  const miniTalk = (final.talkEventsFired ?? []).length;
  const parentTalk = (final.parentEventsFired ?? []).length;
  return {
    total: evs.length,
    perWeek: evs.length / WEEKS,
    weeksWithEvent: byWeek.size,
    dist,
    cat,
    reachSeen: reachSeenSet.size,
    miniTalk,
    parentTalk,
    grandTotal: evs.length + miniTalk + parentTalk,
    finalYear: final.year,
  };
}

// ===== 다중시드 실행 =====
const SEEDS = [1, 7, 42, 101, 777, 2024, 31337, 98765];
const configs: Array<{ label: string; gender: 'male' | 'female'; parents: [ParentStrength, ParentStrength] }> = [
  { label: 'male/균형', gender: 'male', parents: ['emotional', 'wealth'] },
  { label: 'female/균형', gender: 'female', parents: ['emotional', 'wealth'] },
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (n: number) => n.toFixed(2);

for (const mode of ['solo', 'social'] as Mode[]) {
  console.log(`\n############ 플레이스타일: ${mode === 'solo' ? '관계 방치형(말걸기 안 함)' : '사교형(매주 전원 말걸기+집)'} ############`);
  for (const cfg of configs) {
    const runs = SEEDS.map(s => runOnce(s, cfg.gender, cfg.parents, mode));
    console.log(`\n===== ${cfg.label} (시드 ${SEEDS.length}개) =====`);
    const totals = runs.map(r => r.total);
    console.log(`자동 이벤트: 평균 ${fmt(avg(totals))} (범위 ${Math.min(...totals)}~${Math.max(...totals)}) = 주당 ${fmt(avg(runs.map(r => r.perWeek)))}`);
    const grand = runs.map(r => r.grandTotal);
    console.log(`전체(자동+미니톡+부모): 평균 ${fmt(avg(grand))} = 주당 ${fmt(avg(grand) / WEEKS)}`);
    console.log(`  ├ 미니톡: 평균 ${fmt(avg(runs.map(r => r.miniTalk)))} / 부모: 평균 ${fmt(avg(runs.map(r => r.parentTalk)))}`);
    const weeksWith = runs.map(r => r.weeksWithEvent);
    console.log(`자동 이벤트 발생 주: ${fmt(avg(weeksWith) / WEEKS * 100)}% (${fmt(avg(weeksWith))}/${WEEKS})`);
    const distKeys = [1, 2, 3, 4];
    const distAvg = distKeys.map(k => avg(runs.map(r => r.dist[k] ?? 0)));
    console.log('주당 자동 이벤트 분포(평균 주 수):', distKeys.map((k, i) => `${k}개=${fmt(distAvg[i])}`).join(' / '));
    const catKeys: Array<keyof RunResult['cat']> = ['fixed', 'followup', 'reach', 'conditional', 'school'];
    console.log('카테고리별 평균:', catKeys.map(k => `${k} ${fmt(avg(runs.map(r => r.cat[k])))}`).join(' / '));
    const reachSeen = runs.map(r => r.reachSeen);
    console.log(`도달형 관람: 평균 ${fmt(avg(reachSeen))} / ${totalReach} (${fmt(avg(reachSeen) / totalReach * 100)}%)`);
  }
}
