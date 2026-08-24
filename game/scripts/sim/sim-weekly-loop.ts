/**
 * 주간 루프 진단 — "매주 하는 행위가 7년간 변하는가"를 측정한다.
 *
 * 기존 sim-qa-playthrough가 스탯·엔딩·돈 잔액을 보는 반면, 이 스크립트는 **선택 공간**을 본다.
 * 두 축을 분리해서 재는 것이 목적이다:
 *   ① 학년 게이트로 열리는 활동 (unlockYear / requires의 year 조건)
 *   ② 돈 때문에 잠긴 활동 (같은 상태에서 돈만 무한이면 열리는 것)
 * 이 둘을 합쳐서 "선택 가능 활동 수"로만 보면 원인을 못 가른다 — 돈이 문제인지 콘텐츠가
 * 문제인지가 처방을 정반대로 만든다.
 *
 * 게이트 판정은 제품과 같은 SSOT(`getAvailableActivities`)를 쓴다. processWeek는 돈만 보고
 * unlock/requires를 안 보므로(sim-qa-playthrough의 주석 참조) 하네스가 직접 물어야 한다.
 *
 * ⚠ **스킵 수치를 제품 빈도로 인용하지 말 것.** 이 하네스는 `weekendChoices`/`vacationChoices`를
 * 직접 써서 UI를 우회한다. 제품에서 실제로 선택을 막는 것은 `ActivityPicker`의 누적
 * `availableMoney`(= 잔액 − 루틴비 − 이미 고른 활동비)이고, 그건 컴포넌트 안에 있어 sim으로
 * 재현되지 않는다. 아래 스킵 주차는 **엔진이 얼마나 관대한지의 상한선**이지 플레이어가 겪는
 * 빈도가 아니다. `ui` 모드도 `requires`(활동 단위) 게이트만 흉내낼 뿐 누적 판정은 못 한다.
 * (이 구분을 흐려서 한 번 오진했다 — docs/weekly-loop-diagnosis-2026-08.md의 정정 절 참조)
 *
 * 실행: npx tsx scripts/sim/sim-weekly-loop.ts [시드수] [ui]
 */
import { createInitialState, processWeek, getWeekInfo } from '../../src/engine/gameEngine';
import { ACTIVITIES, getAvailableActivities, getActivityCost } from '../../src/engine/activities';
import { getWeeklyIncome } from '../../src/engine/parentModifiers';
import { resolveEventLikeStore } from '../lib/y1-sim-resolve';
import type { GameState, ParentStrength } from '../../src/engine/types';

interface Routine {
  name: string;
  label: string;
  parents: [ParentStrength, ParentStrength];
  slot2: string;
  slot3: string;
  weekend: string[];
  vacation: string[];
}

