/**
 * T67 성장 둔화 문장 — 실측 하네스.
 *
 * 무엇을 재나:
 *   ① 원시 분포 — 매주 "가장 많이 깎은 요인"과 그 양(임계·쿨다운 전). 임계를 여기서 정한다.
 *   ② 출력 빈도 — 제품 판정(pickGrowthReason, 임계+쿨다운)으로 실제 결산에 문장이 뜬 주의 비율과
 *      요인별 몫. 한 문장만 매주 뜨면 소음이고, 한 요인이 영영 안 뜨면 죽은 문장이다.
 *
 * 하네스는 sim-qa-playthrough의 runPersona를 그대로 쓴다(이벤트 해결·학년 전환·말걸기 순서가 제품과
 * 같은 하네스). processWeek만 감싸서 그 주 로그를 엿본다 — 엔진 경로는 손대지 않는다.
 * 시드는 hashInitialState 파생(다중시드). 위반 페르소나(invalid)는 섞지 않는다.
 *
 * 실행: npx tsx scripts/sim/sim-growth-reason.ts [시드수=3]
 */
import { writeFileSync } from 'node:fs';
import { processWeek } from '../../src/engine/gameEngine';
import { hashInitialState } from '../../src/engine/rng';
import {
  GROWTH_DRAG_FACTORS, GROWTH_REASON_GAP_WEEKS, GROWTH_REASON_MIN_LOSS,
  GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS, GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS, GOOD_WEEK_AXIS_GAIN,
  dominantGrowthDrag, sumDrag, type GrowthDragFactor,
} from '../../src/engine/growthDrag';
import type { GameState } from '../../src/engine/types';
import { PERSONAS, runPersona, DEFAULT_DEPS } from './sim-qa-playthrough';

const seeds = Number(process.argv[2]) || 3;
const valid = PERSONAS.filter(p => !p.invalid);
if (valid.length === 0) throw new Error('유효 페르소나 0 — 측정이 공허하다');

interface WeekRow {
  persona: string;
  seed: number;
  year: number;
  dominant: GrowthDragFactor | null;
  loss: number;
  ideal: number;
  applied: number;
  shown: GrowthDragFactor | null;
  perFactor: Record<GrowthDragFactor, number>;
}
const rows: WeekRow[] = [];

for (const p of valid) {
  for (let k = 0; k < seeds; k++) {
    const seed = hashInitialState({ gender: p.gender, parents: p.parents, startedAt: k });
    const wrapped: typeof processWeek = (s: GameState, map?: Record<string, string>) => {
      const next = processWeek(s, map);
      const log = next.weekLog;
      const ledger = log?.growthLedger;
      const top = dominantGrowthDrag(ledger);
      const perFactor = Object.fromEntries(GROWTH_DRAG_FACTORS.map(f => [f, ledger ? sumDrag(ledger, f) : 0])) as Record<GrowthDragFactor, number>;
      rows.push({
        persona: p.name,
        seed: k,
        year: log?.year ?? 0,
        dominant: top?.factor ?? null,
        loss: top?.loss ?? 0,
        ideal: ledger?.ideal ?? 0,
        applied: ledger?.applied ?? 0,
        shown: log?.growthReason?.factor ?? null,
        perFactor,
      });
      return next;
    };
    runPersona(p, seed, { ...DEFAULT_DEPS, processWeek: wrapped });
  }
}

