// verify-background-school-level.ts — 배경 판(plate)의 학교급이 이벤트의 발동 학년과 맞는지 검증
//
// 학교급 매핑은 backgrounds.ts의 getSchoolLevel 하나뿐이다: Y1=초 / Y2~4=중 / Y5~7=고.
// 이벤트 작성자가 이걸 틀리면 **에러가 없다** — 그냥 엉뚱한 교실 판이 뜬다. 그래서 게이트로 잠근다.
//
// 관련 스크립트: scripts/tools/check-background-assets.ts 는 배경 키의 **파일 존재**를 본다.
//   다만 그 스크립트는 **어떤 npm 스크립트에도 걸려 있지 않아 CI에서 돌지 않는다**(2026-09-10 확인).
//   "존재는 저쪽이 본다"고 믿지 말 것 — 여기서 보는 건 정합뿐이고, 존재는 지금 CI에서 아무도 안 본다.
//
// ── 발동 학년을 어떻게 얻는가, 그리고 그 근사의 한계 ────────────────────────────────
// 정규식이 아니라 **조건 함수를 실제로 실행**해서 얻는다. 상태를 (학년 × 주차 × 방학 × met ×
// 성별 × 부모 동일쌍 6종)으로 훑어 한 번이라도 참이면 그 학년에 발동 가능으로 본다.
//
// **이건 과대추정이 아니라 혼합 근사다.** 학년·주차·방학 축만 넓고 나머지는 전부 좁다:
// 친밀도는 0/100 두 값뿐(`intimacy <= 75` 같은 밴드 조건은 영원히 거짓), 스탯은 70 고정,
// `track`은 null, `s.events`는 빈 배열, 부모는 동일 쌍뿐이다.
// 그래서 조건이 `(프로브가 못 밟는 분기) || (밟는 분기)` 꼴이면 학년 집합이 **조용히 좁아진 채
// 비지도 않아서** UNKNOWN도 아니고 그냥 통과한다 — 거짓 통과가 원리적으로 가능하다.
// (검수에서 합성 반례 4건 중 3건이 조용히 통과하는 것이 실증됐다.)
//
// 그럼에도 지금 쓰는 이유: **현재 데이터에는 차이가 없다.** 프로브를 친밀도 8단계·스탯 4단계·
// track 3종·이종 부모 쌍 포함 10종으로 강화해 재계산해도 결과 차이 0건이었다(2026-09-10 실측).
// 축을 단순 교차곱으로 늘리면 상태가 16,128 → 77만으로 터지므로, 늘리는 건 급 배경이
// 아래 UNKNOWN 후보에 실제로 붙는 날 하는 게 맞다.
//
// **UNKNOWN 후보(프로브에서 한 번도 참이 아닌 이벤트) 29건** — 전부 지금은 급 변이가 없는
// 배경(bedroom_night·dinner_table·rooftop_sunset 등)이나 `{school}`을 써서 검사 대상이 아니다.
// 이 중 **반장 선거 체인 8건**에 급 배경(예: auditorium_middle)을 붙이면 게이트가 근거 없이
// 빨개진다 — 그때는 면제 목록이 아니라 프로브 축을 늘려서 풀 것(면제는 위 거짓 통과와 결합한다):
//   subin-academy, haeun-hs-curve, minjae-effort, class-president-nudge, fatigue-warning,
//   mental-low, middle-burnout, burnout-event, class-president-{speech,win,lose,vice},
//   class-president-2-{speech,win,lose}, president-{errand,mediate,speech}, high-panic,
//   family-strain, identity-crisis, yuna-misunderstanding, subin-drift, jihun-envy,
//   haeun-distance, career-conflict-{strict,info}-y6, adolescence-reconcile, junha-hs-recipe

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GAME_EVENTS } from '../../src/engine/events/data';
import { createInitialState } from '../../src/engine/gameEngine';
import { getSchoolLevel } from '../../src/engine/backgrounds';
import type { GameEvent, GameState, ParentStrength } from '../../src/engine/types';

const LEVELS = ['elementary', 'middle', 'high'] as const;
type Level = (typeof LEVELS)[number];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BG_DIR = path.join(__dirname, '..', '..', 'public/images/backgrounds');

const havePlate = new Set(
  fs.readdirSync(BG_DIR).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')),
);
/** 학교급 변이 판을 하나라도 가진 base 키 (auditorium, classroom, music_room, ...) */
const platedBases = new Set(
  [...havePlate]
    .filter((k) => LEVELS.some((l) => k.endsWith(`_${l}`)))
    .map((k) => k.replace(/_(elementary|middle|high)$/, '')),
);

/**
 * 배경 키가 선언한 학교급. **끝이 아니라 세그먼트 단위로** 찾는다 —
 * `classroom_high_afternoon`·`school_gate_middle_rain`처럼 급 뒤에 계절/날씨가 붙는 키가
 * 실제로 21건 있고, endsWith로 보면 그게 전부 검사에서 빠진다(초판의 실제 결함이었다).
 * `highway`처럼 우연히 글자가 겹치는 건 경계 때문에 안 걸린다.
 */
