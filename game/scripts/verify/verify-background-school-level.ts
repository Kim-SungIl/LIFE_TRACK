// verify-background-school-level.ts — 배경 판(plate)의 학교급이 이벤트의 발동 학년과 맞는지 검증
//
// 학교급 매핑은 backgrounds.ts의 getSchoolLevel 하나뿐이다: Y1=초 / Y2~4=중 / Y5~7=고.
// 이벤트 작성자가 이걸 틀리면 **에러가 없다** — 그냥 엉뚱한 교실 판이 뜬다. 그래서 게이트로 잠근다.
//
// 기존 체커와의 분업:
//  - scripts/tools/check-background-assets.ts : 참조된 배경 키의 **파일이 있는가** (존재)
//  - 이 스크립트                               : 그 키의 **학교급이 맞는가**   (정합)
//
// 발동 가능 학년은 정규식이 아니라 **조건 함수를 실제로 실행해서** 얻는다.
// 상태를 (학년 × 주차 × 방학 × met × 성별)로 훑어 한 번이라도 참이면 그 학년에 발동 가능으로 본다.
// 이건 과대추정(over-approximation)이다 — 실제로는 못 밟는 학년이 섞일 수 있다. 방향이 안전한 쪽이다:
//  · 규칙 A는 급 집합이 넓어질수록 **엄격**해지므로 놓치지 않는다(거짓 통과가 아니라 거짓 실패 쪽으로 틀린다).
//  · 규칙 B는 급 집합이 넓어지면 "범용이 맞다"로 넘어가므로 **보수적**이다.
// createInitialState 기본값을 그대로 쓰는 플래그(부모 절정 등)는 false라 과소추정 쪽인데,
// 그 경우 학년 집합이 비고 UNKNOWN으로 **실패**한다 — 조용히 빠져나가지 못한다.

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

function suffixLevel(bg: string): Level | null {
  return LEVELS.find((l) => bg.endsWith(`_${l}`)) ?? null;
}

// 상태는 조합당 1개만 만들어 전 이벤트가 공유한다(조건은 술어이므로 상태를 바꾸지 않는다).
// 이벤트마다 새로 만들면 12만 번 생성이라 CI에서 느리다.
const WEEKS = Array.from({ length: 48 }, (_, i) => i + 1);
// 부모 유형은 동일 쌍 6종만 훑는다 — 조건은 대체로 `parents.includes('strict')` 꼴이라
// 동일 쌍이면 6종 전부가 한 번씩 참이 된다. 36개 조합을 다 돌 이유가 없다.
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

function firingYears(e: GameEvent): Set<number> {
  const out = new Set<number>();
  for (const s of PROBE_STATES) {
    if (e.week !== undefined && e.week !== s.week) continue;
    if (out.has(s.year)) continue;
    try {
      if (!e.condition || e.condition(s)) out.add(s.year);
    } catch {
      // 프로브가 안 세운 필드를 읽는 조건 — 그 조합은 못 밟은 것으로 둔다
    }
  }
  return out;
}

interface Problem { rule: 'A' | 'B'; id: string; detail: string }
const problems: Problem[] = [];
let checkedA = 0, checkedB = 0, dynamic = 0;

for (const e of GAME_EVENTS) {
  const bg = e.background;
  if (!bg) continue;
  if (bg.includes('{school}')) { dynamic++; continue; }   // 런타임 치환 — 구조적으로 정합

  const suffix = suffixLevel(bg);
  const isRuleB = !suffix && platedBases.has(bg);
  if (!suffix && !isRuleB) continue;                       // 급 변이가 없는 배경(bedroom_night 등)

  const years = firingYears(e);
  const levels = [...new Set([...years].map(getSchoolLevel))];

  if (suffix) {
    checkedA++;
    if (years.size === 0) {
      problems.push({ rule: 'A', id: e.id, detail: `bg=${bg} — 발동 가능 학년을 하나도 못 찾음(조건이 프로브에서 항상 거짓). 판정 불가라 실패로 둔다.` });
    } else if (levels.length !== 1 || levels[0] !== suffix) {
      problems.push({ rule: 'A', id: e.id, detail: `bg=${bg}(${suffix}) 인데 발동 학년 [${[...years].join(',')}] → 급 [${levels.join(',')}]` });
    }
  } else {
    checkedB++;
    if (years.size === 0) {
      problems.push({ rule: 'B', id: e.id, detail: `bg=${bg} — 발동 가능 학년을 하나도 못 찾음. 판정 불가라 실패로 둔다.` });
    } else if (levels.length === 1 && havePlate.has(`${bg}_${levels[0]}`)) {
      problems.push({ rule: 'B', id: e.id, detail: `bg=${bg}(범용)인데 발동이 ${levels[0]} 한 급 [${[...years].join(',')}]이고 ${bg}_${levels[0]}.png 가 실제로 있다 — 급 판을 쓸 것` });
    }
  }
}

console.log('배경 학교급 정합 검증 — getSchoolLevel(Y1=초 / Y2~4=중 / Y5~7=고)');
console.log(`  급 판 보유 base ${platedBases.size}종: ${[...platedBases].sort().join(', ')}`);
console.log(`  규칙 A(급 접미사 배경 ↔ 발동 학년) ${checkedA}건 / 규칙 B(급 판 있는데 범용 사용) ${checkedB}건 / {school} 동적 ${dynamic}건`);

if (problems.length === 0) {
  console.log(`\n✅ PASS — 불일치 0건 (검사 ${checkedA + checkedB}건)`);
  process.exit(0);
}
console.log(`\n❌ FAIL — ${problems.length}건`);
for (const p of problems) console.log(`  [규칙 ${p.rule}] ${p.id}: ${p.detail}`);
process.exit(1);