const N = rows.length;
const pct = (n: number, d = N) => `${(n / d * 100).toFixed(1)}%`;
const quant = (xs: number[], q: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

console.log(`# T67 성장 둔화 — 유효 페르소나 ${valid.length}종 × 시드 ${seeds} = ${valid.length * seeds}판, ${N}주\n`);
console.log(`판정 상수: 임계 ${GROWTH_REASON_MIN_LOSS} · 전체 간격 ${GROWTH_REASON_GAP_WEEKS}주 · 날씨 재발 ${GROWTH_REASON_SITUATIONAL_REPEAT_WEEKS}주 · 지형 재발 ${GROWTH_REASON_STRUCTURAL_REPEAT_WEEKS}주 · 잘 는 주(축 ${GOOD_WEEK_AXIS_GAIN}+) 제외\n`);

const losses = rows.map(r => r.loss);
console.log('## ① 주 원인 손실량 분포 (모든 주, 원시)');
console.log(`p25 ${quant(losses, 0.25).toFixed(2)} · p50 ${quant(losses, 0.5).toFixed(2)} · p75 ${quant(losses, 0.75).toFixed(2)} · p90 ${quant(losses, 0.9).toFixed(2)} · max ${quant(losses, 1).toFixed(2)}`);
const applieds = rows.map(r => r.applied);
console.log(`실제 오른 몫(활동, 4축 합) p50 ${quant(applieds, 0.5).toFixed(2)} · 막히지 않았다면 p50 ${quant(rows.map(r => r.ideal), 0.5).toFixed(2)}\n`);

console.log('| 요인 | 주 원인인 주 | 그 주 손실 p50 | p90 | 임계 이상 주 |');
console.log('|---|---|---|---|---|');
for (const f of GROWTH_DRAG_FACTORS) {
  const mine = rows.filter(r => r.dominant === f);
  const ls = mine.map(r => r.loss);
  const over = mine.filter(r => r.loss >= GROWTH_REASON_MIN_LOSS).length;
  console.log(`| ${f} | ${pct(mine.length)} | ${ls.length ? quant(ls, 0.5).toFixed(2) : '-'} | ${ls.length ? quant(ls, 0.9).toFixed(2) : '-'} | ${pct(over)} |`);
}

console.log('\n## 임계 후보별 — 임계 이상인 주의 비율(쿨다운 전)');
for (const t of [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]) {
  console.log(`임계 ${t}: ${pct(rows.filter(r => r.loss >= t).length)}`);
}

console.log('\n## ② 출력 빈도 (제품 판정 = 임계 + 쿨다운)');
const shown = rows.filter(r => r.shown);
console.log(`문장이 뜬 주: ${shown.length}/${N} (${pct(shown.length)}) — 대략 ${(N / Math.max(1, shown.length)).toFixed(1)}주에 한 번`);
console.log('| 요인 | 뜬 횟수 | 뜬 문장 중 몫 |');
console.log('|---|---|---|');
for (const f of GROWTH_DRAG_FACTORS) {
  const c = shown.filter(r => r.shown === f).length;
  console.log(`| ${f} | ${c} | ${pct(c, Math.max(1, shown.length))} |`);
}

// 같은 요인이 연달아(쿨다운 사이를 건너) 몇 번 이어지는가 — 같은 말만 반복되면 소음
let maxRun = 0;
let curRun = 0;
let prev: GrowthDragFactor | null = null;
let prevPersona = '';
for (const r of rows) {
  if (r.persona !== prevPersona) { prev = null; curRun = 0; prevPersona = r.persona; }
  if (!r.shown) continue;
  curRun = r.shown === prev ? curRun + 1 : 1;
  prev = r.shown;
  maxRun = Math.max(maxRun, curRun);
}
console.log(`\n같은 요인 연속 출력 최장: ${maxRun}회`);

console.log('\n## 페르소나별 (뜬 주 비율 · 최다 요인)');
for (const p of valid) {
  const mine = rows.filter(r => r.persona === p.name);
  const sh = mine.filter(r => r.shown);
  const counts: Partial<Record<GrowthDragFactor, number>> = {};
  for (const r of sh) counts[r.shown!] = (counts[r.shown!] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  console.log(`${p.name}: ${pct(sh.length, mine.length)} · ${top ? `${top[0]} ${pct(top[1] ?? 0, sh.length)}` : '-'} · ${JSON.stringify(counts)}`);
}

// 원시 행을 파일로 — 임계 재조정 분석용(DUMP=경로)
if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(rows));
