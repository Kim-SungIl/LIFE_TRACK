/**
 * 표정 노출 분포 — HUD 초상이 실제로 **어느 표정을 몇 주 동안 요구하는가**.
 *
 * 목적은 하나다: 표정 그림 발주 장수를 감이 아니라 노출로 정한다.
 * `mentalToExpression`(제품 코드)이 주차마다 돌려주는 값을 그대로 센다.
 *
 * ⚠ **평균 한 줄로 인용하지 말 것.** 루틴별로 happy가 19.7%~98.2%로 흩어진다.
 * 세 루틴을 평균 내면 어느 플레이어의 경험도 아닌 숫자가 나온다 — 실제로 한 번 그렇게
 * 오판해서 발주 구성이 뒤집혔다(2026-09-16). 표는 **루틴별로** 읽고, 판단은 커버리지로 한다.
 *
 * 루틴은 SSOT(`scripts/lib/sim-routines.ts`)를 쓴다. 하네스가 루틴을 지어내면
 * 없는 활동 id가 조용히 스킵돼 피로가 반토막 난다 — `assertRoutineIds`가 그걸 막는다.
 *
 * 실행: cd game && npx tsx scripts/sim/sim-expression-exposure.ts [시드수]
 */
import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { mentalToExpression } from '../../src/components/CharacterAvatar';
import { resolveEventLikeStore } from '../lib/y1-sim-resolve';
import { SIM_ROUTINES, assertRoutineIds, type Routine } from '../lib/sim-routines';
import type { GameState } from '../../src/engine/types';

const EXPRS = ['neutral', 'happy', 'tired', 'burnout', 'sad'] as const;
type Expr = (typeof EXPRS)[number];
type Stage = 'elementary' | 'middle' | 'high';
const STAGES: Stage[] = ['elementary', 'middle', 'high'];

/** 발주 단위와 같은 구분 — 자산 프리픽스가 Y1 초등 / Y2~4 중등 / Y5+ 고등이다. */
const stageOf = (year: number): Stage => (year === 1 ? 'elementary' : year <= 4 ? 'middle' : 'high');

/** 이 비율을 넘으면 "그 루틴에서 실제로 보이는 표정"으로 센다(커버리지 판정 문턱). */
const COVERAGE_THRESHOLD = 0.05;

type Counts = Record<string, number>;
interface RunResult {
  routine: Routine;
  weeks: number;
  total: Counts;
  byStage: Record<Stage, { weeks: number; counts: Counts }>;
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);

function runRoutine(r: Routine, seeds: number): RunResult {
  const total: Counts = {};
  const byStage = {
    elementary: { weeks: 0, counts: {} as Counts },
    middle: { weeks: 0, counts: {} as Counts },
    high: { weeks: 0, counts: {} as Counts },
  };
  let weeks = 0;

  for (let seed = 1; seed <= seeds; seed++) {
    let s: GameState = createInitialState('male', r.parents, { rngSeed: seed });
    s.routineSlot2 = r.slot2;
    s.routineSlot3 = r.slot3;

    for (let i = 0; i < 420 && s.year <= 7; i++) {
      // 주말·방학 계획은 매주 다시 심는다 — 비워 두면 주말이 통째로 무부하가 되어
      // 피로 축이 죽고 tired가 관측되지 않는다.
      s.weekendChoices = r.weekend;
      s.vacationChoices = r.vacation;

      const e = (mentalToExpression(s.stats.mental, s.mentalState) ?? 'neutral') as Expr;
      const stage = stageOf(s.year);
      total[e] = (total[e] ?? 0) + 1;
      weeks++;
      byStage[stage].counts[e] = (byStage[stage].counts[e] ?? 0) + 1;
      byStage[stage].weeks++;

      s = processWeek(s);
      // 이벤트를 안 풀면 학년이 안 넘어가 Y1에서 420주를 돈다(하네스 고전 함정).
      let guard = 0;
      while (s.currentEvent && guard++ < 20) s = resolveEventLikeStore(s, 0);
      if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
      if (s.phase === 'ending') break;
    }
  }

  return { routine: r, weeks, total, byStage };
}

function main() {
  assertRoutineIds();
  const seeds = Number(process.argv[2]) || 12;
  const results = SIM_ROUTINES.map(r => runRoutine(r, seeds));
  const grandWeeks = results.reduce((a, x) => a + x.weeks, 0);

  console.log(`# 표정 노출 분포 — 루틴 ${SIM_ROUTINES.length}종 × 시드 ${seeds}\n`);

  console.log('## 루틴별 (이 표를 평균 내지 말 것)\n');
  console.log(`| 루틴 | 주차 | ${EXPRS.join(' | ')} |`);
  console.log(`|---|---:|${EXPRS.map(() => '---:|').join('')}`);
  for (const x of results) {
    console.log(
      `| ${x.routine.label} | ${x.weeks} | ` +
      EXPRS.map(e => pct(x.total[e] ?? 0, x.weeks)).join(' | ') + ' |',
    );
  }

  console.log('\n## 학교급별 (발주 단위가 학교급이다)\n');
  console.log(`| 루틴 | 학교급 | 주차 | ${EXPRS.join(' | ')} |`);
  console.log(`|---|---|---:|${EXPRS.map(() => '---:|').join('')}`);
  for (const x of results) {
    for (const st of STAGES) {
      const b = x.byStage[st];
      console.log(
        `| ${x.routine.label} | ${st} | ${b.weeks} | ` +
        EXPRS.map(e => pct(b.counts[e] ?? 0, b.weeks)).join(' | ') + ' |',
      );
    }
  }

  // **판단 기준은 평균이 아니라 커버리지다.** 한 루틴에서 98%여도 나머지에서 0%면
  // 그 그림은 "많은 플레이어가 보는 그림"이 아니다. 반대로 20%대가 여러 루틴에
  // 걸쳐 나오면 그게 더 넓게 쓰인다.
  console.log(`\n## 커버리지 — 노출 ${COVERAGE_THRESHOLD * 100}% 이상인 루틴 수 / 학교급 수\n`);
  console.log('| 표정 | 합계 | 루틴 커버리지 | 학교급 커버리지 (루틴×학교급) |');
  console.log('|---|---:|---:|---:|');
  const grand: Counts = {};
  for (const x of results) for (const e of EXPRS) grand[e] = (grand[e] ?? 0) + (x.total[e] ?? 0);
  for (const e of EXPRS) {
    const rHit = results.filter(x => x.weeks > 0 && (x.total[e] ?? 0) / x.weeks >= COVERAGE_THRESHOLD).length;
    let sHit = 0;
    let sTot = 0;
    for (const x of results) {
      for (const st of STAGES) {
        const b = x.byStage[st];
        if (b.weeks === 0) continue;
        sTot++;
        if ((b.counts[e] ?? 0) / b.weeks >= COVERAGE_THRESHOLD) sHit++;
      }
    }
    console.log(`| ${e} | ${pct(grand[e] ?? 0, grandWeeks)} | ${rHit}/${results.length} | ${sHit}/${sTot} |`);
  }
}

main();