// 대조군을 무료 루틴 하나로 두면 안 된다(과거 오판 전례) — 유료·혼합·무료 셋을 나란히 본다.
const ROUTINES: Routine[] = [
  { name: 'paid', label: '유료 루틴(학원+헬스)', parents: ['strict', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['self-study', 'club'], vacation: ['academy', 'rest', 'rest'] },
  { name: 'mixed', label: '혼합(학원+독학)', parents: ['emotional', 'info'],
    slot2: 'academy', slot3: 'self-study', weekend: ['club', 'rest'], vacation: ['self-study', 'club', 'rest'] },
  { name: 'free', label: '무료 루틴(독학+가벼운운동)', parents: ['resilience', 'freedom'],
    slot2: 'self-study', slot3: 'light-exercise', weekend: ['self-study', 'club'], vacation: ['rest', 'self-study', 'rest'] },
  // 지출형 — "유료 활동을 쓰고 싶은 플레이어"가 실제로 감당되는지. 여기서만 스킵이 관측된다.
  { name: 'paid-spend', label: '지출형(유료루틴+유료주말/방학)', parents: ['strict', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['art-lesson', 'hang-out'], vacation: ['intensive-academy', 'sports-camp', 'rest'] },
  // 부모 wealth(+2만/주)가 지출형을 구제하는가.
  { name: 'paid-wealth', label: '지출형+부유한 부모(+2만/주)', parents: ['wealth', 'info'],
    slot2: 'academy', slot3: 'gym', weekend: ['art-lesson', 'hang-out'], vacation: ['intensive-academy', 'sports-camp', 'rest'] },
];

/** 돈이 무한이라면 열릴 활동 — 학년/계절 게이트만 남긴 상태로 물어본다. */
function availableWithInfiniteMoney(s: GameState): Set<string> {
  const rich = { ...s, money: 99999 } as GameState;
  return new Set(getAvailableActivities(rich).map(a => a.id));
}

interface YearRow {
  semesterAvail: number[];       // 학기 주차별 선택 가능 수
  vacationAvail: number[];
  moneyLocked: number[];         // 그 주에 "돈만 없어서" 잠긴 활동 수
  surplus: number[];             // 그 주 수입 − 루틴 고정비(학기만)
  balance: number[];
  skipped: number;               // 돈이 없어 활동이 통째로 스킵된 주 (엔진 로그가 유일한 신호)
  skipRoutine: number;           // 그중 루틴 슬롯 스킵 (계획 화면이 경고하고 확정을 막는 쪽)
  skipChoice: number;            // 그중 주말/방학 선택 슬롯 스킵 (경고가 없는 쪽)
  weeks: number;
}

function runRoutine(r: Routine, seed: number, uiPick: boolean) {
  let s = createInitialState('male', r.parents, { rngSeed: seed });
  s.routineSlot2 = r.slot2;
  s.routineSlot3 = r.slot3;

  const years: Record<number, YearRow> = {};
  const everAvailable = new Set<string>();
  let blockedByPicker = 0;   // UI 목록이 실제로 걸러준 횟수(활동 단위)
  const firstSeenYear: Record<string, number> = {};

  for (let week = 0; week < 420 && s.year <= 7; week++) {
    // 계획은 매주 비워지고(proceedConfirm이 setSelectedActivities([])) 플레이어는 그때의 목록에서
    // 다시 고른다. 그 목록은 `getAvailableActivities`이고 돈 게이트가 **활동 하나씩** 걸린다
    // (`requires: s.money >= cost`) — 루틴이 먼저 빠져나갈 것도, 같은 주에 고른 다른 슬롯도
    // 계산에 없다. uiPick 모드가 그 조건을 재현한다: 못 고르는 건 무료 대안으로 바꾼다.
    if (uiPick) {
      const pickable = new Set(getAvailableActivities(s).map(a => a.id));
      const sub = (ids: string[], fallback: string) =>
        ids.map(id => { if (pickable.has(id)) return id; blockedByPicker++; return fallback; });
      s.weekendChoices = sub(r.weekend, 'self-study');
      s.vacationChoices = sub(r.vacation, 'rest');
    } else {
      s.weekendChoices = r.weekend;
      s.vacationChoices = r.vacation;
    }
    const info = getWeekInfo(s.week);
    const y = s.year;
    years[y] ??= { semesterAvail: [], vacationAvail: [], moneyLocked: [], surplus: [], balance: [], skipped: 0, skipRoutine: 0, skipChoice: 0, weeks: 0 };
    years[y].weeks++;

    // ── 선택 공간 측정 (processWeek 전, 플레이어가 계획을 세우는 시점의 상태) ──
    const now = new Set(getAvailableActivities(s).map(a => a.id));
    const rich = availableWithInfiniteMoney(s);
    for (const id of now) {
      everAvailable.add(id);
      firstSeenYear[id] ??= y;
    }
    let locked = 0;
    for (const id of rich) if (!now.has(id)) locked++;
    years[y].moneyLocked.push(locked);
    (info.isVacation ? years[y].vacationAvail : years[y].semesterAvail).push(now.size);

    if (!info.isVacation) {
      const income = getWeeklyIncome(s.parents, y);
      const fixed = [s.routineSlot2, s.routineSlot3]
        .map(id => ACTIVITIES.find(a => a.id === id))
        .reduce((sum, a) => sum + (a ? Math.max(0, getActivityCost(a, y)) : 0), 0);
      years[y].surplus.push(income - fixed);
    }
    years[y].balance.push(Math.round(s.money));

    s = processWeek(s);

    // 돈 부족 스킵은 엔진이 `WeekLog.skipped`에 origin과 함께 남긴다. 예전에는 로그 문구를
    // 활동 이름으로 갈랐는데, 루틴과 선택 슬롯에 같은 활동을 쓰는 페르소나에서는 그 분해가
    // 성립하지 않았다(무료 루틴의 self-study가 주말에도 있으면 귀속이 섞인다).
    {
      const money = (s.weekLog?.skipped ?? []).filter(k => k.reason === 'money');
      if (money.length > 0) years[y].skipped++;
      if (money.some(k => k.origin === 'routine')) years[y].skipRoutine++;
      if (money.some(k => k.origin === 'choice')) years[y].skipChoice++;
    }

    // 이벤트를 해결하지 않으면 phase가 'event'에 머물러 주차가 전진하지 않는다(첫 판에서
    // Y1만 420주 돌았다). 선택 정책은 이 측정의 축이 아니므로 첫 선택지로 고정한다.
    let guard = 0;
    while (s.currentEvent && guard++ < 20) s = resolveEventLikeStore(s, 0);

    // 학년 전환은 제품에서 사용자가 학년말 화면을 넘겨야 일어난다(applyYearTransition은
    // phase만 'year-end'로 둔다). 하네스가 그 한 걸음을 대신한다 — sim-qa-playthrough와 동일.
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }
  return { years, everAvailable, firstSeenYear, blockedByPicker };
}

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const f1 = (x: number) => x.toFixed(1);

// 두 모드의 차이가 곧 "UI가 막아주는 몫"이다. raw는 엔진 노출의 상한(계획이 그대로 유지되는
// 가정), uiPick은 실제 플레이에 가까운 값 — 진단에는 둘을 나란히 써야 한다.
const UI_PICK = process.argv[3] === 'ui';

function main() {
  const seeds = Number(process.argv[2]) || 5;
  console.log(UI_PICK ? '(모드: uiPick — 매주 고를 수 있는 것만 고른다)\n' : '(모드: raw — 계획이 그대로 유지된다고 가정)\n');
  console.log(`# 주간 루프 진단 — 루틴 ${ROUTINES.length}종 × 시드 ${seeds}\n`);

  // ── 정적 사실: 활동 카탈로그의 학년 게이트 ──
  const gated = ACTIVITIES.filter(a => a.unlockYear && a.unlockYear > 1);
  console.log(`## 활동 카탈로그 (총 ${ACTIVITIES.length}종)`);
  console.log(`unlockYear가 붙은 활동 ${gated.length}종:`);
  const byYear: Record<number, string[]> = {};
  for (const a of gated) (byYear[a.unlockYear!] ??= []).push(`${a.name}(${a.id})`);
  for (const y of Object.keys(byYear).map(Number).sort((a, b) => a - b)) {
    console.log(`  Y${y}: ${byYear[y].join(' · ')}`);
  }
  const paid = ACTIVITIES.filter(a => a.moneyCost > 0 || a.yearlyCost);
  console.log(`유료 활동 ${paid.length}종 / 수입 활동 ${ACTIVITIES.filter(a => a.moneyCost < 0).length}종\n`);

  for (const r of ROUTINES) {
    console.log(`## ${r.label}`);
    console.log('  학년 | 학기 선택가능 | 방학 선택가능 | 돈으로만잠김 | 주간잉여 | 연말잔액 | 스킵주(루틴/선택)');
    const agg: Record<number, { sem: number[]; vac: number[]; lock: number[]; sur: number[]; bal: number[]; skip: number[]; skipR: number[]; skipC: number[]; wk: number[] }> = {};
    const paletteFirst: Record<string, number[]> = {};
    let paletteTotal = 0;
    const pickerBlocks: number[] = [];

    for (let seed = 1; seed <= seeds; seed++) {
      const { years, everAvailable, firstSeenYear, blockedByPicker } = runRoutine(r, seed * 1000 + 7, UI_PICK);
      pickerBlocks.push(blockedByPicker);
      paletteTotal = Math.max(paletteTotal, everAvailable.size);
      for (const [id, y] of Object.entries(firstSeenYear)) (paletteFirst[id] ??= []).push(y);
      for (const y of Object.keys(years).map(Number)) {
        agg[y] ??= { sem: [], vac: [], lock: [], sur: [], bal: [], skip: [], skipR: [], skipC: [], wk: [] };
        agg[y].sem.push(mean(years[y].semesterAvail));
        agg[y].vac.push(mean(years[y].vacationAvail));
        agg[y].lock.push(mean(years[y].moneyLocked));
        agg[y].sur.push(mean(years[y].surplus));
        agg[y].bal.push(years[y].balance[years[y].balance.length - 1] ?? 0);
        agg[y].skip.push(years[y].skipped);
        agg[y].skipR.push(years[y].skipRoutine);
        agg[y].skipC.push(years[y].skipChoice);
        agg[y].wk.push(years[y].weeks);
      }
    }
    for (const y of Object.keys(agg).map(Number).sort((a, b) => a - b)) {
      if (y > 7) continue;
      const a = agg[y];
      console.log(`  Y${y}   | ${f1(mean(a.sem)).padStart(12)} | ${f1(mean(a.vac)).padStart(12)} | ` +
        `${f1(mean(a.lock)).padStart(11)} | ${f1(mean(a.sur)).padStart(7)} | ${String(Math.round(mean(a.bal))).padStart(7)} | ` +
        `${f1(mean(a.skip))}/${Math.round(mean(a.wk))}주 (루틴 ${f1(mean(a.skipR))} · 선택 ${f1(mean(a.skipC))})`);
    }
    // 팔레트가 실제로 늘어나는지 — 처음 등장 학년별 분포
    const newByYear: Record<number, number> = {};
    for (const ys of Object.values(paletteFirst)) newByYear[Math.round(mean(ys))] = (newByYear[Math.round(mean(ys))] ?? 0) + 1;
    console.log(`  한 판에 한 번이라도 선택 가능했던 활동: ${paletteTotal}종 / ${ACTIVITIES.length}`);
    if (UI_PICK) console.log(`  UI 목록이 걸러준 횟수: ${f1(mean(pickerBlocks))}회 / 한 판(336주 × 슬롯)`);
    console.log(`  처음 열린 학년 분포: ${Object.keys(newByYear).map(Number).sort((a, b) => a - b)
      .map(y => `Y${y}:${newByYear[y]}`).join(' · ')}\n`);
  }
}

main();