function declaredLevel(bg: string): Level | null {
  return (bg.match(/(?:^|_)(elementary|middle|high)(?:_|$)/)?.[1] as Level | undefined) ?? null;
}

/**
 * 범용 키 bg에 급을 넣었을 때 나올 수 있는 판 이름. 끝에 붙이는 형태(`music_room_middle`)와
 * 마지막 세그먼트 앞에 끼우는 형태(`school_gate_high_rain`) 둘 다 본다 —
 * 오늘 후보가 늘지는 않지만, 한쪽만 보는 건 위 declaredLevel과 같은 계열의 구멍이다.
 */
function plateCandidates(bg: string, level: Level): string[] {
  const out = [`${bg}_${level}`];
  const seg = bg.split('_');
  if (seg.length > 1) {
    const mid = [...seg];
    mid.splice(mid.length - 1, 0, level);
    out.push(mid.join('_'));
  }
  return out;
}

// 상태는 조합당 1개만 만들어 전 이벤트가 공유한다. 조건이 state를 바꾸지 않는다는 건 실측했다
// (GAME_EVENTS 213개 조건을 한 상태에 순차 호출 후 JSON deep-compare, 변형 0건 / 2026-09-10).
const WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);
const PARENT_PAIRS: [ParentStrength, ParentStrength][] =
  (['wealth', 'info', 'resilience', 'emotional', 'freedom', 'strict'] as const).map((p) => [p, p]);

const PROBE_STATES: GameState[] = [];
for (let year = 1; year <= 7; year++) {
  for (const week of WEEKS) {
    for (const isVacation of [false, true]) {
      for (const met of [true, false]) {
        for (const gender of ['male', 'female'] as const) {
          for (const parents of PARENT_PAIRS) {
            const s = createInitialState(gender, parents, { rngSeed: 1 });
            s.year = year; s.week = week; s.isVacation = isVacation;
            s.stats = { academic: 70, social: 70, talent: 70, mental: 70, health: 70 };
            s.fatigue = 30; s.money = 500000;
            for (const n of s.npcs) { n.met = met; n.intimacy = met ? 100 : 0; }
            PROBE_STATES.push(s);
          }
        }
      }
    }
  }
}

interface Firing { years: Set<number>; errors: number }

function firingYears(e: GameEvent): Firing {
  const years = new Set<number>();
  let errors = 0;
  for (const s of PROBE_STATES) {
    if (e.week !== undefined && e.week !== s.week) continue;
    if (years.has(s.year)) continue;
    try {
      if (!e.condition || e.condition(s)) years.add(s.year);
    } catch {
      // 프로브가 안 세운 필드를 읽은 것. "거짓"과 구분해서 세어 둔다 —
      // 합치면 UNKNOWN 메시지가 원인을 잘못 지목한다.
      errors++;
    }
  }
  return { years, errors };
}

interface Problem { rule: 'A' | 'B'; id: string; detail: string }
interface AuditResult {
  problems: Problem[];
  checkedA: number;
  checkedB: number;
  dynamic: number;
}

function auditBackgroundLevels(events: readonly GameEvent[], fire: (e: GameEvent) => Firing): AuditResult {
  const problems: Problem[] = [];
  let checkedA = 0, checkedB = 0, dynamic = 0;

  for (const e of events) {
    const bg = e.background;
    if (!bg) continue;
    if (bg.includes('{school}')) { dynamic++; continue; }   // 런타임 치환 — 구조적으로 정합

    const declared = declaredLevel(bg);
    const isRuleB = !declared && platedBases.has(bg);
    if (!declared && !isRuleB) continue;                     // 급 변이가 없는 배경(bedroom_night 등)

    const { years, errors } = fire(e);
    const levels = [...new Set([...years].map(getSchoolLevel))];
    const why = errors > 0
      ? `조건이 프로브에서 예외를 ${errors}회 던졌다(프로브가 안 세우는 필드를 읽는 조건일 수 있다)`
      : '조건이 프로브에서 항상 거짓이다';

    if (declared) {
      checkedA++;
      if (years.size === 0) {
        problems.push({ rule: 'A', id: e.id, detail: `bg=${bg} — 발동 가능 학년을 하나도 못 찾음. ${why}. 판정 불가라 실패로 둔다.` });
      } else if (levels.length !== 1 || levels[0] !== declared) {
        problems.push({ rule: 'A', id: e.id, detail: `bg=${bg}(${declared}) 인데 발동 학년 [${[...years].join(',')}] → 급 [${levels.join(',')}]` });
      }
    } else {
      checkedB++;
      if (years.size === 0) {
        problems.push({ rule: 'B', id: e.id, detail: `bg=${bg} — 발동 가능 학년을 하나도 못 찾음. ${why}. 판정 불가라 실패로 둔다.` });
      } else if (levels.length === 1) {
        const hit = plateCandidates(bg, levels[0]).find((c) => havePlate.has(c));
        if (hit) problems.push({ rule: 'B', id: e.id, detail: `bg=${bg}(범용)인데 발동이 ${levels[0]} 한 급 [${[...years].join(',')}]이고 ${hit}.png 가 실제로 있다 — 급 판을 쓸 것` });
      }
    }
  }
  return { problems, checkedA, checkedB, dynamic };
}

/**
 * problems → 종료 코드. 굳이 함수로 뺀 이유: 실데이터가 상시 0건이라 **실패 경로가 한 번도
 * 실행되지 않아서**, 이 변환이 깨져도 아무도 모른다. 함수로 빼면 아래 자기검사가 잠글 수 있다.
 */
function exitCodeFor(problems: readonly Problem[]): 0 | 1 {
  return problems.length === 0 ? 0 : 1;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실데이터는 불일치 0건이라, 이게 없으면 **게이트를 통째로 무력화해도 초록**이다.
// 검수에서 실제로 확인됐다: `declaredLevel`을 항상 null로(규칙 A 통째 삭제), `problems.push`
// 무력화, 루프 첫 회차 break, 전부 `{school}`로 간주 — 진짜 결함을 심어 둔 채로도 전부 rc=0이었다.
// 합성 픽스처가 corpus를 비-자명하게 만들어 그 뮤테이션들을 막는다.
// 실패 시 process.exit이 아니라 **throw**다 — `process.exit(1)` 줄을 지우는 뮤테이션에도 살아남는다.
function mkFixture(id: string, background: string, condition: (s: GameState) => boolean): GameEvent {
  return { id, title: id, description: '', choices: [], background, condition };
}
const SELF_CHECK: GameEvent[] = [
  mkFixture('__self_ok_suffix', 'classroom_high', (s) => s.year === 5),
  mkFixture('__self_ok_midsegment', 'classroom_middle_afternoon', (s) => s.year === 2),
  mkFixture('__self_bad_suffix', 'classroom_high', (s) => s.year === 2),
  mkFixture('__self_bad_midsegment', 'classroom_high_afternoon', (s) => s.year === 2),
  mkFixture('__self_bad_ruleB', 'classroom', (s) => s.year === 5),
  mkFixture('__self_bad_unknown', 'classroom_high', () => false),
];
const SELF_EXPECT = ['__self_bad_midsegment', '__self_bad_ruleB', '__self_bad_suffix', '__self_bad_unknown'];

const selfRun = auditBackgroundLevels(SELF_CHECK, firingYears);
const selfGot = selfRun.problems.map((p) => p.id).sort();
if (selfGot.join('|') !== SELF_EXPECT.join('|')) {
  throw new Error(`게이트 자기검사 실패 — 기대 [${SELF_EXPECT.join(', ')}] / 실제 [${selfGot.join(', ')}]`);
}
if (exitCodeFor([]) !== 0 || exitCodeFor(selfRun.problems) !== 1) {
  throw new Error('게이트 자기검사 실패 — 문제를 찾고도 종료 코드가 0이다(실패가 CI에 전달되지 않는다).');
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
const result = auditBackgroundLevels(GAME_EVENTS, firingYears);

console.log('배경 학교급 정합 검증 — getSchoolLevel(Y1=초 / Y2~4=중 / Y5~7=고)');
console.log(`  급 판 보유 base ${platedBases.size}종: ${[...platedBases].sort().join(', ')}`);
console.log(`  규칙 A(급 선언 배경 ↔ 발동 학년) ${result.checkedA}건 / 규칙 B(급 판 있는데 범용 사용) ${result.checkedB}건 / {school} 동적 ${result.dynamic}건`);
console.log(`  자기검사 통과 — 합성 결함 ${SELF_EXPECT.length}종을 전부 잡음`);

// 커버리지 하한. 상한이 아니라 하한인 이유: 콘텐츠가 계속 늘어나는 리포라 `toBe`로 박으면
// 이벤트를 추가할 때마다 무관한 빨간불이 난다. 줄어드는 쪽만 막는다 —
// "검사 0건인데 ✅ PASS"가 실제로 재현된 실패 유형이다.
const FLOOR = { checkedA: 65, checkedB: 3, platedBases: 7 } as const;
if (result.checkedA < FLOOR.checkedA || result.checkedB < FLOOR.checkedB || platedBases.size < FLOOR.platedBases) {
  throw new Error(
    `커버리지 하한 미달 — 규칙A ${result.checkedA}/${FLOOR.checkedA}, 규칙B ${result.checkedB}/${FLOOR.checkedB}, ` +
    `급 판 base ${platedBases.size}/${FLOOR.platedBases}. 검사 범위가 줄었다(파싱이 좁아졌거나 배경/이벤트가 사라졌다).`,
  );
}

if (result.problems.length === 0) {
  console.log(`\n✅ PASS — 불일치 0건 (검사 ${result.checkedA + result.checkedB}건)`);
} else {
  console.log(`\n❌ FAIL — ${result.problems.length}건`);
  for (const p of result.problems) console.log(`  [규칙 ${p.rule}] ${p.id}: ${p.detail}`);
}
// 남은 단 하나의 자기검사 사각지대는 **이 줄을 process.exit(0)으로 하드코딩하는 것**이다.
// 스크립트가 자기 종료 코드를 스스로 검증할 수는 없다 — 대신 표면을 이 한 줄로 좁혀 뒀다.
process.exit(exitCodeFor(result.problems));
